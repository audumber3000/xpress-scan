import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingButton from '../components/LoadingButton';
import betterClinicLogo from '../assets/betterclinic-logo.png';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔵 [LOGIN] Starting email/password login...');
      
      // Send to backend for authentication
      const data = await api.post('/auth/login', { 
        email: email.trim(),
        password: password
      });

      // Store the JWT token
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Update auth context
      setToken(data.token);
      setUser(data.user);

      toast.success('Login successful!');

      // Small delay to ensure context is updated before navigation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Redirect based on user state
      const redirectPath = !data.user.clinic_id ? '/onboarding' : '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error('🔵 [LOGIN] Login error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md space-y-4">
        {/* Better Clinic Logo */}
        <div className="flex justify-center mb-6 overflow-hidden">
          <img 
            src={betterClinicLogo} 
            alt="Better Clinic Logo" 
            className="w-full h-32"
            style={{ 
              transform: 'scale(1.1)',
              objectFit: 'contain'
            }}
          />
        </div>
        
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
        {error && <div className="text-red-600 text-center mb-4 text-sm">{error}</div>}
        
        {/* Email/Password Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
              required
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
              required
              disabled={loading}
            />
          </div>
          
          <LoadingButton 
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full bg-[#6C4CF3] text-white px-4 py-3 rounded-lg hover:bg-[#5b3dd9] transition-colors font-medium shadow-sm disabled:opacity-50"
          >
            Sign In
          </LoadingButton>
        </form>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Use the email and password assigned by your clinic administrator
        </p>
        
        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-[#6C4CF3] hover:text-[#5b3dd9] font-medium">
            Sign up
          </Link>
        </p>
        
        {/* Branding */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Powered by <span className="text-[#6C4CF3] font-medium">BetterClinic</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
