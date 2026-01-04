import React from 'react';
import LoadingButton from '../LoadingButton';

const EmailPasswordForm = ({ email, setEmail, password, setPassword, onSubmit, loading, error }) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
          placeholder="Enter your email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
          placeholder="Enter your password"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <LoadingButton
        type="submit"
        loading={loading}
        className="w-full bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        Login
      </LoadingButton>
    </form>
  );
};

export default EmailPasswordForm;


