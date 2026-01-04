/**
 * Production-Ready Google Sign-In Button Component
 * Uses expo-auth-session with system browser (not WebView)
 */

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet, Platform, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase';

// Complete auth session when browser closes
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

export const GoogleSignInButton = ({ onSuccess, onError, style, textStyle }) => {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const clientId = getGoogleClientId();

  // ALWAYS use explicit Expo proxy format to avoid localhost issues
  // Format: https://auth.expo.io/@<username>/<slug>
  // For development, use @anonymous, for production use your Expo username
  const expoUsername = 'anonymous'; // Change to your Expo username if you have one
  const appSlug = 'mobile'; // From app.json -> expo.slug
  const redirectUri = `https://auth.expo.io/@${expoUsername}/${appSlug}`;
  
  // Log the redirect URI so user can verify it in Google Cloud Console
  console.log('🔵 Google OAuth Redirect URI:', redirectUri);
  console.log('⚠️ CRITICAL: Add this EXACT URL to Google Cloud Console:');
  console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
  console.log('   2. Select project: betterclinic-f1179');
  console.log('   3. Click your OAuth 2.0 Client ID (Web Client)');
  console.log('   4. Under "Authorized redirect URIs", click "+ ADD URI"');
  console.log('   5. Paste this EXACT URL:', redirectUri);
  console.log('   6. Click "Save" and wait 5-10 minutes');

  // Initialize Google OAuth using useAuthRequest hook
  // This automatically uses the system browser (Safari/Chrome)
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: clientId || '',
    scopes: ['openid', 'profile', 'email'],
    // Use Expo proxy for redirect URI (required for managed workflow)
    // Format: https://auth.expo.io/@<username>/<slug>
    redirectUri: redirectUri,
    // Additional parameters for better UX
    additionalParameters: {},
    // Use proxy (system browser via Expo)
    useProxy: true,
  });

  // Handle OAuth response
  useEffect(() => {
    if (!response) return;

    const handleResponse = async () => {
      if (response.type === 'error') {
        setIsLoading(false);
        const errorMessage = response.error?.message || 'Google sign-in failed';
        console.error('Google OAuth error:', response.error);
        
        if (onError) {
          onError(new Error(errorMessage));
        } else {
          Alert.alert('Sign-In Error', errorMessage);
        }
        return;
      }

      if (response.type === 'success') {
        try {
          setIsLoading(true);

          // Option 1: Use Firebase Authentication (Recommended)
          // This is more stable and handles token management automatically
          if (response.params?.id_token) {
            // If id_token is directly available (Firebase flow)
            const credential = GoogleAuthProvider.credential(response.params.id_token);
            const firebaseResult = await signInWithCredential(auth, credential);
            
            // Get Firebase ID token for backend verification
            const idToken = await firebaseResult.user.getIdToken();
            
            // Send to backend
            const result = await loginWithGoogle(idToken);
            
            setIsLoading(false);
            
            if (result.success) {
              if (onSuccess) {
                onSuccess(result.user);
              }
            } else {
              throw new Error(result.error || 'Authentication failed');
            }
          } 
          // Option 2: Exchange authorization code for tokens
          else if (response.params?.code) {
            // Use the same redirect URI that was used in the request (Expo proxy format)
            const redirectUriForExchange = `https://auth.expo.io/@anonymous/mobile`;
            
            // Exchange code for tokens
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: response.params.code,
                redirect_uri: redirectUriForExchange,
                client_id: clientId,
              }),
            });

            if (!tokenResponse.ok) {
              const error = await tokenResponse.json();
              throw new Error(error.error_description || error.error || 'Token exchange failed');
            }

            const tokenData = await tokenResponse.json();
            
            // Use id_token for Firebase or backend verification
            if (tokenData.id_token) {
              // Option A: Use with Firebase
              const credential = GoogleAuthProvider.credential(tokenData.id_token);
              const firebaseResult = await signInWithCredential(auth, credential);
              const idToken = await firebaseResult.user.getIdToken();
              
              const result = await loginWithGoogle(idToken);
              setIsLoading(false);
              
              if (result.success) {
                if (onSuccess) {
                  onSuccess(result.user);
                }
              } else {
                throw new Error(result.error || 'Authentication failed');
              }
            } else {
              // Option B: Send access_token directly (if backend accepts it)
              throw new Error('ID token not available. Please configure Firebase or use access token verification.');
            }
          } else {
            throw new Error('No authentication data received from Google');
          }
        } catch (error) {
          setIsLoading(false);
          console.error('Google sign-in error:', error);
          
          if (onError) {
            onError(error);
          } else {
            Alert.alert('Sign-In Error', error.message || 'Failed to complete sign-in');
          }
        }
      }

      if (response.type === 'cancel') {
        setIsLoading(false);
        // User cancelled - don't show error
      }
    };

    handleResponse();
  }, [response, clientId, loginWithGoogle, onSuccess, onError]);

  const handlePress = async () => {
    if (!clientId) {
      Alert.alert(
        'Configuration Error',
        'Google OAuth Client ID is missing. Please add it to your .env file.'
      );
      return;
    }

    if (!request) {
      Alert.alert('Error', 'OAuth request not ready. Please try again.');
      return;
    }

    try {
      setIsLoading(true);
      await promptAsync();
    } catch (error) {
      setIsLoading(false);
      console.error('Failed to start Google sign-in:', error);
      Alert.alert('Error', 'Failed to start Google sign-in. Please try again.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style, (isLoading || !request) && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isLoading || !request}
    >
      {isLoading ? (
        <ActivityIndicator color="#4285F4" />
      ) : (
        <>
          <View style={styles.googleIcon}>
            <Text style={styles.googleIconText}>G</Text>
          </View>
          <Text style={[styles.buttonText, textStyle]}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 56,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIconText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});

