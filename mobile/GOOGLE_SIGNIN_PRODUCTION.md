# Production-Ready Google Sign-In Implementation Guide

## Overview

This guide provides a complete, production-ready implementation of Google Sign-In for Expo managed workflow apps using `expo-auth-session` with the system browser (not WebView).

## Why System Browser (Not WebView/Embedded Browser)?

### 1. **Google OAuth Policy Compliance**
- Google's OAuth policies require using system browsers for authentication flows
- Embedded browsers (WebViews) can be detected and blocked by Google
- Violations can result in "Access blocked" errors or account restrictions

### 2. **Security Benefits**
- System browsers have full security features (HTTPS validation, certificate pinning)
- Users can verify the URL and see security indicators
- Saved passwords and 2FA work seamlessly
- Better protection against phishing attacks

### 3. **User Trust**
- Users recognize and trust their system browser (Safari, Chrome)
- Full browser UI provides familiar experience
- Users can see the complete authentication flow

### 4. **Technical Advantages**
- Better cookie handling and session management
- Proper redirect handling
- No CORS issues
- Works with all Google security features

## Implementation

### Step 1: Install Dependencies

```bash
npm install expo-auth-session expo-web-browser expo-crypto
```

### Step 2: Configure Google Cloud Console

#### Checklist for Google Cloud Console Setup

- [ ] **Create OAuth 2.0 Credentials**
  - Go to: https://console.cloud.google.com/apis/credentials
  - Select your project
  - Click "Create Credentials" → "OAuth client ID"

- [ ] **Create Web Client**
  - Application type: **Web application**
  - Name: "Xpress Scan Web Client"
  - Authorized redirect URIs: Add Expo proxy URL:
    ```
    https://auth.expo.io/@<your-expo-username>/<your-app-slug>
    ```
    Example: `https://auth.expo.io/@anonymous/mobile`
  - Save and copy the **Client ID**

- [ ] **Create iOS Client** (if you have iOS app)
  - Application type: **iOS**
  - Bundle ID: `com.xpressscan.mobile` (must match app.json)
  - Save and copy the **Client ID**

- [ ] **Create Android Client** (if you have Android app)
  - Application type: **Android**
  - Package name: `com.xpressscan.mobile` (must match app.json)
  - SHA-1 certificate fingerprint: Get from `expo credentials:manager`
  - Save and copy the **Client ID**

#### Common Mistakes to Avoid

1. ❌ **Adding redirect URI to "Authorized JavaScript origins"**
   - ✅ Correct: Add to "Authorized redirect URIs"
   - JavaScript origins only accept domains (https://example.com)
   - Redirect URIs accept full URLs with paths

2. ❌ **Using custom URL schemes directly**
   - ❌ Wrong: `xpressscan://auth/callback`
   - ✅ Correct: `https://auth.expo.io/@username/slug`
   - Google requires HTTPS URLs for OAuth redirects

3. ❌ **Not waiting for changes to propagate**
   - Google Cloud changes can take 5-10 minutes
   - Always wait before testing

4. ❌ **Using wrong Client ID for platform**
   - iOS must use iOS Client ID
   - Android must use Android Client ID
   - Web/Expo proxy can use Web Client ID

5. ❌ **Missing Expo username in redirect URI**
   - Format: `https://auth.expo.io/@<username>/<slug>`
   - Find your username in Expo dashboard or use `@anonymous` for development

### Step 3: Environment Variables

Add to `mobile/.env`:

```env
# Required: Web Client ID (works for Expo proxy)
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# Optional: Platform-specific Client IDs (recommended for production)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

### Step 4: Usage in Component

```javascript
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useGoogleAuth, extractGoogleTokens, exchangeCodeForTokens } from '../utils/googleAuth';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const { loginWithGoogle } = useAuth();
  const { request, response, promptAsync, isLoading } = useGoogleAuth();

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response);
    } else if (response?.type === 'error') {
      Alert.alert('Error', response.error?.message || 'Google sign-in failed');
    }
  }, [response]);

  const handleGoogleSignIn = async (response) => {
    try {
      // Extract tokens from response
      const tokens = extractGoogleTokens(response);
      
      if (!tokens) {
        Alert.alert('Error', 'Failed to extract tokens');
        return;
      }

      // If we have authorization code, exchange for idToken
      if (tokens.authorizationCode) {
        const clientId = getGoogleClientId();
        const redirectUri = Google.makeRedirectUri({ useProxy: true });
        
        const tokenData = await exchangeCodeForTokens(
          tokens.authorizationCode,
          clientId,
          redirectUri
        );

        // Send idToken to backend for verification
        await loginWithGoogle(tokenData.idToken);
      } else if (tokens.accessToken) {
        // Use accessToken if idToken not available
        // Note: You may need to verify accessToken with Google API
        console.log('Access token received:', tokens.accessToken);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Sign-in failed');
    }
  };

  const handleSignIn = async () => {
    try {
      await promptAsync();
    } catch (error) {
      Alert.alert('Error', 'Failed to start Google sign-in');
    }
  };

  return (
    <Button 
      onPress={handleSignIn} 
      disabled={isLoading}
      title="Sign in with Google"
    />
  );
};
```

## Alternative: Firebase Authentication (Recommended)

For a more stable and feature-rich solution, use Firebase Authentication:

### Benefits of Firebase Auth

1. **Simpler Setup**: No need to manage OAuth clients manually
2. **Better Error Handling**: Firebase handles edge cases
3. **Token Management**: Automatic token refresh
4. **Cross-Platform**: Same code works on iOS, Android, and Web
5. **Backend Integration**: Easy to verify tokens on backend

### Firebase Implementation

```javascript
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import { auth } from '../config/firebase';

const useFirebaseGoogleAuth = () => {
  const clientId = getGoogleClientId();
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: clientId || '',
    scopes: ['openid', 'profile', 'email'],
    redirectUri: Google.makeRedirectUri({ useProxy: true }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      
      // Create Firebase credential from Google ID token
      const credential = GoogleAuthProvider.credential(id_token);
      
      // Sign in with Firebase
      signInWithCredential(auth, credential)
        .then(async (result) => {
          // Get Firebase ID token
          const idToken = await result.user.getIdToken();
          
          // Send to your backend for verification
          await loginWithGoogle(idToken);
        })
        .catch((error) => {
          console.error('Firebase sign-in error:', error);
        });
    }
  }, [response]);

  return { promptAsync, isLoading: !request };
};
```

### Backend Token Verification

```python
# Backend example (Python/FastAPI)
from firebase_admin import auth

@app.post("/auth/oauth")
async def verify_google_token(id_token: str):
    try:
        # Verify Firebase ID token
        decoded_token = auth.verify_id_token(id_token)
        
        # Extract user info
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        name = decoded_token.get('name')
        
        # Create/update user in your database
        user = get_or_create_user(uid, email, name)
        
        # Generate your app's JWT token
        app_token = generate_jwt_token(user)
        
        return {
            "token": app_token,
            "user": user
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## Testing Checklist

- [ ] Test on iOS device/simulator
- [ ] Test on Android device/emulator
- [ ] Verify redirect URI is correct in Google Cloud Console
- [ ] Check that system browser opens (not WebView)
- [ ] Verify tokens are extracted correctly
- [ ] Test backend token verification
- [ ] Test error handling (network errors, user cancellation)
- [ ] Test token refresh flow

## Troubleshooting

### "Access blocked" Error
- ✅ Check redirect URI matches exactly in Google Cloud Console
- ✅ Ensure using "Authorized redirect URIs" (not JavaScript origins)
- ✅ Wait 5-10 minutes after making changes
- ✅ Verify Client ID matches the platform

### "Invalid client" Error
- ✅ Check Client ID is correct for the platform
- ✅ Verify Client ID is from the correct Google Cloud project
- ✅ Ensure Client ID is in .env file

### Browser Doesn't Open
- ✅ Check expo-web-browser is installed
- ✅ Verify useProxy: true is set
- ✅ Check redirect URI format is correct

### No Tokens Received
- ✅ Verify response.type === 'success'
- ✅ Check response.params for code or tokens
- ✅ Ensure scopes include 'openid'

## Production Considerations

1. **Use Platform-Specific Client IDs**: Better security and compliance
2. **Handle Token Refresh**: Implement refresh token logic
3. **Error Monitoring**: Log authentication errors for debugging
4. **Rate Limiting**: Implement rate limiting on backend
5. **Security**: Always verify tokens on backend, never trust client-side tokens

