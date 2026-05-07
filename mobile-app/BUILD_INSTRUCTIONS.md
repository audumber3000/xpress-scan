# MolarPlus Mobile App — Build & Release Instructions

## Prerequisites
- Node.js installed
- EAS CLI: `npm install -g eas-cli`
- Logged into Expo: `npx eas login`
- Apple Developer account (Upclick Labs Pvt. Ltd., Team ID: Q345MSC4Z8)
- Google Play Console access

## Bundle IDs
- **iOS**: `com.molarplus.ios`
- **Android**: `com.molarplus.app`

## Build with EAS (Recommended)

### iOS (App Store)
```bash
cd mobile-app
npx eas build --platform ios --profile production
```
- Builds in the cloud, handles signing automatically
- Outputs an `.ipa` file URL when done
- Free tier: 30 builds/month (queued), paid = priority

### Android (Play Store)
```bash
cd mobile-app
npx eas build --platform android --profile production
```
- Outputs an `.aab` file URL when done

### Both Platforms
```bash
npx eas build --platform all --profile production
```

## Submit to App Store (after build)
```bash
npx eas submit --platform ios --latest
```
- Will ask for Apple ID and App Store Connect App ID on first run
- Uploads the latest build directly to App Store Connect

## Submit to Google Play Store (after build)
```bash
npx eas submit --platform android --latest
```
- Requires Google Play service account JSON key

## Manual Android Build (Alternative)
```bash
cd mobile-app/android
./gradlew bundleRelease
```
- Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Version Management
- Version source is set to **remote** (managed by EAS)
- `autoIncrement: true` in `eas.json` — build numbers auto-increment
- To bump the app version (e.g., 3.13.0 → 3.14.0), update `version` in `app.json`

## Build Profiles (eas.json)
- **development** — dev client, internal distribution
- **preview** — internal testing
- **production** — App Store / Play Store release

## App Store Connect Setup
1. Go to https://appstoreconnect.apple.com
2. My Apps → + → New App
3. Platform: iOS, Name: MolarPlus, Bundle ID: com.molarplus.ios, SKU: molarplus-ios
4. Fill in: description, screenshots, keywords, privacy policy URL
5. Select the uploaded build and submit for review

## Important Notes
- `.easignore` excludes node_modules, Pods, and build artifacts from upload
- Local iOS builds fail due to spaces in project path — always use EAS for iOS
- Apple credentials are cached by EAS after first build
- Push notification keys are auto-managed by EAS

## Expo Dashboard
- Builds: https://expo.dev/accounts/audumber3000/projects/molarplus/builds
- Submissions: https://expo.dev/accounts/audumber3000/projects/molarplus/submissions

---

## Reference card — do not ask the user for these

Everything an AI agent or new contributor needs to ship a release. **Don't** ask the user for any of these — look here first.

### Identifiers

| Thing | Value |
|---|---|
| Expo account | `audumber3000` |
| Expo project ID | `717ac180-38d3-4b89-ade1-678090b3e324` |
| iOS bundle ID | `com.molarplus.ios` |
| Android package | `com.molarplus.app` |
| Apple Team ID | `Q345MSC4Z8` (UPCLICK LABS (OPC) PRIVATE LIMITED) |
| Apple Team type | `COMPANY_OR_ORGANIZATION` |
| Apple ID (account holder) | `audumberchaudhari1003@gmail.com` |
| ASC App ID | `6765472713` |
| ASC API Issuer ID | `aa09dd05-7e7b-43ae-b701-45fc7a909d6f` |
| GCP project (Firebase + Play API) | `betterclinic-f1179` |
| Android keystore alias | `molarplus` |
| Play service account | `eas-play-submit@betterclinic-f1179.iam.gserviceaccount.com` |

### Files on disk (gitignored — exist only on Audumber's Mac)

| File | Purpose |
|---|---|
| `mobile-app/android/app/molarplus-release.keystore` | Android signing keystore. SHA1 `D1:3B:EB:56:36:6B:5D:63:3E:C6:1A:B6:F3:4C:D9:3F:72:1A:74:0A`. Google Play permanently bound to this key — never replace. |
| `mobile-app/android/keystore.properties` | Stores keystore + key passwords (both `molarplusrelease`). |
| `mobile-app/credentials.json` | EAS local credentials pointing at the keystore. |
| `mobile-app/play-service-account.json` | Google Play API service-account key for `eas submit`. |
| `~/.appstoreconnect/private_keys/AuthKey_2V3J5NXDXC.p8` | **Sign in with Apple** key (backend JWT verification). NOT an ASC API key. |

### What's already configured server-side

- **EAS-managed iOS credentials** — Distribution Certificate (`6B22304…`, expires 2027-04-30), Provisioning Profile (auto-regenerated when capabilities change). Don't touch via `eas credentials` unless something breaks.
- **EAS-managed ASC API keys** — three Team Keys exist on Apple's side (`3668Z42NMD`, `92RLLLQ3TD`, `9SLL8QPPBS`); EAS picks one automatically when `submit.ios.ascApiKey*` is unset in `eas.json`. Leave it unset.
- **App Store Connect API access** — already requested + approved for the team. No action needed.
- **Google Play "Android Developer API"** — already enabled in GCP project `betterclinic-f1179`.
- **Play Console permissions** — service account `eas-play-submit@…` is granted Admin at both account and app level for MolarPlus.

### Working release commands (no questions needed)

iOS:
```bash
cd mobile-app
# bump version in app.json first if a real release (3.14.x → 3.15.0)
npx eas build --platform ios --profile production --auto-submit --non-interactive
```

Android:
```bash
cd mobile-app
npx eas build --platform android --profile production --auto-submit --non-interactive
```

Re-submit an existing build:
```bash
npx eas submit --platform ios --latest --non-interactive
npx eas submit --platform android --latest --non-interactive
```

If a build needs to regenerate iOS provisioning profile (new capability added), export ASC API key vars before the build:
```bash
EXPO_ASC_API_KEY_PATH=/Users/audii3000/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 \
EXPO_ASC_KEY_ID=<KEYID> \
EXPO_ASC_ISSUER_ID=aa09dd05-7e7b-43ae-b701-45fc7a909d6f \
EXPO_APPLE_TEAM_ID=Q345MSC4Z8 \
EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION \
npx eas build --platform ios --profile production --auto-submit --non-interactive
```
The `<KEYID>` here is one of the team's ASC API keys (above), **not** the Sign-in-with-Apple key `2V3J5NXDXC`.

---

## Gotchas — read before next release

These have all bitten us. The fixes here aren't theoretical — they're what worked.

### 1. New iOS capability ≠ rebuild. Provisioning profile must be regenerated.

If you add an iOS capability (Sign in with Apple, HealthKit, Push, App Groups, etc.) by editing `app.json` (`usesAppleSignIn: true`, etc.) and just run `eas build`, the build **will fail** with:

> Provisioning profile "..." doesn't support the X capability / doesn't include the Y entitlement

The cached profile predates the capability. EAS needs to talk to Apple Developer Portal to regenerate it. To do that **non-interactively** you must export the App Store Connect API key env vars before the build:

```bash
EXPO_ASC_API_KEY_PATH=/Users/audii3000/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 \
EXPO_ASC_KEY_ID=<KEYID> \
EXPO_ASC_ISSUER_ID=aa09dd05-7e7b-43ae-b701-45fc7a909d6f \
EXPO_APPLE_TEAM_ID=Q345MSC4Z8 \
EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION \
npx eas build --platform ios --profile production --auto-submit --non-interactive
```

With those set, EAS auto-adds the capability to the App ID and reissues the profile during the build. Without them, `--non-interactive` skips Apple auth entirely and the build fails.

### 2. There are **two different `.p8` files**. Don't confuse them.

| File | Where you get it | What it's for | Used by |
|------|------------------|---------------|---------|
| **Sign in with Apple key** | developer.apple.com → Certificates, Identifiers & Profiles → Keys | Backend verifies Apple ID JWTs | Your FastAPI auth code |
| **App Store Connect API key** | appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API → **Team Keys** | `eas submit`, TestFlight, App Store ops | EAS Submit / fastlane |

Both are `.p8` files. Both look identical. Apple's API rejects the wrong one with a useless `401 NOT_AUTHORIZED — credentials are missing or invalid`. If you see that error, you almost certainly handed an ASC API caller a Sign-in-with-Apple key by mistake.

The Sign-in-with-Apple key for this app is **`2V3J5NXDXC`** (`MolarPlus Apple Sign In`, created 2026/05/04, lives at `~/.appstoreconnect/private_keys/AuthKey_2V3J5NXDXC.p8`). Backend uses it to verify mobile sign-ins. It is **not** an ASC API key — never plug it into `EXPO_ASC_*` env vars or `eas.json`'s `ascApiKey*` fields.

### 3. App Store Connect API access is gated. Click "Request Access" once.

A fresh team has the API page locked behind a "Request Access" button — even for the Account Holder. Until you click that and Apple auto-approves it (instant), every ASC submission returns `401 NOT_AUTHORIZED` no matter what credentials you send.

URL: https://appstoreconnect.apple.com/access/integrations/api  
You only do this once, ever. After that, all keys created under "Team Keys" work.

### 4. `eas.json` should NOT carry `ascApiKey*` fields for submit.

EAS already has the ASC API keys it generated in past submits cached **server-side**. Leave `submit.production.ios` as just:

```json
"ios": {
  "appleId": "audumberchaudhari1003@gmail.com",
  "ascAppId": "6765472713",
  "appleTeamId": "Q345MSC4Z8"
}
```

When `eas submit` runs, it'll print `Key Source: EAS servers` and reuse a cached key. Hard-coding `ascApiKeyPath` to a local file forces EAS to use your local copy — which is brittle, and easy to point at the wrong `.p8`. We did this once and wasted a couple hours diagnosing the resulting 401.

The Issuer ID for our team is `aa09dd05-7e7b-43ae-b701-45fc7a909d6f` (visible at the top of the Team Keys table) — same as the Developer ID, which is rare but valid.

### 5. `eas submit` buffers all output until it exits.

If you run it through pipes or capture stdout to a file, you'll see **nothing** until the command finishes. Don't assume it's hung. The actual progress (`Scheduling iOS submission`, `Submitting`, `Successful` / error) flushes only at exit. To see live progress, run it directly in a terminal — or read the submission record on the Expo dashboard, which updates in real time:

> https://expo.dev/accounts/audumber3000/projects/molarplus/submissions

### 6. EAS hides Apple's actual error message.

When submission fails, the CLI prints a useless `✖ Something went wrong when submitting your app to Apple App Store Connect.` The real Apple error is on the Expo submission page (URL above) under the "Logs" tab — that's where you'll find the verbatim `401 NOT_AUTHORIZED` / `INVALID_BUNDLE_ID` / etc. Always check there before re-running.

`--verbose-fastlane` does not help — EAS still summarizes.

### 7. Android: never let EAS auto-generate a fresh keystore for production.

The first .aab uploaded to Play Console (Apr 17, 2026) was signed with `mobile-app/android/app/molarplus-release.keystore` (SHA1 `D1:3B:EB:…`). Google permanently bound the app to that keystore — every future upload **must** be signed with the same one or it's rejected:

> Google Api Error: Invalid request - The Android App Bundle was signed with the wrong key. Found: SHA1: 7E:CD:…, expected: SHA1: D1:3B:…

This was already burned once today: when EAS prompted "Generate a new Android Keystore?" we said yes, the build succeeded, the submission was rejected, and we had to rebuild. To prevent it:

- `eas.json` production profile has `"android": { "credentialsSource": "local" }`
- `mobile-app/credentials.json` points at the original keystore + passwords
- Both files are gitignored

If `eas build --platform android --profile production` ever asks "Generate a new Android Keystore?", **say no and abort**. Verify the local keystore + credentials.json are present before retrying. Verify SHA1 matches with:
```bash
keytool -list -v -keystore mobile-app/android/app/molarplus-release.keystore -storepass molarplusrelease | grep SHA1
```
Expected: `D1:3B:EB:56:36:6B:5D:63:3E:C6:1A:B6:F3:4C:D9:3F:72:1A:74:0A`.

### 8. Android: Play Console submission has multiple separate gates.

A successful `eas submit --platform android` requires **all four** of these to be set up — fail any one and you get a misleading error:

1. **Google Play Android Developer API** must be enabled in the GCP project. Visit https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=101419773058 → Enable. (Already done for this project.)
2. **Service account exists** in GCP IAM. Already done — `eas-play-submit@betterclinic-f1179.iam.gserviceaccount.com`.
3. **Play Console "Users and permissions"** has invited the service account email as a user with Admin permissions, granted both at the **Account permissions** tab AND the **App permissions** tab (per app — MolarPlus needs to be added). Already done.
4. **`eas.json` `submit.production.android` points at the service-account JSON** via `serviceAccountKeyPath: "./play-service-account.json"`. The file lives in `mobile-app/` and is gitignored.

Symptoms and which gate they fail:
| Error | Failed gate |
|---|---|
| `Google Play Android Developer API has not been used in project … or it is disabled` | #1 |
| `The caller does not have permission` (no app named) | #3 (Account permissions) |
| `Invalid request - The caller does not have permission` (during submit) | #3 (App permissions) |
| `Service account JSON not found` | #4 |
| `wrong key … expected SHA1 …` | unrelated to gates — keystore issue, see #7 |

### 9. Android: `--auto-submit` works but `eas build:view --json` shows `submissions: 0`.

Same EAS API quirk as iOS — the submissions field on a build object is unreliable. To verify a submission, look at the Expo dashboard (`/submissions`) or try `eas submit --platform android --latest` again: if it already submitted, Play Console returns `You've already submitted this version of the app`, which is your confirmation it landed.

### 10. Android: production track via `eas.json` lands as a draft, not a live rollout.

`submit.production.android.track: "production"` uploads the .aab onto the production track but does **not** publish it. Google holds it as a draft release for you to review. To go live, open Play Console → Test and release → Production → drag the rollout slider to 100% and click Save → Send for review. This is intentional Google behavior, not an EAS bug.

---

## Standard release checklist

1. Bump `version` in `app.json` (e.g. `3.14.1` → `3.15.0`). EAS auto-increments iOS `buildNumber` and Android `versionCode`.
2. Commit any pending mobile changes; push to `main`.
3. **iOS only:** if a new capability was added since the last release (Sign in with Apple, HealthKit, Push, App Groups, etc.), export the `EXPO_ASC_*` env vars before `eas build` (see Gotcha #1 + the Reference card above for exact values).
4. **Android only:** confirm `mobile-app/credentials.json` and `mobile-app/android/app/molarplus-release.keystore` exist locally. If credentials.json is missing, recreate from:
   ```json
   {
     "android": {
       "keystore": {
         "keystorePath": "android/app/molarplus-release.keystore",
         "keystorePassword": "molarplusrelease",
         "keyAlias": "molarplus",
         "keyPassword": "molarplusrelease"
       }
     }
   }
   ```
5. Build + submit (one command per platform):
   ```bash
   cd mobile-app
   npx eas build --platform ios     --profile production --auto-submit --non-interactive
   npx eas build --platform android --profile production --auto-submit --non-interactive
   ```
   `--auto-submit` chains the store upload after a successful build, so no separate `eas submit` step.
6. **Re-submit only** (no rebuild needed — same versionCode/buildNumber):
   ```bash
   npx eas submit --platform ios     --latest --non-interactive
   npx eas submit --platform android --latest --non-interactive
   ```
7. After processing:
   - iOS: TestFlight at https://appstoreconnect.apple.com/apps/6765472713/testflight/ios (~5–10 min after submit).
   - Android: Play Console → Test and release → Production. Build lands as a **draft release** — drag rollout slider to 100% and Save to publish (see Gotcha #10).
