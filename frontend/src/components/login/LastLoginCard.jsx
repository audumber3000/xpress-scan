import { useState, useEffect } from 'react';
import { getLastLogin, maskEmail } from '../../utils/lastLogin';

const PROVIDER_LABEL = { google: 'Google', apple: 'Apple', email: 'Email' };

const ProviderIcon = ({ provider }) => {
  if (provider === 'google') {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    );
  }
  if (provider === 'apple') {
    return (
      <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
        <span className="text-white text-xs leading-none"></span>
      </div>
    );
  }
  // email
  return (
    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
  );
};

/**
 * LastLoginCard — shows a quick "Continue as …" card on login/signup pages
 * if the user previously signed in on this browser.
 *
 * @param {'login'|'register'} variant - controls heading text
 * @param {(provider: string) => void} onContinue - called with the stored provider
 * @param {boolean} loading - shows spinner in place of chevron
 */
const LastLoginCard = ({ variant = 'login', onContinue, loading = false }) => {
  const [last, setLast] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const entry = getLastLogin();
    setLast(entry);
  }, []);

  if (!last || dismissed) return null;

  const heading = variant === 'register' ? 'Already signed up?' : 'Welcome back';

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500 ml-1">{heading}</p>
      <button
        type="button"
        onClick={() => onContinue(last.provider)}
        disabled={loading}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all disabled:opacity-60"
      >
        <ProviderIcon provider={last.provider} />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 truncate">
            Continue as <span className="font-bold">{maskEmail(last.email)}</span>
          </p>
          <p className="text-xs text-gray-500">
            Last signed in with {PROVIDER_LABEL[last.provider] || last.provider}
          </p>
        </div>
        {loading ? (
          <svg className="animate-spin h-4 w-4 text-[#2a276e]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        ) : (
          <span className="text-gray-400 text-lg">›</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="block mx-auto text-xs font-semibold text-[#2a276e] hover:underline"
      >
        Use a different account
      </button>
    </div>
  );
};

export default LastLoginCard;
