import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, ArrowRight, X } from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { SUPPORT_PHONE_RAW } from '../../constants/support';

/**
 * A strip under the header when the plan needs attention.
 *
 * Two jobs, and they are deliberately different in tone:
 *
 *   the last three days   amber, dismissible, easy to ignore. A renewal that is
 *                         about to happen is not a problem yet, and treating it
 *                         like one teaches people to ignore the red one too.
 *   already stopped       red, not dismissible. The clinic is view only and
 *                         needs to know why before it tries to save something.
 *
 * The state and its wording come from the server (`core/plan_state.py`), which
 * is the same source the middleware enforces from. The header cannot say
 * "everything is fine" while a write is being refused.
 *
 * Support is one tap away on both, because the state most likely to appear here
 * is a renewal we failed to take, which is as likely to be our fault as theirs.
 */

const BLOCKED = new Set(['trial_ended', 'lapsed', 'grant_ended']);
const WARNING = new Set(['renewal_due', 'grant_due']);

const PlanStatusBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const state = user?.clinic?.plan_state;
  if (!state || state === 'ok') return null;

  const isBlocked = BLOCKED.has(state);
  const isWarning = WARNING.has(state);
  if (!isBlocked && !isWarning) return null;
  if (isWarning && dismissed) return null;

  const title = user?.clinic?.plan_state_title
    || (isBlocked ? 'Your plan has stopped' : 'Your plan needs attention');

  const supportLink = `https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(
    [
      'Hi MolarPlus support, I need help with my plan.',
      user?.clinic?.name ? `Clinic: ${user.clinic.name}` : null,
      `Status: ${title}`,
    ].filter(Boolean).join('\n')
  )}`;

  const tone = isBlocked
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className={`flex flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 ${tone}`}>
      <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed sm:items-center">
        {isBlocked ? <Lock size={14} className="mt-0.5 shrink-0 sm:mt-0" />
          : <AlertTriangle size={14} className="mt-0.5 shrink-0 sm:mt-0" />}
        <span>
          {title}
          {/* A real separator, not just a margin. Without the character these
              two ran together as "endedYour clinic is view only" anywhere the
              CSS does not apply: copied text, and screen readers. */}
          {isBlocked && (
            <span className="font-normal opacity-80">
              {' · '}Your clinic is view only until you choose a plan.
            </span>
          )}
        </span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={supportLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-current/25 px-2.5 py-1.5 min-h-[2.25rem] text-[11px] font-semibold transition-opacity hover:opacity-75"
        >
          <WhatsAppIcon size={13} /> Support
        </a>
        <button
          onClick={() => navigate('/admin/subscription')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[2.25rem] text-[11px] font-bold text-white transition-colors ${
            isBlocked ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {isBlocked ? 'Choose a plan' : 'Manage plan'} <ArrowRight size={12} />
        </button>
        {/* Only the amber one can be waved away. */}
        {isWarning && (
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-opacity hover:opacity-60"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default PlanStatusBanner;
