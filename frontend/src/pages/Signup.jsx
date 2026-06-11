import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { saveLastLogin } from '../utils/lastLogin';
import LoadingButton from '../components/LoadingButton';
import LastLoginCard from '../components/login/LastLoginCard';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isValidEmail, isValidPassword, isNonEmpty } from '../utils/validators';
import loginImage from '../assets/login-page-left-side.png';
import { completeGoogleRedirectAuth, markGoogleRedirectPending } from '../utils/googleRedirectAuth';
import PublicSupportButton from '../components/PublicSupportButton';

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setToken } = useAuth();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      sessionStorage.setItem('referred_by_code', ref);
      console.log('🔗 [REFERRAL] Captured code:', ref);
    }
  }, [searchParams]);

  useEffect(() => {
    completeGoogleRedirectAuth({
      navigate,
      setUser,
      setToken,
      setError,
      setLoading,
      referredBy: sessionStorage.getItem('referred_by_code'),
      successMessage: 'Signup successful!',
    });
  }, [navigate, setUser, setToken]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const referredBy = sessionStorage.getItem('referred_by_code');
      const data = await api.post('/auth/register', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: 'clinic_owner',
        ...(referredBy && { referred_by_code: referredBy }),
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      sessionStorage.removeItem('referred_by_code');
      saveLastLogin({ provider: 'email', email, name: `${firstName} ${lastName}`.trim() });

      if (!data.user.clinic_id) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || "Network error. Please try again.";
      setError(errorMessage);
      
      if (errorMessage.includes('email-already-in-use')) {
        toast.error(
          <div>
            This email is already registered. <Link to="/login" className="underline font-bold">Try logging in with Google</Link>
          </div>
        );
      } else {
        toast.error(errorMessage);
      }
    }
    
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      console.log('🔵 [SIGNUP] Starting Google signup with POPUP...');

      const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import('firebase/auth');
      const { auth } = await import('../firebaseClient');

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');

      // Popups don't work inside the MolarPlus desktop wrapper (Tauri webview).
      // Use the system browser so Google can return through the molarplus:// deep link.
      if (window.__MOLARPLUS_DESKTOP__) {
        console.log('🔵 [SIGNUP] Desktop wrapper detected — opening browser OAuth flow');
        markGoogleRedirectPending('signup');
        const referredBy = sessionStorage.getItem('referred_by_code');
        const params = new URLSearchParams({ mode: 'signup' });
        if (referredBy) params.set('ref', referredBy);
        window.location.href = `${window.location.origin}/desktop-auth/start?${params.toString()}`;
        return;
      }

      console.log('🔵 [SIGNUP] About to open popup...');

      const result = await signInWithPopup(auth, provider);
      console.log('🔵 [SIGNUP] Popup result received:', !!result);

      if (result.user) {
        console.log('🔵 [SIGNUP] User authenticated:', result.user.email);

        // Get the ID token
        const idToken = await result.user.getIdToken();

        const referredBy = sessionStorage.getItem('referred_by_code');
        const data = await api.post('/auth/oauth', {
          id_token: idToken,
          ...(referredBy && { referred_by_code: referredBy }),
        });

        const userWithClinic = data.clinic ? { ...data.user, clinic: data.clinic } : data.user;
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(userWithClinic));
        setToken(data.token);
        setUser(userWithClinic);
        sessionStorage.removeItem('referred_by_code');
        saveLastLogin({ provider: 'google', email: result.user.email, name: result.user.displayName });

        toast.success('Signup successful!');

        const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('No user data received from Google');
      }

    } catch (error) {
      console.error('🔵 [SIGNUP] Google signup error:', error);
      const errorMessage = error.message || 'Google signup failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <PublicSupportButton />
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
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h2>
            <p className="text-gray-600">Start managing your clinic efficiently</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {/* Last Login Card */}
          <LastLoginCard
            variant="register"
            onContinue={(entry) => {
              if (entry.provider === 'google') {
                handleGoogleSignup();
                return;
              }
              // Already has an email/password account — send them to sign in.
              navigate(`/login?email=${encodeURIComponent(entry.email)}`);
            }}
            loading={loading}
          />

          {/* Google OAuth Button */}
          <LoadingButton 
            onClick={handleGoogleSignup}
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
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ValidatedInput
                label="First Name"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                isValid={isNonEmpty(firstName)}
                errorText="First name is required"
                autoComplete="given-name"
                required
              />
              <ValidatedInput
                label="Last Name"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                isValid={isNonEmpty(lastName)}
                errorText="Last name is required"
                autoComplete="family-name"
                required
              />
            </div>
            <ValidatedInput
              label="Email address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isValid={isValidEmail(email)}
              errorText="Enter a valid email address"
              autoComplete="email"
              required
            />
            <ValidatedInput
              label="Password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isValidPassword(password)}
              errorText="Use at least 8 characters"
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-[#2a276e] hover:text-[#1a1548] font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
