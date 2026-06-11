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
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email) || loading) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error) {
      // Backend returns a generic success even for unknown emails; only network
      // / server errors land here.
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
                If an account exists for <span className="font-semibold">{email}</span>, we've sent a link to
                reset your password. The link expires in 1 hour.
              </p>
              <p className="text-sm text-gray-500">
                Didn't get it? Check your spam folder, or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-[#2a276e] hover:text-[#1a1548] font-semibold underline"
                >
                  try again
                </button>.
              </p>
              <Link to="/login" className="inline-block text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot your password?</h2>
                <p className="text-gray-600">
                  Enter the email linked to your account and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <ValidatedInput
                  label="Email"
                  id="forgot-email"
                  type="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isValid={isValidEmail(email)}
                  errorText="Enter a valid email address"
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || !isValidEmail(email)}
                  className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? "Sending..." : "Send reset link"}
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
