import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  User,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth'
import { Platform } from 'react-native'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { auth } from '../../config/firebase'
import { authApiService } from '../api/auth.api'
import { saveLastLogin } from './lastLogin'

// Configure Google Sign-In
// Get web client ID from Firebase Console → Project Settings → General → Your apps → Web app
// Or from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Web client
const getWebClientId = () => {
  // Try to get from environment variable first
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  }

  // TODO: Add your Google Web Client ID here
  // Get it from: Firebase Console → Project Settings → Your apps → Web app → OAuth 2.0 Client IDs
  // For betterclinic-f1179 project, it should look like: 101419773058-xxxxxxxxxxxxx.apps.googleusercontent.com
  // 
  // Steps to get it:
  // 1. Go to https://console.firebase.google.com
  // 2. Select project: betterclinic-f1179
  // 3. Click gear icon → Project Settings
  // 4. Scroll to "Your apps" section
  // 5. Click on your Web app (or create one)
  // 6. Look for "OAuth 2.0 Client IDs" section
  // 7. Copy the "Web client" ID (not iOS/Android)
  //
  // OR get it from Google Cloud Console:
  // 1. Go to https://console.cloud.google.com
  // 2. Select project: betterclinic-f1179
  // 3. Go to APIs & Services → Credentials
  // 4. Find OAuth 2.0 Client IDs
  // 5. Look for "Web client" and copy the Client ID

  // Google Web Client ID for betterclinic-f1179 project
  // This is the OAuth 2.0 Web client ID for Google Sign-In
  const WEB_CLIENT_ID = '101419773058-lq31dfucchaiaqcfnovd50dimut6tu2k.apps.googleusercontent.com'

  // Return the Web Client ID
  return WEB_CLIENT_ID
}

// Only configure if webClientId is available
// Wrap in try-catch to prevent module initialization errors
let isGoogleSignInConfigured = false
try {
  const webClientId = getWebClientId()
  if (webClientId) {
    GoogleSignin.configure({
      webClientId: webClientId,
      iosClientId: Platform.OS === 'ios' ? '101419773058-le9cprspepcs51usevd9jn8t4i9maihl.apps.googleusercontent.com' : undefined,
      offlineAccess: true,
    })
    isGoogleSignInConfigured = true
  }
} catch (error) {
  console.warn('Google Sign-In configuration failed:', error)
  isGoogleSignInConfigured = false
}

/**
 * Sign up a new user with email and password
 */
export const signUpWithEmail = async (email: string, password: string, role?: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    // Get Firebase ID token and sync with backend
    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken, role)
    } catch (backendError) {
      console.warn('Backend sync failed:', backendError)
      // Continue even if backend sync fails - user is still logged in to Firebase
    }

    return {
      user: userCredential.user,
      error: null,
    }
  } catch (error: any) {
    return {
      user: null,
      error: error.message || 'Failed to sign up',
    }
  }
}

/**
 * Sign in an existing user with an identifier (email OR username) + password.
 *
 * - If the identifier looks like an email, try Firebase Auth first (covers
 *   clinic owners with Firebase accounts). On a "no such Firebase user" /
 *   bad-credential error, fall back to a direct backend login.
 * - If the identifier has no "@", it's a username — go straight to the backend.
 *   Staff accounts live only in the backend `users` table.
 */
export const signInWithEmail = async (identifier: string, password: string) => {
  const looksLikeEmail = identifier.includes('@')

  const tryBackend = async () => {
    const { user: backendUser, error: backendError } =
      await authApiService.backendLogin(identifier, password)
    if (backendUser) {
      saveLastLogin({
        provider: 'email',
        email: identifier,
        name: (backendUser as any).name || undefined,
      })
      return { user: null, backendUser, error: null }
    }
    return {
      user: null,
      backendUser: null,
      error: backendError || 'Invalid credentials',
    }
  }

  if (!looksLikeEmail) {
    // Username — Firebase doesn't apply
    return tryBackend()
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, identifier, password)

    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken)
    } catch (backendError) {
      console.warn('Backend sync failed:', backendError)
    }

    saveLastLogin({
      provider: 'email',
      email: identifier,
      name: userCredential.user.displayName || undefined,
    })

    return {
      user: userCredential.user,
      backendUser: null,
      error: null,
    }
  } catch (error: any) {
    const code = error?.code || ''
    const isMissingFirebaseAccount =
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-login-credentials'

    if (isMissingFirebaseAccount) {
      return tryBackend()
    }

    return {
      user: null,
      backendUser: null,
      error: error.message || 'Failed to sign in',
    }
  }
}

/**
 * Sign out the current user
 */
export const signOutUser = async () => {
  try {
    // Unregister push token before clearing auth
    const { unregisterPushToken } = await import('../notifications/pushToken')
    await unregisterPushToken()
    // Clear backend tokens
    await authApiService.clearTokens()
    // Sign out from Firebase
    await signOut(auth)
    return { error: null }
  } catch (error: any) {
    return {
      error: error.message || 'Failed to sign out',
    }
  }
}

/**
 * Send password reset email
 */
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (error: any) {
    return {
      error: error.message || 'Failed to send password reset email',
    }
  }
}

/**
 * Update user password
 */
export const changePassword = async (newPassword: string) => {
  try {
    const user = auth.currentUser
    if (!user) {
      return { error: 'No user is currently signed in' }
    }
    await updatePassword(user, newPassword)
    return { error: null }
  } catch (error: any) {
    return {
      error: error.message || 'Failed to update password',
    }
  }
}

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (role?: string) => {
  try {
    if (!isGoogleSignInConfigured) {
      const webClientId = getWebClientId()
      if (!webClientId) {
        return {
          user: null,
          error: 'Google Sign-In is not configured. Please add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file or configure it in authService.ts',
        }
      }
      // Try to configure now
      try {
        GoogleSignin.configure({
          webClientId: webClientId,
          iosClientId: Platform.OS === 'ios' ? '101419773058-le9cprspepcs51usevd9jn8t4i9maihl.apps.googleusercontent.com' : undefined,
          offlineAccess: true,
        })
        isGoogleSignInConfigured = true
      } catch (configError) {
        return {
          user: null,
          error: 'Failed to configure Google Sign-In. Please check your configuration.',
        }
      }
    }

    // Check if your device supports Google Play (Android only)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }

    // Force account selection by signing out first (if session exists)
    // This solves the issue where it automatically picks the last used account
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in
    }

    // Sign in with Google - this opens the native Google Sign-In UI
    // signIn() returns user data if successful
    await GoogleSignin.signIn()

    // After signIn(), we need to ensure the user is the current user
    // Get the current user to verify sign-in was successful
    const currentUser = await GoogleSignin.getCurrentUser()

    if (!currentUser) {
      return {
        user: null,
        error: 'Failed to sign in with Google. User not found after sign-in.',
      }
    }

    // Now that we have a current user, we can get tokens
    // getTokens() requires a signed-in user, which we now have
    const tokens = await GoogleSignin.getTokens()
    const idToken = tokens.idToken

    if (!idToken) {
      return {
        user: null,
        error: 'Failed to get ID token from Google Sign-In',
      }
    }

    // Create a Google credential with the token
    const googleCredential = GoogleAuthProvider.credential(idToken)

    // Sign-in the user with the credential
    const userCredential = await signInWithCredential(auth, googleCredential)

    // Get Firebase ID token and sync with backend
    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken, role)
    } catch (backendError) {
      console.warn('Backend sync failed:', backendError)
      // Continue even if backend sync fails - user is still logged in to Firebase
    }

    if (userCredential.user.email) {
      saveLastLogin({
        provider: 'google',
        email: userCredential.user.email,
        name: userCredential.user.displayName || undefined,
      })
    }

    return {
      user: userCredential.user,
      error: null,
    }
  } catch (error: any) {
    let errorMessage = 'Failed to sign in with Google'

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      errorMessage = 'Sign in was cancelled'
      return {
        user: null,
        error: errorMessage,
      }
    } else if (error.code === statusCodes.IN_PROGRESS) {
      errorMessage = 'Sign in is in progress'
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      errorMessage = 'Google Play Services not available'
    }

    return {
      user: null,
      error: error.message || errorMessage,
    }
  }
}

/**
 * Sign in with Apple (iOS only).
 *
 * Flow: native AppleAuthentication.signInAsync → wrap identityToken in a
 * Firebase OAuthProvider('apple.com') credential → signInWithCredential →
 * sync the resulting Firebase ID token with our backend (same /oauth endpoint
 * Google uses).
 *
 * Apple returns `fullName` only on the FIRST authorization for an Apple ID
 * against this app — subsequent calls return null for fullName/email. We
 * surface it so the signup screen can pre-fill the name field; never
 * re-prompt the user for it (Apple HIG / App Store guideline 4).
 */
export const signInWithApple = async (role?: string) => {
  if (Platform.OS !== 'ios') {
    return {
      user: null,
      appleFullName: null,
      error: 'Sign in with Apple is only available on iOS.',
    }
  }

  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync()
    if (!isAvailable) {
      return {
        user: null,
        appleFullName: null,
        error: 'Sign in with Apple is not available on this device.',
      }
    }

    // Firebase requires the SHA-256 of the nonce passed to Apple, with the raw
    // nonce sent alongside the credential — Apple signs the hash, Firebase
    // verifies it matches the raw nonce we send.
    const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    )

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })

    if (!credential.identityToken) {
      return {
        user: null,
        appleFullName: null,
        error: 'Apple did not return an identity token. Please try again.',
      }
    }

    const provider = new OAuthProvider('apple.com')
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
      rawNonce,
    })

    const userCredential = await signInWithCredential(auth, firebaseCredential)

    // Compose full name from Apple's response (first sign-in only)
    let appleFullName: string | null = null
    if (credential.fullName) {
      const parts = [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ].filter(Boolean)
      if (parts.length) appleFullName = parts.join(' ')
    }

    // Sync with backend — same endpoint as Google. Backend verifies the
    // Firebase token and creates the user from the email/name claims Firebase
    // extracts from Apple's identity token.
    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken, role)
    } catch (backendError) {
      console.warn('Backend sync failed:', backendError)
    }

    if (userCredential.user.email) {
      saveLastLogin({
        provider: 'apple',
        email: userCredential.user.email,
        name: appleFullName || userCredential.user.displayName || undefined,
      })
    }

    return {
      user: userCredential.user,
      appleFullName,
      error: null,
    }
  } catch (error: any) {
    // Cancellation is not an error to surface to the user.
    if (error?.code === 'ERR_REQUEST_CANCELED') {
      return { user: null, appleFullName: null, error: 'Sign in was cancelled' }
    }
    return {
      user: null,
      appleFullName: null,
      error: error?.message || 'Failed to sign in with Apple',
    }
  }
}

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

