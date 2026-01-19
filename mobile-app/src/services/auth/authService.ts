import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  User,
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth'
import { Platform } from 'react-native'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { auth } from '../../config/firebase'
import { authApiService } from '../api/auth.api'

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
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Get Firebase ID token and sync with backend
    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken)
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
 * Sign in an existing user with email and password
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    // Get Firebase ID token and sync with backend
    const firebaseIdToken = await userCredential.user.getIdToken()
    try {
      await authApiService.oauthLogin(firebaseIdToken)
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
      error: error.message || 'Failed to sign in',
    }
  }
}

/**
 * Sign out the current user
 */
export const signOutUser = async () => {
  try {
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
export const signInWithGoogle = async () => {
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
      await authApiService.oauthLogin(firebaseIdToken)
    } catch (backendError) {
      console.warn('Backend sync failed:', backendError)
      // Continue even if backend sync fails - user is still logged in to Firebase
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
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

