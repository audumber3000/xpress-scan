import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { notify } from '../utils/notify';
import { api, getFriendlyErrorMessage } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { saveLastLogin, clearLastLoginToken } from '../utils/lastLogin';
import LoadingButton from '../components/LoadingButton';
import LastLoginCard from '../components/login/LastLoginCard';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isNonEmpty } from '../utils/validators';
import loginImage from '../assets/login-page-left-side.png';
import { completeGoogleRedirectAuth, markGoogleRedirectPending } from '../utils/googleRedirectAuth';
import PublicSupportButton from '../components/PublicSupportButton';
import SignInStatus, { SIGN_IN_PHASES, GOOGLE_PHASES } from '../components/login/SignInStatus';
import LockoutNotice from '../components/login/LockoutNotice';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Either a string or a small piece of JSX with a way out in it.
  const [error, setError] = useState(null);

  // A NAMED step, not a boolean. Signing in can be four requests deep now, and
  // reporting all of them as one disabled button reading "Signing in..." is
  // indistinguishable from a frozen page. See components/login/SignInStatus.
  const [phase, setPhase] = useState(null);
  const busy = phase !== null;

  // Set when the server cools an account down after repeated wrong passwords.
  // A timestamp rather than a counter, so the countdown survives a re-render.
  const [lockout, setLockout] = useState(null);   // { until, message }

  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();

  // Prefill email when arriving from the "Already signed up?" card on /signup.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('email');
    if (prefill) {
      setEmail(prefill);
      requestAnimationFrame(() => document.getElementById('login-password')?.focus());
    }
  }, []);

  // Coming back from the system browser on desktop. Without a phase here the
  // person returns to what looks like an untouched, frozen login form while
  // the token exchange runs behind it.
  useEffect(() => {
    completeGoogleRedirectAuth({
      navigate,
      setUser,
      setToken,
      setError,
      setLoading: (on) => setPhase(on ? 'googleFinishing' : null),
      successMessage: 'Login successful!',
    });
  }, [navigate, setUser, setToken]);

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

  // Signs the session in from a successful /auth/login or /auth/oauth answer.
  const completeSignIn = (data, { provider, identifier, name }) => {
    // Merge clinic from response so app has clinic info immediately
    const userWithClinic = data.clinic ? { ...data.user, clinic: data.clinic } : data.user;
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(userWithClinic));

    setToken(data.token);
    setUser(userWithClinic);

    saveLastLogin({ provider, email: identifier, name: name || data.user?.name, token: data.token });
    notify.done('Login successful!');

    // Deliberately NOT cleared here. Between this line and the dashboard
    // painting its first screen there is a route change and that page's own
    // first load, and a form that snaps back to enabled in the middle of it
    // invites a second click on a sign-in that already worked.
    setPhase('opening');

    return !data.user.clinic_id
      ? '/onboarding'
      : (data.user.role === 'clinic_owner' && data.user.clinics?.length > 1)
        ? '/select-clinic'
        : '/dashboard';
  };

  /**
   * Last resort for an email/password sign-in the backend rejected.
   *
   * Passwords live in two places in this product. Signing up on the web writes
   * a password_hash on our own users row; signing up in the mobile app creates
   * a FIREBASE password and syncs the backend through /auth/oauth, which
   * leaves password_hash null. /auth/login only ever reads password_hash, so
   * every clinic that started on the phone was told their password was wrong,
   * forever, on the web — and "Forgot password" could not help them either,
   * because there was no backend password to reset.
   *
   * The mobile app has always done this in reverse: it tries Firebase first
   * and falls back to our own login. This is the mirror of that, so the two
   * stores stop being two front doors that each only open for half the
   * customers. Only reached after the backend has already said no, so it costs
   * nothing on the normal path.
   */
  const tryFirebasePassword = async (identifier, secret) => {
    if (!identifier.includes('@')) return null;   // staff usernames are ours alone
    setPhase('appSignIn');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../firebaseClient');
    const credential = await signInWithEmailAndPassword(auth, identifier, secret);
    const idToken = await credential.user.getIdToken();
    const data = await api.post('/auth/oauth', { id_token: idToken, device: getDeviceInfo() });

    // Copy the password onto our own account so this detour happens exactly
    // once. From the next sign-in the ordinary login works, and "Forgot
    // password" finally has something to reset for them. Best effort: they are
    // already signed in, and failing to migrate is not a reason to stop them.
    try {
      setPhase('adopting');
      localStorage.setItem('auth_token', data.token);
      await api.post('/auth/adopt-password', { password: secret });
    } catch { /* tries again next sign-in */ }

    return { data, name: credential.user.displayName };
  };

  /**
   * What a failed sign-in should actually say.
   *
   * Two statuses mean something different on this screen than they do
   * everywhere else in the app, and the shared mapping in utils/api is written
   * for everywhere else:
   *
   *   401 becomes "Your session has ended. Please sign in again." Which is
   *       nonsense here. There is no session; they are trying to start one, and
   *       being told to sign in again on the sign-in page reads as the app
   *       having lost its mind rather than as a wrong password.
   *
   *   403 becomes a generic permissions line, which swallows the one message
   *       that would have helped: a deactivated staff member needs to hear that
   *       their account was turned off, not that they lack a permission.
   */
  const signInErrorMessage = (error) => {
    if (error?.status === 401) return 'That email or password did not match.';
    if (error?.status === 403 && typeof error?.detail === 'string') return error.detail;
    return getFriendlyErrorMessage(error, 'Network error. Please try again.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (busy || lockout) return;
    setError(null);
    setPhase('checking');

    // Trimmed because a pasted or autofilled address arrives with a trailing
    // space often enough to matter. The password is left exactly as typed — a
    // space can be a real character in one.
    const identifier = email.trim();

    try {
      const data = await api.post('/auth/login', {
        email: identifier,
        password,
        device: getDeviceInfo()
      });

      const redirectPath = completeSignIn(data, { provider: 'email', identifier });
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate(redirectPath, { replace: true });
    } catch (error) {
      // 401 means the password did not match OURS. It may still match Firebase.
      if (error?.status === 401) {
        try {
          const firebase = await tryFirebasePassword(identifier, password);
          if (firebase) {
            const redirectPath = completeSignIn(firebase.data, {
              provider: 'email', identifier, name: firebase.name,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            navigate(redirectPath, { replace: true });
            return;
          }
        } catch {
          // Firebase does not know them either. Fall through to the real error
          // below — the backend's message is the one worth showing.
        }
      }

      // The account has been cooled down after repeated wrong passwords. Shown
      // as a countdown they can watch rather than a flat refusal: almost
      // everybody who trips this is the owner misremembering their own
      // password, and "too many attempts" with no end in sight reads as being
      // locked out for good.
      if (error?.status === 429) {
        const wait = error.retryAfter || 60;
        setLockout({
          until: Date.now() + wait * 1000,
          message: typeof error?.detail === 'string' ? error.detail : undefined,
        });
        setError(null);
        setPhase(null);
        return;
      }

      // A rejected password and an address nobody has registered look identical
      // from here, on purpose — the backend answers both with "Invalid
      // credentials" so this screen cannot be used to find out which addresses
      // have accounts. What it CAN do is stop being a dead end: whichever of
      // the two it is, one of these two links is the way out.
      //
      // Shown inline rather than as a toast. The error belongs next to the
      // fields that caused it, and a toast slides away while somebody is still
      // reading it.
      setError(
        error?.status === 401 ? (
          <span>
            That email or password did not match.{' '}
            <Link to="/forgot-password" className="font-semibold underline">Reset your password</Link>
            {' '}or <Link to="/signup" className="font-semibold underline">create a clinic</Link>.
          </span>
        ) : signInErrorMessage(error)
      );
      setPhase(null);
      // Land them on the field they need to change, with the wrong password
      // already selected so they can just type over it.
      requestAnimationFrame(() => {
        const field = document.getElementById('login-password');
        field?.focus();
        field?.select?.();
      });
    }
  };

  const handleGoogleLogin = async (hintEmail = '') => {
    if (busy || lockout) return;
    setError(null);
    setPhase('googleWindow');
    try {
      console.log('🔵 [LOGIN] Starting Google login with POPUP...');
      console.log('🔵 [LOGIN] Current location:', window.location.href);

      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const { auth } = await import('../firebaseClient');

      console.log('🔵 [LOGIN] Firebase auth loaded:', !!auth);

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      // Re-auth from the "last used" card: hint Google so it skips the account
      // picker and signs the returning user straight back in.
      if (hintEmail) provider.setCustomParameters({ login_hint: hintEmail });

      // Popups don't work inside the MolarPlus desktop wrapper (Tauri webview).
      // Use the system browser so Google can return through the molarplus:// deep link.
      if (window.__MOLARPLUS_DESKTOP__) {
        console.log('🔵 [LOGIN] Desktop wrapper detected — opening browser OAuth flow');
        markGoogleRedirectPending('login');
        // Says what the app is about to do BEFORE it does it. Otherwise the
        // window simply blanks and a browser appears, which looks like the app
        // crashed rather than like a step in signing in.
        setPhase('googleBrowser');
        window.location.href = `${window.location.origin}/desktop-auth/start?mode=login`;
        return;
      }

      console.log('🔵 [LOGIN] Provider created, about to open popup...');

      const result = await signInWithPopup(auth, provider);
      console.log('🔵 [LOGIN] Popup result received:', !!result);

      if (result.user) {
        // Google is done; the rest is ours. The message changes so the wait
        // does not look like the Google window is still open somewhere.
        setPhase('googleFinishing');
        const idToken = await result.user.getIdToken();

        // Same endpoint the email/password Firebase fallback uses. The inline
        // copy of getDeviceInfo that used to live here was character-for-
        // character the function already defined above it.
        const data = await api.post('/auth/oauth', {
          id_token: idToken,
          device: getDeviceInfo(),
        });

        const redirectPath = completeSignIn(data, {
          provider: 'google',
          identifier: result.user.email,
          name: result.user.displayName,
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('No user data received from Google');
      }

    } catch (error) {
      console.error('🔵 [LOGIN] Google login error:', error);
      // Closing the Google popup is a decision, not a failure. Announcing it
      // as an error tells somebody who changed their mind that something broke.
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        setPhase(null);
        return;
      }

      // A blocked popup is the one Google failure the person can actually fix,
      // and the generic "Google login failed" gives them nothing to act on.
      setError(
        error?.code === 'auth/popup-blocked'
          ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, or sign in with your email and password below.'
          : signInErrorMessage(error)
      );
      setPhase(null);
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
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to your account to continue</p>
          </div>

          {/* One of these three at a time, never two: what is happening now,
              how long until they may try again, or what went wrong. */}
          {busy && SIGN_IN_PHASES[phase]?.strip ? (
            <SignInStatus phase={phase} />
          ) : lockout ? (
            <LockoutNotice
              until={lockout.until}
              message={lockout.message}
              onExpire={() => setLockout(null)}
            />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : null}

          {/* Last Login Card */}
          <LastLoginCard
            variant="login"
            onContinue={async (entry) => {
              // 1) One-click: a stored session token means we can validate it and
              //    drop the user straight onto their dashboard — no password needed.
              if (entry.token) {
                setError(null);
                setPhase('restoring');
                localStorage.setItem('auth_token', entry.token);
                try {
                  const me = await api.get('/auth/me'); // flat user + clinic; throws 401 if expired
                  localStorage.setItem('user', JSON.stringify(me));
                  setToken(entry.token);
                  setUser(me);
                  notify.done('Welcome back!');
                  setPhase('opening');
                  const redirectPath = !me.clinic_id
                    ? '/onboarding'
                    : (me.role === 'clinic_owner' && me.clinics?.length > 1)
                      ? '/select-clinic'
                      : '/dashboard';
                  navigate(redirectPath, { replace: true });
                  return;
                } catch {
                  // Token expired / invalidated — clean up and fall back to manual sign-in.
                  localStorage.removeItem('auth_token');
                  localStorage.removeItem('user');
                  clearLastLoginToken();
                  setPhase(null);
                  // The card promised one click and could not keep it, so say
                  // why rather than silently turning back into a blank form.
                  setError('Your saved session has expired. Please sign in again.');
                }
              }

              // 2) No usable token: Google re-runs OAuth; email prefills + focuses password.
              if (entry.provider === 'google') {
                handleGoogleLogin(entry.email);
                return;
              }
              setEmail(entry.email);
              setError(null);
              requestAnimationFrame(() => {
                document.getElementById('login-password')?.focus();
              });
            }}
            loading={busy}
          />

          {/* Google OAuth Button */}
          {/* Not disabled by a lockout. The cool-down is on password attempts,
              and for somebody locked out of their password this is a door that
              still opens. Taking it away leaves them with nothing to do but
              wait, which is how a two minute pause turns into a lost customer. */}
          <LoadingButton
            onClick={() => handleGoogleLogin()}
            loading={GOOGLE_PHASES.has(phase)}
            disabled={busy}
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
              <span className="px-4 bg-white text-gray-500 font-medium">Or continue with email or username</span>
            </div>
          </div>

          {/* Email-or-Username / Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <ValidatedInput
              label="Email or Username"
              id="login-email"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Enter your email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isValid={isNonEmpty(email)}
              autoComplete="username"
              required
            />
            <ValidatedInput
              label="Password"
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isNonEmpty(password)}
              autoComplete="current-password"
              required
            />
            <div className="flex justify-end -mt-1">
              <Link to="/forgot-password" className="text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={busy || !!lockout}
              className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
            >
              {busy ? SIGN_IN_PHASES[phase]?.message || "Signing in" : "Sign in"}
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

          {/* Mobile app download — same badges marketing uses on molarplus.com */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3">Also available on mobile</p>
            <div className="flex gap-3 items-center justify-center">
              <a
                href="https://apps.apple.com/app/molarplus"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/app-store.svg" alt="Download on the App Store" className="h-12 w-auto" />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.molarplus.app&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/google-play.svg" alt="Get it on Google Play" className="h-12 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
