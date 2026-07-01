import { useEffect, useState } from 'react';
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

  // Restart the whole flow (clears the pending flag so it re-triggers the redirect).
  const handleRetry = () => {
    sessionStorage.removeItem(PENDING_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-indigo-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        {/* Brand */}
        <div className="mb-7 flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2a276e] flex items-center justify-center text-white text-sm font-black">M</div>
          <span className="text-lg font-black tracking-tight text-[#2a276e]">MolarPlus</span>
        </div>

        {!error ? (
          <>
            {/* Spinner */}
            <div className="mx-auto mb-6 w-12 h-12 rounded-full border-[3px] border-[#2a276e]/15 border-t-[#2a276e] animate-spin" />
            <h1 className="text-lg font-bold text-gray-900">Signing you in with Google</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Finish the Google sign-in in this window — you'll be returned to the MolarPlus app automatically.
            </p>
            <p className="mt-5 text-xs text-gray-400">This usually takes just a few seconds.</p>
          </>
        ) : (
          <>
            {/* Error */}
            <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Sign-in didn't complete</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#2a276e] text-white font-semibold text-sm hover:bg-[#1a1548] transition-colors shadow-sm"
            >
              Try again
            </button>
            <p className="mt-3 text-xs text-gray-400">If it keeps happening, close this window and reopen the MolarPlus app.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default DesktopAuthStart;
