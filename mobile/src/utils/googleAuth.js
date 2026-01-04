/**
 * Production-ready Google Sign-In using Expo AuthSession with System Browser
 * 
 * Why System Browser (not WebView/Embedded Browser)?
 * 1. Google OAuth Policy Compliance: Google requires OAuth flows to use system browsers
 *    for security and user trust. Embedded browsers can be blocked or flagged.
 * 2. Better Security: System browsers have full security features, saved passwords,
 *    and proper certificate validation.
 * 3. User Experience: Users trust system browsers more and can see the full URL.
 * 4. Google's Detection: Google can detect embedded browsers and may block or restrict access.
 */

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Complete the auth session when browser closes
WebBrowser.maybeCompleteAuthSession();

/**
 * Get the appropriate Google OAuth Client ID based on platform
 */
const getGoogleClientId = () => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 
           process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
  } else if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 
           process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
  }
  // Web or fallback
  return process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
};

/**
 * Initialize Google OAuth using expo-auth-session
 * This uses the system browser (Safari on iOS, Chrome on Android)
 * 
 * @returns {Object} Auth request hook with promptAsync function
 */
export const useGoogleAuth = () => {
  const clientId = getGoogleClientId();

  if (!clientId) {
    console.warn('⚠️ Google OAuth Client ID not configured. Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID to .env');
  }

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: clientId || '',
    scopes: ['openid', 'profile', 'email'],
    // Use Expo proxy for redirect URI (required for managed workflow)
    redirectUri: Google.makeRedirectUri({
      useProxy: true,
    }),
    // Additional parameters for better UX
    additionalParameters: {},
    // Use system browser (not WebView)
    useProxy: true,
  });

  return {
    request,
    response,
    promptAsync,
    isLoading: !request || !response,
  };
};

/**
 * Extract tokens from Google OAuth response
 * 
 * @param {Object} response - Response from Google.useAuthRequest
 * @returns {Object|null} Object with idToken and accessToken, or null if error
 */
export const extractGoogleTokens = (response) => {
  if (!response) {
    return null;
  }

  if (response.type === 'error') {
    console.error('Google OAuth error:', response.error);
    return null;
  }

  if (response.type === 'success') {
    // The response contains an access_token
    // To get id_token, we need to exchange the authorization code
    return {
      accessToken: response.authentication?.accessToken || null,
      // Note: idToken is not directly available in the response
      // You'll need to exchange the code or use Firebase Auth
      authorizationCode: response.params?.code || null,
    };
  }

  return null;
};

/**
 * Exchange authorization code for ID token using Google token endpoint
 * This is needed if you want the idToken for Firebase verification
 * 
 * @param {string} code - Authorization code from OAuth response
 * @param {string} clientId - Google OAuth Client ID
 * @param {string} redirectUri - Redirect URI used in the OAuth request
 * @returns {Promise<Object>} Object with idToken and accessToken
 */
export const exchangeCodeForTokens = async (code, clientId, redirectUri) => {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Token exchange failed');
    }

    const data = await response.json();
    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
};

