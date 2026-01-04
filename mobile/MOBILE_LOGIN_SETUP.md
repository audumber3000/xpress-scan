# Mobile App Login Setup

## Backend Connection ✅

The mobile app is now connected to the backend for login:

1. **Email/Password Login**: ✅ Connected
   - Endpoint: `POST /auth/login`
   - Sends: `email`, `password`, `device_data`
   - Receives: `access_token`, `user`

2. **Google OAuth Login**: ✅ Connected
   - Endpoint: `POST /auth/oauth`
   - Sends: `id_token` (Firebase ID token), `device_data`
   - Receives: `token`, `user`

## Environment Variables Needed

Add these to `mobile/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000

# Firebase Configuration (for Google login)
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# Google OAuth Client IDs (for expo-auth-session)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-expo-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id
```

## Login Flow

1. **App Starts** → Checks if user is authenticated
2. **Not Authenticated** → Shows Login Screen
3. **User Logs In**:
   - Email/Password → Calls `/auth/login`
   - Google → Gets Firebase ID token → Calls `/auth/oauth`
4. **After Login** → Navigates to appropriate home screen:
   - Admin/Owner → Admin Home (bottom tabs)
   - Employee → Employee Home (grid cards)

## Testing

1. Make sure backend is running on `http://localhost:8000`
2. Test email/password login
3. Test Google login (requires Firebase config)

