# Google Cloud Console Setup Checklist

## Prerequisites
- Google Cloud Project: `betterclinic-f1179`
- Expo App Slug: `mobile`
- Expo Username: Check in Expo dashboard or use `@anonymous` for development
- Bundle ID: `com.xpressscan.mobile`
- Package Name: `com.xpressscan.mobile`

## Step-by-Step Setup

### 1. Create OAuth 2.0 Web Client

- [ ] Go to: https://console.cloud.google.com/apis/credentials
- [ ] Select project: `betterclinic-f1179`
- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Application type: **Web application**
- [ ] Name: `Xpress Scan Web Client`
- [ ] Authorized redirect URIs: Add:
  ```
  https://auth.expo.io/@anonymous/mobile
  ```
  (Replace `@anonymous` with your Expo username if you have one)
- [ ] Click "Create"
- [ ] Copy the **Client ID** → Add to `.env` as `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID`

### 2. Create OAuth 2.0 iOS Client

- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Application type: **iOS**
- [ ] Name: `Xpress Scan iOS Client`
- [ ] Bundle ID: `com.xpressscan.mobile`
- [ ] Click "Create"
- [ ] Copy the **Client ID** → Add to `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

### 3. Create OAuth 2.0 Android Client

- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Application type: **Android**
- [ ] Name: `Xpress Scan Android Client`
- [ ] Package name: `com.xpressscan.mobile`
- [ ] SHA-1 certificate fingerprint: 
  - For development: Run `expo credentials:manager` and get SHA-1
  - For production: Get from your keystore
- [ ] Click "Create"
- [ ] Copy the **Client ID** → Add to `.env` as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

### 4. Configure OAuth Consent Screen

- [ ] Go to: APIs & Services → OAuth consent screen
- [ ] User Type: **External** (unless you have Google Workspace)
- [ ] App name: `Xpress Scan`
- [ ] User support email: Your email
- [ ] Developer contact: Your email
- [ ] Add scopes:
  - `openid`
  - `profile`
  - `email`
- [ ] Add test users (if app is in testing mode)
- [ ] Save

### 5. Verify Redirect URI Format

The redirect URI must be in this exact format:
```
https://auth.expo.io/@<expo-username>/<app-slug>
```

Examples:
- Development: `https://auth.expo.io/@anonymous/mobile`
- Production: `https://auth.expo.io/@yourusername/mobile`

**Important:**
- Must use `https://` (not `http://`)
- Must use `auth.expo.io` domain
- Must include `@` before username
- Must match exactly (case-sensitive)

### 6. Common Mistakes Checklist

- [ ] ❌ Added redirect URI to "Authorized JavaScript origins" instead of "Authorized redirect URIs"
- [ ] ❌ Used custom URL scheme (`xpressscan://`) instead of Expo proxy URL
- [ ] ❌ Used `http://` instead of `https://`
- [ ] ❌ Missing `@` before username in redirect URI
- [ ] ❌ Wrong Expo username or app slug
- [ ] ❌ Using wrong Client ID for platform (iOS Client ID on Android, etc.)
- [ ] ❌ Not waiting 5-10 minutes after making changes
- [ ] ❌ Client ID not added to `.env` file
- [ ] ❌ Typo in Client ID in `.env` file

### 7. Testing

- [ ] Test on iOS device/simulator
- [ ] Test on Android device/emulator
- [ ] Verify system browser opens (Safari on iOS, Chrome on Android)
- [ ] Verify redirect URI in browser matches exactly
- [ ] Check console logs for any errors
- [ ] Verify tokens are received

### 8. Production Deployment

- [ ] Update redirect URI with production Expo username
- [ ] Add production redirect URI to Google Cloud Console
- [ ] Test in production environment
- [ ] Monitor for authentication errors
- [ ] Set up error tracking/alerts

## Quick Reference: Redirect URI Format

```
https://auth.expo.io/@<username>/<slug>
```

To find your Expo username:
1. Check Expo dashboard: https://expo.dev/accounts
2. Or use `@anonymous` for development/testing
3. Or check `app.json` for `owner` field

To find your app slug:
- Check `app.json` → `expo.slug` (currently: `mobile`)

## Environment Variables Template

```env
# Web Client ID (required - works for Expo proxy)
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# iOS Client ID (recommended for production)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com

# Android Client ID (recommended for production)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

