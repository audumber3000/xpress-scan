import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingButton from '../components/LoadingButton';
import loginImage from '../assets/login-page-left-side.png';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isDesktop = /Windows|Mac|Linux/.test(userAgent) && !isMobile;
    
    let deviceType = 'web';
    let devicePlatform = 'Unknown';
    let deviceOS = '';
    
    if (isMobile) {
      deviceType = 'mobile';
      if (/Android/i.test(userAgent)) {
        devicePlatform = 'Android';
        const androidVersion = userAgent.match(/Android\s([0-9\.]*)/);
        deviceOS = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
      } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
        devicePlatform = 'iOS';
        const iosVersion = userAgent.match(/OS\s([0-9_]*)/);
        deviceOS = iosVersion ? `iOS ${iosVersion[1].replace('_', '.')}` : 'iOS';
      }
    } else if (isDesktop) {
      deviceType = 'desktop';
      if (/Windows/i.test(userAgent)) {
        devicePlatform = 'Windows';
        const winVersion = userAgent.match(/Windows NT\s([0-9\.]*)/);
        deviceOS = winVersion ? `Windows ${winVersion[1]}` : 'Windows';
      } else if (/Mac/i.test(userAgent)) {
        devicePlatform = 'macOS';
        const macVersion = userAgent.match(/Mac OS X\s([0-9_]*)/);
        deviceOS = macVersion ? `macOS ${macVersion[1].replace('_', '.')}` : 'macOS';
      } else if (/Linux/i.test(userAgent)) {
        devicePlatform = 'Linux';
        deviceOS = 'Linux';
      }
    }
    
    return {
      device_type: deviceType,
      device_platform: devicePlatform,
      device_os: deviceOS,
      device_name: `${devicePlatform} ${deviceType === 'mobile' ? 'Device' : deviceType === 'desktop' ? 'Device' : 'Browser'}`,
      user_agent: userAgent
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const deviceInfo = getDeviceInfo();
      const data = await api.post('/auth/login', {
        email,
        password,
        device: deviceInfo
      });
      
      // Store the JWT token
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Update auth context
      setToken(data.token);
      setUser(data.user);
      
      toast.success('Login successful!');
      
      // Small delay to ensure context is updated before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect based on user state
      const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const errorMessage = error.message || "Network error. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      console.log('🔵 [LOGIN] Starting Google login with POPUP...');
      console.log('🔵 [LOGIN] Current location:', window.location.href);

      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const { auth } = await import('../firebaseClient');

      console.log('🔵 [LOGIN] Firebase auth loaded:', !!auth);

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');

      console.log('🔵 [LOGIN] Provider created, about to open popup...');

      const result = await signInWithPopup(auth, provider);
      console.log('🔵 [LOGIN] Popup result received:', !!result);

      if (result.user) {
        console.log('🔵 [LOGIN] User authenticated:', result.user.email);

        // Get the ID token
        console.log('🔵 [LOGIN] Getting ID token...');
        const idToken = await result.user.getIdToken();
        console.log('🔵 [LOGIN] ID token received, length:', idToken.length);

        // Get device info
        const getDeviceInfo = () => {
          const userAgent = navigator.userAgent;
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
          const isDesktop = /Windows|Mac|Linux/.test(userAgent) && !isMobile;
          
          let deviceType = 'web';
          let devicePlatform = 'Unknown';
          let deviceOS = '';
          
          if (isMobile) {
            deviceType = 'mobile';
            if (/Android/i.test(userAgent)) {
              devicePlatform = 'Android';
              const androidVersion = userAgent.match(/Android\s([0-9\.]*)/);
              deviceOS = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
            } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
              devicePlatform = 'iOS';
              const iosVersion = userAgent.match(/OS\s([0-9_]*)/);
              deviceOS = iosVersion ? `iOS ${iosVersion[1].replace('_', '.')}` : 'iOS';
            }
          } else if (isDesktop) {
            deviceType = 'desktop';
            if (/Windows/i.test(userAgent)) {
              devicePlatform = 'Windows';
              const winVersion = userAgent.match(/Windows NT\s([0-9\.]*)/);
              deviceOS = winVersion ? `Windows ${winVersion[1]}` : 'Windows';
            } else if (/Mac/i.test(userAgent)) {
              devicePlatform = 'macOS';
              const macVersion = userAgent.match(/Mac OS X\s([0-9_]*)/);
              deviceOS = macVersion ? `macOS ${macVersion[1].replace('_', '.')}` : 'macOS';
            } else if (/Linux/i.test(userAgent)) {
              devicePlatform = 'Linux';
              deviceOS = 'Linux';
            }
          }
          
          return {
            device_type: deviceType,
            device_platform: devicePlatform,
            device_os: deviceOS,
            device_name: `${devicePlatform} ${deviceType === 'mobile' ? 'Device' : deviceType === 'desktop' ? 'Device' : 'Browser'}`,
            user_agent: userAgent
          };
        };

        // Send to backend for verification and JWT generation
        console.log('🔵 [LOGIN] Calling backend /auth/oauth...');
        const deviceInfo = getDeviceInfo();
        const data = await api.post('/auth/oauth', { 
          id_token: idToken,
          device: deviceInfo
        });

        console.log('🔵 [LOGIN] Backend response received');
        console.log('🔵 [LOGIN] Response data:', {
          hasToken: !!data.token,
          hasUser: !!data.user,
          userId: data.user?.id,
          clinicId: data.user?.clinic_id,
          email: data.user?.email
        });

        // Store the JWT token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('🔵 [LOGIN] Stored token and user in localStorage');

        // Update auth context
        console.log('🔵 [LOGIN] Updating AuthContext...');
        setToken(data.token);
        setUser(data.user);
        console.log('🔵 [LOGIN] AuthContext updated');

        toast.success('Login successful!');

        // Small delay to ensure context is updated before navigation
        await new Promise(resolve => setTimeout(resolve, 200));

        // Redirect based on user state
        const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
        console.log('🔵 [LOGIN] Redirecting to:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('No user data received from Google');
      }

    } catch (error) {
      console.error('🔵 [LOGIN] Google login error:', error);
      console.error('🔵 [LOGIN] Error code:', error.code);
      console.error('🔵 [LOGIN] Error message:', error.message);
      console.error('🔵 [LOGIN] Error stack:', error.stack);

      const errorMessage = error.message || 'Google login failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img 
          src={loginImage} 
          alt="Clino Health" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 py-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {/* Google OAuth Button */}
          <LoadingButton 
            onClick={handleGoogleLogin}
            loading={loading}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </LoadingButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#2a276e] hover:text-[#1a1548] font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
