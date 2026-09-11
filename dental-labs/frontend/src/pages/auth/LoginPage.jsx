import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FlaskConical, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.first_name}!`);
      navigate(user.lab_id ? "/" : "/onboarding");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Image/Brand */}
      <div className="hidden lg:block lg:w-[45%] xl:w-[40%] relative">
        <img 
          src="/auth-bg.png" 
          alt="MolarPlus Labs" 
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:flex-1 flex items-center justify-center bg-white p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 py-8">
          
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 text-[#2a276e]">
              <FlaskConical size={32} />
              <h1 className="text-2xl font-bold tracking-tight">MolarPlus Labs</h1>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to your lab account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lab.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit" 
              disabled={loading}
              className="w-full bg-[#2a276e] text-white py-3 px-4 rounded-lg hover:bg-[#1a1548] focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:ring-offset-2 disabled:opacity-50 font-semibold transition-colors shadow-sm mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#2a276e] hover:text-[#1a1548] font-bold">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
