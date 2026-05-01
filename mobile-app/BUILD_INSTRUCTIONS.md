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
