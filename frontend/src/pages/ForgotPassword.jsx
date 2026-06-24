import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isValidEmail } from '../utils/validators';
import loginImage from '../assets/login-page-left-side.png';
import PublicSupportButton from '../components/PublicSupportButton';

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null); // null | { found, name, clinic_name, has_password }
  const [sent, setSent] = useState(false);

  const account = preview?.found ? preview : null;
  const notFound = preview != null && !preview.found;
  const googleOnly = !!account && account.has_password === false;

  // Step 1 — confirm the account exists and show whose it is.
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email) || previewLoading) return;
    setPreviewLoading(true);
    try {
      const res = await api.post('/auth/account-preview', { email: email.trim() });
      setPreview(res.data || { found: false });
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
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Something went wrong. Please try again.');
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
              <p className="text-sm text-gray-500">
                Didn't get it? Check your spam folder, or{' '}
                <button
                  onClick={() => { setSent(false); setPreview(null); }}
                  className="text-[#2a276e] hover:text-[#1a1548] font-semibold underline"
                >
                  try again
                </button>.
              </p>
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

              {googleOnly ? (
                <>
                  <p className="text-sm text-gray-500">
                    This account signs in with Google, so there's no password to reset. Use “Continue with Google”
                    on the sign-in page to log in.
                  </p>
                  <Link
                    to="/login"
                    className="block text-center w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] font-medium transition-colors"
                  >
                    Back to sign in
                  </Link>
                </>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              )}

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
