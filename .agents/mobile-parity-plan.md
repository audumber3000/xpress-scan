# Mobile parity plan — master password, force update, rate us, feedback tiers

**Written 2026-08-13.** Target: `mobile-app/` (Expo 54, RN 0.81, TypeScript, app.json v3.17.0, iOS build 11 / Android versionCode 4).

---

## 0. Context, and one thing that is broken right now

This session shipped four things to the web app. Mobile has none of them, and one of them **actively broke mobile**.

### The regression, first

I gated `DELETE /api/v1/patients/{id}` behind an `X-Master-Token` header. I told you mobile was unaffected because my search found no delete calls there. That search was wrong: mobile does not use an `api.delete()` helper, it calls `fetch` with `method: 'DELETE'`, so nothing matched.

`mobile-app/src/services/api/patients.api.ts:357` calls that endpoint with no token. **Deleting a patient from the phone returns 403 today.** Also affected, less severely: `DELETE /invoices/{invoiceId}` now answers 403 instead of the old 400 for a paid bill, so the message a user sees is wrong even though the refusal is the same.

Everything else mobile deletes (line items, discounts, daily-register entries, inventory, lab orders, treatment types, medication stock) is ungated and fine.

**This is fixed in Part 1 and nothing else should ship before it.**

### What mobile is missing

Mobile's Control Center has Staff, Attendance, Permissions, Practice settings, Treatments & pricing, Templates, Notifications, Clinic settings, Subscription, Audit log. Compared with web it has **no Verification, no Devices, no Offers, no Medications/Prescription Sets**.

There is no version check, no update gate, and no store-review prompt anywhere in the app. All greenfield.

---

## Decisions taken

| Question | Answer |
|---|---|
| Rating flow | ~~Our own prompt, then the native sheet~~ → **revised to native sheet only** with our own timing. See Part 3: the pre-prompt is against Google's In-App Review guidance and Apple's custom-prompt rule. |
| Minimum version | A **DB row**, changeable without a deploy |
| Scope | **All four** workstreams |

---

## Part 1 — Master password (fixes the regression)

**Backend: nothing new.** `/api/v1/security/master-password/*` already exists and is platform-agnostic.

**New** `src/services/api/security.api.ts`, following the class shape of the existing `*.api.ts` files:
- `getMasterPasswordStatus()` · `sendMasterPasswordOtp()` · `setMasterPassword(code, newPassword)` · `verifyMasterPassword(password) → { token, expires_in }`
- Recovery contact: `getSecurity()` · `updateSecurity()` · `sendOtp(channel)` · `verifyOtp(channel, code)`

**New** `src/shared/components/MasterPasswordSheet.tsx` — the mobile twin of the web `MasterPasswordModal`. A bottom sheet, not a centre modal: it appears above a thumb, and the numeric keypad is already there. Six-digit input, `keyboardType="number-pad"`, inline error, and the role-aware hint (owners get a "change it in Verification" link; everyone else gets "ask your clinic owner"). Built from `theme.ts` tokens and the existing `CustomAlertModal` shape.

**Wire the token into the three gated calls** in `patients.api.ts` and `transactions.api.ts` — each grows an optional `masterToken` argument that becomes the `X-Master-Token` header.

**New Verification screen** in Control Center: recovery phone + email with OTP verify, and the master-password card (Default/Set badge, change flow gated on a WhatsApp OTP). Mirrors `pages/admin/security/Security.jsx` + `MasterPasswordCard.jsx`.

**Files:** `src/services/api/security.api.ts` (new), `src/shared/components/MasterPasswordSheet.tsx` (new), `src/features/admin/security/screens/VerificationScreen.tsx` (new), edits to `patients.api.ts`, `transactions.api.ts`, `PatientCard.tsx`, `InvoiceDetailsScreen.tsx`, `AdminHubScreen.tsx`.

---

## Part 2 — Force update

**Backend, new.** A `app_versions` table (platform, min_supported, latest, message, store_url, updated_at) seeded from env on first run, plus:

```
GET /api/v1/app/version?platform=ios|android&version=3.17.0
→ { action: "force" | "nudge" | "none", min_supported, latest, message, store_url }
```

Unauthenticated on purpose — a user on a build too old to sign in still has to be told to update. Compared with `packaging`-style semver ordering, not string compare, so `3.9.0 < 3.10.0`.

Raising the floor is then one `UPDATE` from the support tool or psql, no deploy, effective on the next app launch. Migration goes in `deploy.sh` + `deploy-aws.sh` alongside the master-password ALTERs.

**Mobile.** `src/services/api/appVersion.api.ts` + `src/app/UpdateGate.tsx`, mounted **inside `AuthProvider` but wrapping `AppContent`** in `App.tsx`, so it covers every screen including login.

- Checks on cold start and on every foreground (`AppState` listener), throttled to once per 30 min
- `force` → full-screen modal, **no dismiss, no back gesture, hardware back trapped on Android**, one button that opens the store
- `nudge` → dismissible sheet, snoozed 72h in AsyncStorage
- Reads the running version from `expo-application`'s `nativeApplicationVersion` (already a dependency)
- **Fails open**: any network error means no gate. A version check that bricks the app when the server hiccups is worse than the old build it was trying to stop

**No new native dependency**, so this ships in a normal OTA-free release without a prebuild.

---

## Part 3 — Rate us

> **Revised after checking industry practice.** The "Enjoying MolarPlus? [Yes]/[No]" pre-prompt I first proposed is a pattern from roughly 2013 to 2017, before either platform had a native review API. Big apps abandoned it, and both stores now discourage it:
>
> - **Google's In-App Review guidelines say not to ask the user any question before or while showing the rating card, including questions about their opinion.** A pre-prompt is named as a thing not to do.
> - **Apple's App Store Review Guidelines say custom review prompts will be disallowed**; the official API is the sanctioned route.
> - Routing unhappy users away from the store is **review gating**, which both stores treat as manipulating ratings. It is the specific thing the guidance above exists to stop.
>
> Please verify the current wording yourself before we ship — store policies move and my knowledge has a cutoff — but the direction is not in doubt. The upside of gating is not worth an enforcement action against a live clinical product.

**What big apps actually do now, and what we will do:** keep all the intelligence in *when* we ask, and none of it in *whether they are happy*.

**New native dependency: `expo-store-review`.** Needs a fresh prebuild and an EAS build — watch the iOS pod trap in the deploy-mechanics memory.

**`src/shared/services/reviewPrompt.ts`** owns all state in AsyncStorage under one key:

```ts
{ installedAt, sessionCount, promptCount, lastPromptAt, lastPromptVersion }
```

**Eligibility — this is where the product judgment lives, and it is entirely ours.** Ask only when every one of these holds:
- ≥ 7 days since install and ≥ 3 sessions
- A **positive moment just completed**: an invoice marked paid, a patient added, a day closed. Never after a failure, never with an error on screen
- Not inside a force/nudge update gate
- No prompt in the last 90 days (iOS) / 30 days (Android)
- Under the lifetime cap: 3 (iOS), 4 (Android)

Then a single call to `StoreReview.requestReview()`. **No question, no branch, no gate.** The OS decides whether the sheet appears; we only decide that this was a good moment to try.

**A permanent "Rate MolarPlus" row in Profile / Settings.** This is the honest answer to "keep showing until they rate": rather than nagging, it is always there for anyone who wants to, deep-linking to the store listing (`market://details?id=com.molarplus.app` on Android, `itms-apps://…?action=write-review` on iOS). Always available, never counted against quota, no policy risk.

**A separate "Send feedback" row**, always visible, going to Rohit. Deliberately **not** positioned as an alternative to rating and never shown as a branch off a review prompt — that distinction is exactly what keeps this compliant rather than review gating.

**What this costs us, honestly:** we lose the ability to intercept an unhappy user before they leave one star. We keep it partly through the always-available support entry and the support card, which is where an unhappy dentist was going to end up anyway. And we still cannot learn whether anyone rated — no API on either platform reports that, on any approach.

## Part 4 — Feedback tiers

Mobile already has `toast.success/error/warning/info` in `src/shared/components/toastService.ts` — the same generic-name trap that grew 502 calls on web.

- **`src/shared/utils/notify.ts`** with `sent` / `done` / `reverted` / `problem` and no `success`/`error`, wrapping the existing toastService
- **`src/shared/utils/friendlyError.ts`** — port of the web sanitiser. **Any 5xx discards its detail unread**; 4xx keeps ours; wide technical regex for the rest. Mobile currently does `detail = (await response.json())?.detail` in several `*.api.ts` files and shows it raw, so this closes the same leak
- Sweep the call sites: delete success toasts whose result is already on screen, route failures at a control into inline text

Smaller than the web job — mobile has far fewer call sites and the plumbing already exists.

---

## Part 5 — Control Center restructure

- **Medication section**: medication catalogue + Prescription Sets. Mobile has a `MedicationTab` under Utilities today (stock, not catalogue) — this is a new Control Center entry, matching web's split of "what we prescribe" from "what we charge"
- **Access & Activity**: fold the existing `AuditLogScreen` and a new Devices list into one entry with two tabs
- **Offers & Discounts**: read-only first pass

Lowest priority of the five; nothing is broken without it.

---

## Sequencing

1. **Part 1** — unbreaks mobile patient delete. Ship alone, verify on device.
2. **Part 2** — pure JS, no prebuild, so it can ride the same release.
3. **Part 4** — also pure JS, low risk.
4. **Part 3** — needs a prebuild + EAS build; batch it with Part 5.
5. **Part 5**.

Parts 1, 2 and 4 are one release with **no native changes**. Parts 3 and 5 are the next.

---

## What I need from you

1. **Apple App Store numeric ID** (the `id0000000000` in your App Store URL). Needed for the "Rate MolarPlus" row's iOS deep link. The Play package I already have: `com.molarplus.app`.
1b. **A nod on the revised rating approach** (Part 3) — I am recommending against the option you picked, for policy reasons.
2. **Confirm the version floor to seed.** I suggest `min_supported = 3.15.0`, `latest = 3.17.0` — low enough that nobody is force-updated on day one.
3. **`app.json` says 3.17.0, `package.json` says 3.16.0.** Which is real? The version gate compares against the *native* build number, so these must agree before this ships.
4. **EAS build** when Part 3 lands — outward-facing and costly, so I will not run it without you saying so.

---

## Verification

- `npx tsc --noEmit` clean, `npx expo export` bundles, `jest` passes — the bar the last mobile parity build was held to
- **Part 1**: delete a patient from the phone → prompt appears → succeeds. Wrong code → "not right, N attempts left". No token → 403. Confirms the regression is closed.
- **Part 2**: point the app at a seeded `min_supported` above its own version → blocking modal, back button trapped on Android, no way past. Set it below → app opens normally. Kill the backend → app still opens (fails open).
- **Part 3**: fake the clock in AsyncStorage to walk the cadence. iOS stops after 2. Android re-asks at 21 days and switches to the deep link on ask 3.
- **Part 4**: force a 500 from the backend → user sees the human sentence, never the Python exception.
- On-device on both platforms before any store submission.
