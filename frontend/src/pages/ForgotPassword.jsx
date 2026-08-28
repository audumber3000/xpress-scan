import React, { useState } from "react";
import { Link } from "react-router-dom";
import { notify } from '../utils/notify';
import { api } from '../utils/api';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isValidEmail } from '../utils/validators';
import loginImage from '../assets/login-page-left-side.png';
import PublicSupportButton from '../components/PublicSupportButton';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import { SUPPORT_EMAIL, SUPPORT_PHONE_RAW } from '../constants/support';

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null); // null | { found, name, clinic_name, has_password }
  const [sent, setSent] = useState(false);
  // What the mail will actually arrive as. Taken from the server rather than
  // guessed here, because telling somebody to search their spam for the wrong
  // sender is worse than not naming one at all.
  const [delivery, setDelivery] = useState(null);   // { from_email, subject }

  const account = preview?.found ? preview : null;
  const notFound = preview != null && !preview.found;
  // Whether we already hold a password for them. Informational only now: the
  // backend sends a link either way, and for an account with no password on
  // our side the link sets one. Used just to word the confirmation honestly.
  const settingFirstPassword = !!account && account.has_password === false;

  // Step 1 — confirm the account exists and show whose it is.
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email) || previewLoading) return;
    setPreviewLoading(true);
    try {
      const res = await api.post('/auth/account-preview', { email: email.trim() });
      // `api.post` already returns the parsed body, not an axios-style
      // { data } envelope. Reading res.data here made every lookup undefined,
      // so this page told EVERY customer "we couldn't find an account with
      // that email" and never showed the send button at all. Web password
      // recovery was a dead end for everyone, and a locked-out dentist was
      // being invited to create a second clinic instead.
      setPreview(res || { found: false });
    } catch (error) {
      setPreview({ found: false });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 2 — send the reset link for the confirmed account.
  const handleSend = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Always our own backend, never Firebase. Firebase sends from
      // noreply@<project>.firebaseapp.com, which has no SPF or DKIM alignment
      // to our domain and no relationship to any other mail this product
      // sends, so those messages went to spam. A reset link in the spam folder
      // is the same as no reset link at all.
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setDelivery(res || null);
      setSent(true);
    } catch (error) {
      notify.problem(error, 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <PublicSupportButton />
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={loginImage} alt="MolarPlus" className="w-full h-full object-cover" />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 py-8">
          {sent ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Check your inbox</h2>
              <p className="text-gray-600">
                We've sent a link to reset your password to <span className="font-semibold">{email}</span>.
                The link expires in 1 hour.
              </p>
              {/* Named, not just "check spam". A person scanning a spam folder
                  full of mail is looking for something specific, and the two
                  things they can actually search on are who it is from and what
                  it is called. */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-gray-700">Not in your inbox?</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Check your spam or junk folder. Search for{' '}
                  <span className="font-semibold text-gray-800">{delivery?.from_email || SUPPORT_EMAIL}</span>
                  {' '}or the subject{' '}
                  <span className="font-semibold text-gray-800">
                    "{delivery?.subject || 'Reset your MolarPlus password'}"
                  </span>.
                  Marking it as "not spam" means the next one reaches you.
                </p>
                <p className="text-sm text-gray-500">
                  Still nothing?{' '}
                  <button
                    onClick={() => { setSent(false); setPreview(null); setDelivery(null); }}
                    className="text-[#2a276e] hover:text-[#1a1548] font-semibold underline"
                  >
                    Try again
                  </button>
                  {' '}or{' '}
                  <a
                    href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(
                      `Hi MolarPlus support, I asked for a password reset link for ${email.trim()} and it has not arrived.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#2a276e] hover:text-[#1a1548] font-semibold underline"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" /> message us
                  </a>.
                </p>
              </div>
              <Link to="/login" className="inline-block text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold">
                ← Back to sign in
              </Link>
            </div>
          ) : account ? (
            /* Step 2 — confirm the matched account */
            <>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Is this your account?</h2>
                <p className="text-gray-600">Confirm the account below to get a password reset link.</p>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
                <div className="w-12 h-12 rounded-full bg-[#2a276e] text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {(account.name || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{account.name || 'Your account'}</p>
                  {account.clinic_name && (
                    <p className="text-sm text-gray-600 truncate">{account.clinic_name}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate">{email.trim()}</p>
                </div>
              </div>

              {/* No dead end for a Google account any more. The link sets a
                  password rather than resetting one, which is a thing they may
                  well want: it is what lets them sign in on the desktop app, or
                  on a machine where the Google pop-up is blocked. */}
              {settingFirstPassword && (
                <p className="text-sm text-gray-500">
                  You currently sign in with Google. This link lets you set a password as well, so
                  you can sign in either way. Continuing with Google will keep working.
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={loading}
                className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
              >
                {loading ? "Sending..." : settingFirstPassword ? "Send me a link" : "Send reset link"}
              </button>

              <div className="text-center">
                <button
                  onClick={() => setPreview(null)}
                  className="text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold"
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
            /* Step 1 — enter email */
            <>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot your password?</h2>
                <p className="text-gray-600">
                  Enter the email linked to your account and we'll find it for you.
                </p>
              </div>

              <form onSubmit={handleLookup} className="space-y-4">
                <ValidatedInput
                  label="Email"
                  id="forgot-email"
                  type="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (preview) setPreview(null); }}
                  isValid={isValidEmail(email)}
                  errorText="Enter a valid email address"
                  autoComplete="email"
                  required
                />

                {notFound && (
                  <p className="text-sm text-red-500">
                    We couldn't find an account with that email. Double-check it, or{' '}
                    <Link to="/signup" className="font-semibold underline">create a new clinic</Link>.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={previewLoading || !isValidEmail(email)}
                  className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
                >
                  {previewLoading ? "Searching..." : "Find my account"}
                </button>
              </form>

              <div className="text-center">
                <Link to="/login" className="text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold">
                  ← Back to sign in
                </Link>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Note: this only works for accounts created with email &amp; password. If you signed up with Google,
                use “Continue with Google” on the sign-in page.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
