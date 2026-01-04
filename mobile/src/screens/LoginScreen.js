import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Mail, Lock } from 'lucide-react-native';
import { signInWithCredential, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Complete auth session for web browser
WebBrowser.maybeCompleteAuthSession();

const LoginScreen = () => {
  const { login, loginWithGoogle, isAuthenticated, isAdmin } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Check for redirect result on mount (for web only)
  useEffect(() => {
    if (Platform.OS === 'web' && auth) {
      getRedirectResult(auth)
        .then((result) => {
          if (result && result.user) {
            handleFirebaseAuthResult(result);
          }
        })
        .catch((error) => {
          console.error('Redirect result error:', error);
        });
    }
  }, []);

  // Handle deep link from web callback
  useEffect(() => {
    // Handle initial URL (when app opens from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (url) => {
    console.log('🔵 Deep link received:', url);
    
    if (url.includes('auth/callback')) {
      try {
        // Parse URL to get token (handles both xpressscan:// and http:// formats)
        let idToken = null;
        
        // Try to parse as URL (works for http://)
        try {
          const urlObj = new URL(url);
          idToken = urlObj.searchParams.get('id_token');
        } catch (e) {
          // For custom schemes (xpressscan://), parse manually
          const match = url.match(/[?&]id_token=([^&]+)/);
          if (match) {
            idToken = decodeURIComponent(match[1]);
          }
        }
        
        if (idToken) {
          console.log('🔵 ID token found in deep link');
          setGoogleLoading(true);
          
          // Send ID token to backend
          const loginResult = await loginWithGoogle(idToken);
          setGoogleLoading(false);
          
          if (!loginResult.success) {
            Alert.alert('Login Failed', loginResult.error || 'Failed to authenticate with Google');
          }
        } else {
          console.error('No ID token in deep link:', url);
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
        setGoogleLoading(false);
        Alert.alert('Error', 'Failed to process authentication token');
      }
    }
  };

  // Navigate to appropriate screen after successful login
  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin()) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminApp' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'EmployeeApp' }],
        });
      }
    }
  }, [isAuthenticated, isAdmin, navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
    }
    // Navigation will happen automatically via useEffect when isAuthenticated changes
  };

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      Alert.alert(
        'Google Login Unavailable',
        'Firebase configuration is missing. Please add Firebase credentials to your .env file.'
      );
      return;
    }

    try {
      setGoogleLoading(true);
      
      if (Platform.OS === 'web') {
        // For web, use Firebase popup directly
        const { signInWithPopup } = await import('firebase/auth');
        const result = await signInWithPopup(auth, googleProvider);
        await handleFirebaseAuthResult(result);
      } else {
        // For mobile (iOS/Android), use expo-auth-session
        await handleMobileGoogleLogin();
      }
    } catch (error) {
      setGoogleLoading(false);
      console.error('Google login error:', error);
      Alert.alert('Error', error.message || 'Failed to start Google login');
    }
  };

  const handleMobileGoogleLogin = async () => {
    try {
      // Use iOS-specific Client ID on iOS, fallback to web Client ID
      const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      const webClientId = process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
      const clientId = Platform.OS === 'ios' && iosClientId ? iosClientId : webClientId;
      
      // Use iOS-specific API key on iOS, fallback to web API key
      const iosApiKey = process.env.EXPO_PUBLIC_FIREBASE_IOS_API_KEY;
      const webApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      const apiKey = Platform.OS === 'ios' && iosApiKey ? iosApiKey : webApiKey;
      
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

      if (!clientId || !apiKey) {
        setGoogleLoading(false);
        Alert.alert(
          'Configuration Required',
          'Firebase configuration is missing. Please add Firebase credentials to your .env file.'
        );
        return;
      }

      // Use web callback URL that will deep link back to app
      // For development: use localhost, for production: use your domain
      const webCallbackUrl = `${backendUrl.replace(':8000', ':5173')}/auth/callback?mobile=true`;
      const appDeepLink = Linking.createURL('auth/callback', {});
      
      console.log('🔵 Web callback URL:', webCallbackUrl);
      console.log('🔵 App deep link:', appDeepLink);
      console.log('⚠️ Add this to Google Cloud Console → Authorized redirect URIs:', webCallbackUrl);

      // Use Firebase's auth handler with web redirect
      const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
      const firebaseAuthUrl = `https://${authDomain}/__/auth/handler?` +
        `apiKey=${apiKey}` +
        `&authType=signInViaRedirect` +
        `&redirectUrl=${encodeURIComponent(webCallbackUrl)}` +
        `&providerId=google.com` +
        `&scopes=openid%20email%20profile` +
        `&v=9`;

      console.log('Opening Firebase auth handler');
      
      // Open browser for authentication
      const result = await WebBrowser.openAuthSessionAsync(firebaseAuthUrl, webCallbackUrl);

      if (result.type === 'success' && result.url) {
        // Check if URL contains deep link (xpressscan://)
        if (result.url.includes('xpressscan://')) {
          // Deep link - let handleDeepLink process it
          console.log('🔵 Deep link URL received, processing...');
          handleDeepLink(result.url);
        } else {
          // Direct URL with token (fallback)
          console.log('🔵 Callback URL received:', result.url);
          const url = new URL(result.url);
          const idToken = url.searchParams.get('id_token');
          
          if (idToken) {
            const loginResult = await loginWithGoogle(idToken);
            setGoogleLoading(false);
            
            if (!loginResult.success) {
              Alert.alert('Login Failed', loginResult.error || 'Failed to authenticate with Google');
            }
          } else {
            setGoogleLoading(false);
            console.error('No ID token in callback URL');
            Alert.alert('Error', 'No authentication token received. Please try again.');
          }
        }
      } else {
        setGoogleLoading(false);
        if (result.type !== 'cancel') {
          Alert.alert('Login Cancelled', 'Google login was cancelled or failed');
        }
      }
    } catch (error) {
      setGoogleLoading(false);
      console.error('Mobile Google login error:', error);
      Alert.alert('Error', error.message || 'Failed to start Google login');
    }
  };

  const handleFirebaseAuthResult = async (result) => {
    try {
      if (!result || !result.user) {
        throw new Error('No user data received from Google');
      }

      const idToken = await result.user.getIdToken();
      const loginResult = await loginWithGoogle(idToken);
      setGoogleLoading(false);

      if (!loginResult.success) {
        Alert.alert('Login Failed', loginResult.error || 'Failed to authenticate with Google');
      }
      // Navigation will happen automatically via useEffect when isAuthenticated changes
    } catch (error) {
      setGoogleLoading(false);
      Alert.alert('Error', error.message || 'Failed to process Google login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Xpress Scan</Text>
        <Text style={styles.subtitle}>Clinic Management System</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Mail size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Login Button */}
        <TouchableOpacity
          style={[styles.googleButton, (googleLoading || !auth) && styles.googleButtonDisabled]}
          onPress={handleGoogleLogin}
          disabled={googleLoading || !auth}
        >
          {googleLoading ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  loginButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 56,
    marginTop: 8,
  },
  googleButtonDisabled: {
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
  googleButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;

