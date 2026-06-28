import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Zap } from 'lucide-react';

/**
 * FeatureLock — multi-branch upgrade gate.
 *
 * A single clinic is fully free (staff, attendance, reports, consent, etc.).
 * The ONLY premium capability is running more than one branch, so this wrapper
 * is used solely around the "Add Branch" flow. Free plans see the upgrade
 * overlay; paid plans pass straight through.
 */
const FeatureLock = ({ children, featureName = "Multiple branches" }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Until we positively know the plan, treat as locked so premium content never
  // flashes before the gate kicks in.
  const plan = user?.clinic?.subscription_plan;
  const planKnown = plan != null;
  const isLocked = planKnown ? plan === 'free' : true;

  if (loading && (!planKnown || isLocked)) {
    return (
      <div className="min-h-[400px] w-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2a276e]/30 border-t-[#2a276e] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative min-h-[400px] w-full overflow-hidden rounded-xl">
      {/* Blurred Content */}
      <div className="filter blur-[6px] pointer-events-none select-none opacity-50 transition-all duration-500">
        {children}
      </div>

      {/* Upgrade Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-white/10 backdrop-blur-[2px] animate-in fade-in duration-700">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 max-w-sm w-full text-center transform transition-all hover:scale-[1.02] duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-[#2a276e] to-[#403bb1] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200/50">
            <Building2 className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
            Add more branches
          </h3>

          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Your single clinic is <span className="font-bold text-[#2a276e]">free forever</span> — every
            feature included. Running <span className="font-bold text-[#2a276e]">multiple branches</span> from
            one account is our only premium upgrade.
          </p>

          <button
            onClick={() => navigate("/subscription")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#2a276e] to-[#403bb1] text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.05] active:scale-95 transition-all animate-shine"
          >
            <Zap className="w-5 h-5 fill-current" />
            Upgrade to add branches
          </button>

          <p className="mt-4 text-xs text-gray-400 font-medium">
            Manage all your clinics from one login
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeatureLock;
