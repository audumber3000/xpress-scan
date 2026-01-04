import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate Firebase config
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key] || firebaseConfig[key] === 'your-' + key.replace(/([A-Z])/g, '-$1').toLowerCase() + '-here');

if (missingKeys.length > 0) {
  console.error('❌ Missing Firebase configuration:', missingKeys);
  console.error('Please check your .env file in the frontend directory');
}

// Initialize Firebase
let app;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // For development, use localhost:5173
  console.log('✅ Firebase initialized successfully');
  console.log('✅ For web development, Firebase Console should have:');
  console.log('   - localhost:5173/auth/callback');
  console.log('   - http://localhost:5173/auth/callback');
  console.log('   - http://localhost:5173 (for general localhost access)');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.error('Firebase config:', {
    apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    storageBucket: firebaseConfig.storageBucket || 'MISSING',
    messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
    appId: firebaseConfig.appId || 'MISSING'
  });
  throw error;
}

// Initialize Firebase Authentication and get a reference to the service
export { auth };
export default app;

