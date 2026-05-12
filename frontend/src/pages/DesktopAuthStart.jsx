import { useEffect, useState } from 'react';
import GearLoader from '../components/GearLoader';
import { auth } from '../firebaseClient';
import { api } from '../utils/api';
import { getDeviceInfo } from '../utils/googleRedirectAuth';
import { getRedirectResult, GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const PENDING_KEY = 'molarplus_desktop_browser_auth_pending';

const DesktopAuthStart = () => {
  const [error, setError] = useState('');

  useEffect(() => {
    const runDesktopBrowserAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode') || 'login';
        const referredBy = params.get('ref') || '';

        if (!sessionStorage.getItem(PENDING_KEY)) {
          sessionStorage.setItem(PENDING_KEY, mode);
          if (referredBy) sessionStorage.setItem('referred_by_code', referredBy);

          const provider = new GoogleAuthProvider();
          provider.addScope('email');
          provider.addScope('profile');
          await signInWithRedirect(auth, provider);
          return;
        }

        const result = await getRedirectResult(auth);
        const firebaseUser = result?.user || auth.currentUser;

        if (!firebaseUser) {
          throw new Error('Google did not return an authenticated user. Please try again.');
        }

        const idToken = await firebaseUser.getIdToken();
        const savedReferral = sessionStorage.getItem('referred_by_code');
        const data = await api.post('/auth/oauth', {
          id_token: idToken,
          device: getDeviceInfo(),
          ...(savedReferral && { referred_by_code: savedReferral }),
        });

        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.removeItem('referred_by_code');

        const deepLink = new URL('molarplus://auth/callback');
        deepLink.searchParams.set('token', data.token);
        deepLink.searchParams.set('mode', mode);

        window.location.href = deepLink.toString();
      } catch (err) {
        sessionStorage.removeItem(PENDING_KEY);
        setError(err.response?.data?.detail || err.message || 'Google sign-in failed. Please try again.');
      }
    };

    runDesktopBrowserAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-6 px-6">
        <GearLoader />
        <div>
          <h1 className="text-xl font-semibold text-[#2a276e]">Signing in with Google</h1>
          <p className="mt-2 text-sm text-gray-600">
            Complete Google sign-in here, then return to MolarPlus.
          </p>
        </div>
        {error && (
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopAuthStart;
