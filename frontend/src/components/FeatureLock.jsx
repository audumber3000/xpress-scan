import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Lock, Zap, Sparkles } from 'lucide-react';
import TrialCelebrationModal from './TrialCelebrationModal';

/**
 * FeatureLock Wrapper
 * Blurs children and shows a lock overlay if the user is on the 'free' plan.
 * If the clinic has never used its free trial, the primary CTA becomes a
 * one-click "Start 7-day free trial"; the direct subscribe option stays too.
 */
const FeatureLock = ({ children, featureName = "This feature" }) => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [celebration, setCelebration] = useState(null); // { trialEndsAt, daysRemaining }

  const isLocked = user?.clinic?.subscription_plan === 'free';
  const trialAvailable = user?.clinic?.trial_available === true;

  const handleStartTrial = async () => {
    if (starting) return;
    try {
      setStarting(true);
      const res = await api.post('/subscriptions/start-trial');
      await refreshUser();
      setCelebration({
        trialEndsAt: res?.trial_ends_at || null,
        daysRemaining: res?.trial_days_remaining ?? 7,
      });
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Could not start your trial. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  // The celebration must persist across the lock→unlock transition, so it's
  // rendered alongside whichever state (locked overlay or unlocked children).
  const celebrationModal = (
    <TrialCelebrationModal
      open={!!celebration}
      trialEndsAt={celebration?.trialEndsAt}
      daysRemaining={celebration?.daysRemaining}
      onClose={() => setCelebration(null)}
    />
  );

  if (!isLocked) {
    return (
      <>
        {children}
        {celebrationModal}
      </>
    );
  }

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

          <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
            Unlock {featureName}
          </h3>

          {trialAvailable ? (
            <>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Get <span className="font-bold text-[#2a276e]">full Professional access free for 7 days</span>.
                No card, no commitment — see everything {featureName.toLowerCase()} can do.
              </p>

              <button
                onClick={handleStartTrial}
                disabled={starting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#2a276e] to-[#403bb1] text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.05] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 transition-all animate-shine"
              >
                <Sparkles className="w-5 h-5 fill-current" />
                {starting ? 'Activating…' : 'Start 7-day free trial'}
              </button>

              <button
                onClick={() => navigate("/subscription")}
                className="mt-3 text-sm font-semibold text-gray-500 hover:text-[#2a276e] transition-colors"
              >
                Or subscribe directly →
              </button>
            </>
          ) : (
            <>
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
            </>
          )}

          <p className="mt-4 text-xs text-gray-400 font-medium">
            Join 500+ clinics using MolarPlus Pro
          </p>
        </div>
      </div>

      {celebrationModal}
    </div>
  );
};

export default FeatureLock;
