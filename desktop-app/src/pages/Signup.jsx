import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { isTauri } from '../tauri';
import LoadingButton from '../components/LoadingButton';
import betterClinicLogo from '../assets/betterclinic-logo.png';
import { startSystemBrowserOAuth, constructFirebaseOAuthUrl, parseOAuthCallback, exchangeCodeForFirebaseToken } from '../utils/oauth';

const Signup = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);
    
    try {
      console.log('🔵 [SIGNUP] Starting Google signup...');
      console.log('🔵 [SIGNUP] Is Tauri:', isTauri());

      if (isTauri()) {
        // For Tauri: use system browser OAuth flow
        console.log('🔵 [SIGNUP] Using system browser OAuth for desktop app...');
        
        const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        const redirectUri = 'http://localhost:4646';
        
        // Construct Firebase OAuth URL
        const oauthUrl = constructFirebaseOAuthUrl(authDomain, apiKey, redirectUri);
        console.log('🔵 [SIGNUP] OAuth URL constructed, starting flow...');
        
        // Start OAuth flow (opens browser, waits for callback)
        const fragment = await startSystemBrowserOAuth(oauthUrl);
        console.log('🔵 [SIGNUP] OAuth callback received');
        
        // Parse the callback - might be code or token
        const callbackData = parseOAuthCallback(fragment);
        console.log('🔵 [SIGNUP] Callback data parsed:', callbackData.type);
        
        let idToken;
        if (callbackData.type === 'code') {
          // Need to exchange code for token
          console.log('🔵 [SIGNUP] Exchanging authorization code for Firebase token...');
          const tokenData = await exchangeCodeForFirebaseToken(callbackData.code, redirectUri, apiKey);
          idToken = tokenData.idToken;
          console.log('🔵 [SIGNUP] ID token obtained from code exchange');
        } else {
          // Already have token
          idToken = callbackData.idToken;
          console.log('🔵 [SIGNUP] ID token extracted from callback');
        }
        
        // Send to backend for verification and JWT generation
        const data = await api.post('/auth/oauth', { id_token: idToken });

        // Store the JWT token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        toast.success('Signup successful!');

        // Redirect based on user state
        const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        // For web: use popup (works fine in browsers)
        console.log('🔵 [SIGNUP] Using POPUP for web...');
        
        const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
        const { auth } = await import('../firebaseClient');

        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
          prompt: 'select_account'
        });
      
        const result = await signInWithPopup(auth, provider);
        console.log('🔵 [SIGNUP] Popup result received:', !!result);

        if (result.user) {
          console.log('🔵 [SIGNUP] User authenticated:', result.user.email);

          // Get the ID token
          const idToken = await result.user.getIdToken();

          // Send to backend for verification and JWT generation
          const data = await api.post('/auth/oauth', { id_token: idToken });

          // Store the JWT token
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));

          toast.success('Signup successful!');

          // Redirect based on user state
          const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
          navigate(redirectPath, { replace: true });
        } else {
          throw new Error('No user data received from Google');
        }
      }

    } catch (error) {
      console.error('🔵 [SIGNUP] Google signup error:', error);
      console.error('🔵 [SIGNUP] Error message:', error.message);
      console.error('🔵 [SIGNUP] Full error:', error);

      const errorMessage = error.message || error.toString() || 'Google signup failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md space-y-4">
        {/* Better Clinic Logo */}
        <div className="flex justify-center mb-6 overflow-hidden">
          <img 
            src={betterClinicLogo} 
            alt="Better Clinic Logo" 
            className="w-full h-32"
            style={{ 
              transform: 'scale(1.1)',
              objectFit: 'contain'
            }}
          />
        </div>
        
        <h2 className="text-2xl font-bold mb-4 text-center">Sign Up</h2>
        {error && <div className="text-red-600 text-center mb-4">{error}</div>}
        
        {/* Google OAuth Button */}
        <div className="space-y-4">
          <LoadingButton 
            onClick={handleGoogleSignup}
            loading={loading}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </LoadingButton>
          <p className="text-xs text-gray-500 text-center">
            {isTauri() 
              ? "You'll be redirected to Google to sign up"
              : "Sign up with your Google account to get started"
            }
          </p>
        </div>
        
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-[#6C4CF3] hover:text-[#5b3dd9] font-medium">
            Log in
          </Link>
        </p>
        
        {/* Branding */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Powered by <span className="text-[#6C4CF3] font-medium">Clino Health</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
