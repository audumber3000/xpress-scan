import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Zap } from 'lucide-react';

/**
 * FeatureLock Wrapper
 * Blurs children and shows a lock overlay if the user is on the 'free' plan.
 */
const FeatureLock = ({ children, featureName = "This feature" }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isLocked = user?.clinic?.subscription_plan === 'free';

  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative min-h-[400px] w-full overflow-hidden rounded-xl">
      {/* Blurred Content */}
      <div className="filter blur-[6px] pointer-events-none select-none opacity-50 transition-all duration-500">
        {children}
      </div>

      {/* Glassmorphism Lock Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-white/10 backdrop-blur-[2px] animate-in fade-in duration-700">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 max-w-sm w-full text-center transform transition-all hover:scale-[1.02] duration-300">
          {/* Animated Lock Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200/50">
            <Lock className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
            Unlock {featureName}
          </h3>
          
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            This premium feature is part of our <span className="font-bold text-amber-600">Professional Plan</span>. 
            Upgrade now to streamline your clinic workflow.
          </p>

          <button
            onClick={() => navigate("/subscription")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#2a276e] to-[#403bb1] text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.05] active:scale-95 transition-all animate-shine"
          >
            <Zap className="w-5 h-5 fill-current" />
            Upgrade to Pro
          </button>
          
          <p className="mt-4 text-xs text-gray-400 font-medium">
            Join 500+ clinics using MolarPlus Pro
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeatureLock;
