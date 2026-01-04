import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import GearLoader from '../components/GearLoader';
import { auth } from '../firebaseClient';
import { api } from '../utils/api';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

// Separate component for loading actions to avoid hooks issues
const LoadingActions = () => {
  const actions = [
    "opening lock",
    "opening windows", 
    "switching lights",
    "switching computer",
    "setting table",
    "brooming floor",
    "cleaning windows",
    "organizing files",
    "checking equipment",
    "preparing room",
    "arranging chairs",
    "testing machines",
    "stocking supplies",
    "checking temperature",
    "preparing forms",
    "final inspection",
    "warming stethoscope",
    "cleaning tools",
    "updating files",
    "loading records"
  ];
  
  const [currentAction, setCurrentAction] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAction((prev) => (prev + 1) % actions.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [actions.length]);
  
  return (
    <div className="text-[#6C4CF3] font-medium text-left">
      {actions.map((action, index) => (
        <div
          key={index}
          className={`absolute inset-0 flex items-center justify-start transition-all duration-700 ${
            index === currentAction 
              ? 'opacity-100 transform translate-y-0' 
              : index === ((currentAction + 1) % actions.length)
                ? 'opacity-0 transform translate-y-full'
                : 'opacity-0 transform -translate-y-full'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{action}</span>
            {/* Icons for each action */}
            {action === "opening lock" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 0 1121 9z" />
              </svg>
            )}
            {action === "opening windows" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
            {action === "switching lights" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            {action === "switching computer" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            {action === "setting table" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            )}
            {action === "brooming floor" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {action === "cleaning windows" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            )}
            {action === "organizing files" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {action === "checking equipment" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {action === "preparing room" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            )}
            {action === "arranging chairs" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
            {action === "testing machines" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            )}
            {action === "stocking supplies" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            )}
            {action === "checking temperature" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            {action === "preparing forms" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {action === "final inspection" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {action === "warming stethoscope" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
            {action === "cleaning tools" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {action === "updating files" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {action === "loading records" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const AuthCallback = () => {
  console.log('🔄 [AUTH CALLBACK] Component rendering...');
  console.log('🔄 [AUTH CALLBACK] Current URL:', window.location.href);
  console.log('🔄 [AUTH CALLBACK] Current pathname:', window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();

  useEffect(() => {
    console.log('🔄 [AUTH CALLBACK] useEffect triggered');
    let timeout;

    const handleAuthCallback = async () => {
      console.log('🔄 [AUTH CALLBACK] ==========================================');
      console.log('🔄 [AUTH CALLBACK] Processing redirect result...');
      console.log('🔄 [AUTH CALLBACK] Current URL:', window.location.href);
      console.log('🔄 [AUTH CALLBACK] Current search params:', window.location.search);
      console.log('🔄 [AUTH CALLBACK] Current hash:', window.location.hash);
      
      // Set a timeout to prevent getting stuck
      timeout = setTimeout(() => {
        console.error('🔄 [AUTH CALLBACK] ⏱️ TIMEOUT - Redirecting to login');
        setLoading(false);
        setError('Authentication timed out. Please try logging in again.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }, 15000); // 15 second timeout

      try {
        console.log('🔄 [AUTH CALLBACK] Getting redirect result from Firebase...');
        // Get the redirect result first (this is the key step)
        const result = await getRedirectResult(auth);
        
        if (result) {
          console.log('✅ [AUTH CALLBACK] Redirect result found!');
          console.log('✅ [AUTH CALLBACK] User email:', result.user.email);
          console.log('✅ [AUTH CALLBACK] User UID:', result.user.uid);
          clearTimeout(timeout);
          
          try {
            // Get the ID token
            console.log('🔄 [AUTH CALLBACK] Getting ID token...');
            const idToken = await result.user.getIdToken();
            console.log('✅ [AUTH CALLBACK] ID token received, length:', idToken.length);
            console.log('🔄 [AUTH CALLBACK] Calling backend /auth/oauth...');
            
            // Send to backend for verification and JWT generation
            const data = await api.post('/auth/oauth', { 
              id_token: idToken
            });

            console.log('✅ [AUTH CALLBACK] Backend response received');
            console.log('✅ [AUTH CALLBACK] Response data:', {
              hasToken: !!data.token,
              hasUser: !!data.user,
              userId: data.user?.id,
              clinicId: data.user?.clinic_id,
              email: data.user?.email
            });

            // Check if this is a mobile callback
            const urlParams = new URLSearchParams(window.location.search);
            const isMobile = urlParams.get('mobile') === 'true';
            
            if (isMobile) {
              // Mobile callback - deep link back to app with token
              console.log('📱 [AUTH CALLBACK] Mobile callback detected, deep linking to app...');
              
              // Create deep link URL with token
              const deepLinkUrl = `xpressscan://auth/callback?id_token=${encodeURIComponent(idToken)}&token=${encodeURIComponent(data.token)}&user=${encodeURIComponent(JSON.stringify(data.user))}`;
              
              console.log('📱 [AUTH CALLBACK] Deep link URL:', deepLinkUrl);
              
              // Try to open the app
              window.location.href = deepLinkUrl;
              
              // Show message
              setError('');
              setLoading(false);
              
              // Fallback: if app doesn't open, show instructions
              setTimeout(() => {
                alert('If the app didn\'t open automatically, please return to the app manually.');
              }, 1000);
              
              return;
            }
            
            // Web callback - normal flow
            // Store auth data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('✅ [AUTH CALLBACK] Stored token and user in localStorage');
            
            // Update auth context IMMEDIATELY before navigation
            console.log('🔄 [AUTH CALLBACK] Updating AuthContext...');
            setToken(data.token);
            setUser(data.user);
            console.log('✅ [AUTH CALLBACK] AuthContext updated');
            
            toast.success('Authentication successful!');
            
            // Small delay to ensure context is updated before navigation
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Redirect based on user state
            const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
            navigate(redirectPath, { replace: true });
          } catch (backendError) {
            console.error('❌ [AUTH CALLBACK] Backend error:', backendError);
            console.error('❌ [AUTH CALLBACK] Error message:', backendError.message);
            console.error('❌ [AUTH CALLBACK] Error stack:', backendError.stack);
            const errorMessage = backendError.message || 'Failed to authenticate with backend';
            setError(`Backend error: ${errorMessage}`);
            setLoading(false);
            clearTimeout(timeout);
            
            // Show error for 3 seconds then redirect to login
            setTimeout(() => {
              console.log('🔄 [AUTH CALLBACK] Redirecting to /login due to backend error');
              navigate('/login', { replace: true });
            }, 3000);
          }
        } else {
          // No redirect result - check if user is already authenticated
          console.log('⚠️ [AUTH CALLBACK] No redirect result found');
          console.log('🔄 [AUTH CALLBACK] Checking current auth state...');
          
          // Check if user is already signed in
          const currentUser = auth.currentUser;
          if (currentUser) {
            console.log('✅ [AUTH CALLBACK] User already authenticated:', currentUser.email);
            try {
              const idToken = await currentUser.getIdToken();
              const data = await api.post('/auth/oauth', { 
                id_token: idToken
              });
              
              localStorage.setItem('auth_token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              setToken(data.token);
              setUser(data.user);
              
              toast.success('Authentication successful!');
              
              // Small delay to ensure context is updated
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
              navigate(redirectPath, { replace: true });
              clearTimeout(timeout);
              return;
            } catch (e) {
              console.error('❌ [AUTH CALLBACK] Error with existing user:', e);
              toast.error(`Authentication error: ${e.message || 'Please try again.'}`);
            }
          }
          
          // No redirect result and no current user - redirect to login
          clearTimeout(timeout);
          setLoading(false);
          const errorMsg = 'No authentication result found. Please try logging in again.';
          setError(errorMsg);
          toast.error(errorMsg);
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        }
      } catch (e) {
        console.error('❌ [AUTH CALLBACK] Exception:', e);
        clearTimeout(timeout);
        setLoading(false);
        const errorMsg = `Authentication error: ${e.message || 'Please try logging in again.'}`;
        setError(errorMsg);
        toast.error(errorMsg);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
      console.log('🔄 [AUTH CALLBACK] ==========================================');
    };

    handleAuthCallback();
    
    // Cleanup function
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [navigate, setUser, setToken]);

    return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-8">
        <GearLoader />
        {error && (
          <div className="text-red-600 font-medium max-w-md mx-auto">
            {error}
          </div>
        )}
        {!error && (
          <p className="text-gray-600 font-medium">
            Authenticating...
          </p>
        )}
        </div>
      </div>
    );
};

export default AuthCallback; 
