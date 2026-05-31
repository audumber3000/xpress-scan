import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot,
  MessageCircle,
  Users,
  FlaskConical,
  Package,
  Headphones,
  Sparkles,
  CalendarClock,
  X,
} from 'lucide-react';

// The highest-value Pro-only features (the ones locked on the Free plan) —
// keep this short and punchy so the popup stays scannable.
const UNLOCKED_FEATURES = [
  { icon: Bot,          label: 'AI Report Generation', desc: 'Draft clinical reports in seconds' },
  { icon: MessageCircle, label: 'WhatsApp Reminders',   desc: 'Auto reminders & consent links' },
  { icon: Users,        label: 'Staff & Multi-user',   desc: 'Invite your whole team' },
  { icon: FlaskConical, label: 'Lab Order Management',  desc: 'Track every lab case' },
  { icon: Package,      label: 'Inventory Management',  desc: 'Never run out of stock' },
  { icon: Headphones,   label: 'Priority Support',      desc: 'Jump the queue, anytime' },
];

const fireConfetti = () => {
  const end = Date.now() + 1200;
  const colors = ['#2a276e', '#9B8CFF', '#29828a', '#F59E0B', '#22c55e'];

  // Two side cannons firing inward — a clean, celebratory burst.
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors, zIndex: 100000 });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors, zIndex: 100000 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // One big center pop to kick things off.
  confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.35 }, colors, zIndex: 100000 });
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

/**
 * Full-screen celebration shown the moment a free trial is activated.
 */
const TrialCelebrationModal = ({ open, onClose, trialEndsAt, daysRemaining = 7, onExplore }) => {
  useEffect(() => {
    if (!open) return;
    fireConfetti();
    // A short second wave for extra delight.
    const t = setTimeout(fireConfetti, 600);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const endLabel = formatDate(trialEndsAt);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-celebrate-overlay">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-celebrate-pop">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header / hero */}
        <div className="relative bg-gradient-to-br from-[#2a276e] to-[#403bb1] px-8 pt-9 pb-12 text-center text-white">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">You're on Professional! 🎉</h2>
          <p className="mt-1.5 text-sm text-white/80">
            Your free trial is live — every premium tool is unlocked.
          </p>

          {/* Days-left chip */}
          <div className="mt-5 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full pl-2.5 pr-4 py-1.5">
            <CalendarClock className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-bold">{daysRemaining} days left</span>
            {endLabel && <span className="text-xs text-white/70">· ends {endLabel}</span>}
          </div>
        </div>

        {/* Features */}
        <div className="px-6 pt-6 pb-7 -mt-6 bg-white rounded-t-3xl relative">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            What you've unlocked
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {UNLOCKED_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60"
              >
                <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-[#2a276e]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={onExplore || onClose}
              className="w-full py-3.5 rounded-xl bg-[#2a276e] text-white font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
            >
              Start exploring
            </button>
            <p className="text-center text-xs text-gray-400">
              No card charged. We'll remind you before your trial ends.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialCelebrationModal;
