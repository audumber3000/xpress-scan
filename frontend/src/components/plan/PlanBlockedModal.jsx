import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, X } from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { SUPPORT_PHONE_RAW } from '../../constants/support';

/**
 * What a clinic sees when it tries to change something on a stopped plan.
 *
 * Mounted once, at the app root, and driven by the `plan:blocked` event that
 * utils/api.js fires on a 402. That way every blocked write produces the same
 * explanation wherever it came from, instead of each screen inventing its own
 * error toast.
 *
 * The words come from the SERVER, not from here. A trial that ended, a renewal
 * that failed and an introductory period that ran out are three different things
 * to the person reading, and core/plan_state.py decides which one this is. A generic
 * "please upgrade" would tell a paying customer whose card bounced that they
 * should start a trial.
 *
 * WhatsApp support is on every one of these on purpose. This modal appears at
 * the exact moment somebody is stuck, and the failure it most often reports —
 * a renewal we could not take — is as likely to be our fault as theirs.
 */

const TONES = {
  critical: { ring: 'bg-red-100', icon: 'text-red-600' },
  warning: { ring: 'bg-amber-100', icon: 'text-amber-600' },
  info: { ring: 'bg-[#2a276e]/10', icon: 'text-[#2a276e]' },
};

const PlanBlockedModal = () => {
  const [blocked, setBlocked] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onBlocked = (e) => setBlocked(e.detail);
    window.addEventListener('plan:blocked', onBlocked);
    return () => window.removeEventListener('plan:blocked', onBlocked);
  }, []);

  if (!blocked) return null;

  const tone = TONES[blocked.tone] || TONES.info;
  const supportLink = `https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(
    [
      'Hi MolarPlus support, my clinic is locked and I need help.',
      user?.clinic?.name ? `Clinic: ${user.clinic.name}` : null,
      blocked.title ? `Status: ${blocked.title}` : null,
    ].filter(Boolean).join('\n')
  )}`;

  const goToPlans = () => {
    setBlocked(null);
    navigate('/admin/subscription');
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={blocked.title || 'Your plan has stopped'}
    >
      <div className="w-full overflow-hidden rounded-t-3xl bg-white sm:max-w-md sm:rounded-2xl sm:shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 pb-0">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.ring}`}>
            <Lock size={19} className={tone.icon} />
          </div>
          {/* Dismissible: they may want to go and read something rather than
              pay this second, and trapping them achieves nothing. */}
          <button
            onClick={() => setBlocked(null)}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 pt-3">
          <h2 className="text-lg font-bold text-gray-900">
            {blocked.title || 'Your plan has stopped'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            {blocked.message}
          </p>

          <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-600">
            Your clinic is <strong>view only</strong> for now. Every patient record, invoice and
            report is still here and can be opened as usual. Nothing has been deleted.
          </p>

          <button
            onClick={goToPlans}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2a276e] px-5 py-3 min-h-[3rem] text-sm font-semibold text-white transition-colors hover:bg-[#1a1548]"
          >
            {blocked.cta || 'Choose a plan'} <ArrowRight size={16} />
          </button>

          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 min-h-[3rem] text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <WhatsAppIcon size={16} className="text-[#25D366]" /> Message support on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default PlanBlockedModal;
