# Google Login Setup for Mobile App

To enable Google login on mobile (iOS/Android), you need to configure OAuth Client IDs in Firebase Console.

## Steps:

### 1. Go to Firebase Console
- Visit: https://console.firebase.google.com/
- Select your project

### 2. Get OAuth Client IDs
- Go to **Authentication** → **Sign-in method** → **Google**
- Click on **Web SDK configuration** (or go to **Project Settings** → **General** → **Your apps**)
- You'll see OAuth 2.0 Client IDs section

### 3. Find/Create Client IDs

You need **three** client IDs:

1. **Web Client ID** (already exists if web login works)
   - This is your main Firebase Web App client ID
   - Found in: Project Settings → General → Your apps → Web app → OAuth 2.0 Client IDs

2. **iOS Client ID** (if you have an iOS app registered)
   - Found in: Project Settings → General → Your apps → iOS app → OAuth 2.0 Client IDs
   - If you don't have an iOS app, you can:
     - Add an iOS app in Firebase Console
     - OR use the Web Client ID as fallback

3. **Android Client ID** (if you have an Android app registered)
   - Found in: Project Settings → General → Your apps → Android app → OAuth 2.0 Client IDs
   - If you don't have an Android app, you can:
     - Add an Android app in Firebase Console
     - OR use the Web Client ID as fallback

### 4. Add to mobile/.env

Add these environment variables to `mobile/.env`:

```env
# Firebase Web Client ID (required - fallback for iOS/Android if not specified)
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# iOS Client ID (optional - will use web client ID if not set)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com

# Android Client ID (optional - will use web client ID if not set)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

### 5. Alternative: Use Web Client ID Only

If you don't want to create separate iOS/Android apps in Firebase, you can use the Web Client ID for all platforms:

```env
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

The app will use this as a fallback for both iOS and Android.

### 6. Restart Expo

After adding the environment variables:
```bash
cd mobile
npm start -- --clear
```

## Notes:

- The Web Client ID is the minimum required
- iOS/Android Client IDs are optional but recommended for better security
- If you only set the Web Client ID, it will work on all platforms
- Make sure your Firebase project has Google Sign-in enabled in Authentication → Sign-in method

## Troubleshooting:

- **"Configuration Required" alert**: Make sure at least `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID` is set
- **"Invalid client" error**: Check that the client ID is correct and Google Sign-in is enabled
- **Login doesn't work**: Ensure the OAuth consent screen is configured in Google Cloud Console

