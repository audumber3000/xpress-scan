import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { UserPlus, Tag, Users, ChevronRight, PartyPopper, X } from 'lucide-react';

// One-time getting-started steps shown right after onboarding.
const STEPS = [
  {
    icon: UserPlus,
    title: 'Add your first patient',
    desc: 'Create a record and start charting in seconds',
    to: '/patients',
    tint: 'bg-[#2a276e]/10 text-[#2a276e]',
  },
  {
    icon: Tag,
    title: 'Set your treatment prices',
    desc: 'So invoices fill themselves in',
    to: '/admin/treatments',
    tint: 'bg-[#29828a]/10 text-[#29828a]',
  },
  {
    icon: Users,
    title: 'Invite your team',
    desc: 'Add doctors and front-desk staff',
    to: '/admin/staff',
    tint: 'bg-amber-100 text-amber-600',
  },
];

const fireConfetti = () => {
  const colors = ['#2a276e', '#9B8CFF', '#29828a', '#F59E0B', '#22c55e'];
  confetti({ particleCount: 110, spread: 80, startVelocity: 42, origin: { y: 0.4 }, colors, zIndex: 100000 });
};

/**
 * Warm one-time welcome shown the first time a user lands on the dashboard
 * after completing onboarding. Carries a soft "get the app" nudge so the
 * separate DeviceUpsellModal can stay quiet on this first session.
 */
const WelcomeChecklistModal = ({ open, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    fireConfetti();
  }, [open]);

  if (!open) return null;

  const go = (to) => {
    onClose?.();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-celebrate-overlay">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-celebrate-pop">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#2a276e] to-[#403bb1] px-8 pt-9 pb-12 text-center text-white">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <PartyPopper className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to MolarPlus! 🎉</h2>
          <p className="mt-1.5 text-sm text-white/80">
            Your clinic is ready. Here are three quick ways to get rolling.
          </p>
        </div>

        {/* Checklist */}
        <div className="px-6 pt-6 pb-7 -mt-6 bg-white rounded-t-3xl relative">
          <div className="space-y-2.5">
            {STEPS.map(({ icon: Icon, title, desc, to, tint }) => (
              <button
                key={title}
                onClick={() => go(to)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-[#2a276e]/30 hover:shadow-sm transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Soft app nudge — real store badges */}
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs font-semibold text-gray-700">Take your clinic with you</p>
            <p className="text-xs text-gray-400 mt-0.5">Capture photos & check today's schedule on the go</p>
            <div className="mt-3 flex gap-3 items-center justify-center">
              <a
                href="https://apps.apple.com/app/molarplus"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/app-store.svg" alt="Download on the App Store" className="h-10 w-auto" />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.molarplus.app&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/google-play.svg" alt="Get it on Google Play" className="h-[3.1rem] w-auto" />
              </a>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full py-3.5 rounded-xl bg-[#2a276e] text-white font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
          >
            Go to my dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeChecklistModal;
