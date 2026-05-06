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

---

## Standard release checklist

1. Bump `version` in `app.json` (e.g. `3.14.0` → `3.15.0`). EAS auto-increments `buildNumber`.
2. Commit any pending mobile changes.
3. If you added a new iOS capability since last release, export the `EXPO_ASC_*` env vars (see Gotcha #1).
4. Run:
   ```bash
   cd mobile-app
   npx eas build --platform ios --profile production --auto-submit --non-interactive
   ```
   `--auto-submit` chains the App Store upload after a successful build, so you don't have to manually run `eas submit` afterwards.
5. If only re-submitting an existing build (no rebuild needed):
   ```bash
   npx eas submit --platform ios --latest --non-interactive
   ```
6. Once Apple finishes processing (5–10 min after submit), the build appears in TestFlight at:
   https://appstoreconnect.apple.com/apps/6765472713/testflight/ios
