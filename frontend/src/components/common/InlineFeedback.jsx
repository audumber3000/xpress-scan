import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * A message that belongs to a control, shown next to that control.
 *
 * Tier 2 of the feedback rule in `utils/notify.js`. When somebody presses Save
 * and it fails, the reason belongs under the Save button, not in a card in the
 * corner of the screen. A failure they have to hunt for is a failure they will
 * read as "the app is broken" rather than "the phone number is already taken".
 *
 * This generalises what was already working by hand in MasterPasswordModal and
 * MasterPasswordCard, which are worth reading as the reference use.
 *
 * `role="alert"` so a screen reader announces it the moment it appears, which a
 * silently-inserted <p> would not.
 *
 * Props:
 *   tone      'error' | 'success' | 'warning'
 *   children  the message; keep it to a sentence
 *   icon      false to drop the glyph on very tight rows
 */
const TONES = {
  error:   { cls: 'text-red-600',     Icon: AlertCircle },
  success: { cls: 'text-emerald-600', Icon: CheckCircle2 },
  warning: { cls: 'text-amber-600',   Icon: AlertTriangle },
};

const InlineFeedback = ({ tone = 'error', children, icon = true, className = '' }) => {
  if (!children) return null;
  const { cls, Icon } = TONES[tone] || TONES.error;

  return (
    <p
      role="alert"
      className={`flex items-start gap-1.5 text-sm leading-relaxed ${cls} ${className}`}
    >
      {icon && <Icon size={14} className="shrink-0 mt-0.5" />}
      <span className="min-w-0">{children}</span>
    </p>
  );
};

export default InlineFeedback;
