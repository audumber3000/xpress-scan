import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isValidPassword } from '../utils/validators';
import loginImage from '../assets/login-page-left-side.png';
import PublicSupportButton from '../components/PublicSupportButton';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = !!token && isValidPassword(password) && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: password });
      toast.success('Password reset! Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'This reset link is invalid or has expired. Please request a new one.');
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
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Set a new password</h2>
            <p className="text-gray-600">Choose a strong password you haven't used before.</p>
          </div>

          {!token && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              This reset link is missing its token. Please use the link from your email, or{' '}
              <Link to="/forgot-password" className="underline font-semibold">request a new one</Link>.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <ValidatedInput
              label="New password"
              id="reset-password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isValidPassword(password)}
              errorText="Password must be at least 8 characters"
              autoComplete="new-password"
              required
            />
            <ValidatedInput
              label="Confirm new password"
              id="reset-confirm"
              type="password"
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              isValid={passwordsMatch}
              errorText="Passwords don't match"
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <div className="text-center">
            <Link to="/login" className="text-sm text-[#2a276e] hover:text-[#1a1548] font-semibold">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
