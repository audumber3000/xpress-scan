import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration - use iOS-specific config on iOS, web config otherwise
const isIOS = Platform.OS === 'ios';

const firebaseConfig = {
  apiKey: isIOS && process.env.EXPO_PUBLIC_FIREBASE_IOS_API_KEY 
    ? process.env.EXPO_PUBLIC_FIREBASE_IOS_API_KEY 
    : process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: isIOS && process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID 
    ? process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID 
    : process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Only initialize Firebase if we have the required config
let app = null;
let auth = null;
let googleProvider = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase config missing. Google login will not work until Firebase credentials are added to .env');
}

export { auth, googleProvider };
export default app;

