/**
 * Example: How to use GoogleSignInButton in your LoginScreen
 * 
 * This shows the production-ready way to integrate Google Sign-In
 * using the GoogleSignInButton component.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const LoginScreen = () => {
  const handleGoogleSuccess = (user) => {
    console.log('Google sign-in successful:', user);
    // Navigation will happen automatically via AuthContext
  };

  const handleGoogleError = (error) => {
    console.error('Google sign-in error:', error);
    // Error is already shown in Alert by the component
  };

  return (
    <View style={styles.container}>
      {/* Other login UI... */}
      
      {/* Google Sign-In Button */}
      <GoogleSignInButton
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        style={styles.googleButton}
        textStyle={styles.googleButtonText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  googleButton: {
    marginTop: 20,
  },
  googleButtonText: {
    // Custom text styling if needed
  },
});

export default LoginScreen;

/**
 * Alternative: Direct usage with useGoogleAuth hook
 */

import React, { useEffect } from 'react';
import { Button, Alert } from 'react-native';
import { useGoogleAuth, extractGoogleTokens, exchangeCodeForTokens } from '../utils/googleAuth';
import { useAuth } from '../context/AuthContext';

const LoginScreenDirect = () => {
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
      const tokens = extractGoogleTokens(response);
      
      if (tokens?.authorizationCode) {
        // Exchange code for tokens
        const clientId = getGoogleClientId();
        const redirectUri = Google.makeRedirectUri({ useProxy: true });
        
        const tokenData = await exchangeCodeForTokens(
          tokens.authorizationCode,
          clientId,
          redirectUri
        );

        // Send idToken to backend
        await loginWithGoogle(tokenData.idToken);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Sign-in failed');
    }
  };

  return (
    <Button
      title="Sign in with Google"
      onPress={() => promptAsync()}
      disabled={isLoading || !request}
    />
  );
};

