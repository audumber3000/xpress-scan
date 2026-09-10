import React, { useState } from 'react';
import { Check, Copy, Send, UserPlus, X } from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';

/**
 * "They're in — here is what to give them."
 *
 * Centred, not a drawer. Drawers are for creating something; this is the
 * confirmation of a thing already done, which is an alert, and the house rule
 * puts those in the middle of the screen.
 *
 * ─── Why this exists at all ─────────────────────────────────────────────────
 *
 * Adding somebody used to end in silence. Worse than silence: the refresh that
 * followed the save blanked the page for a moment, which unmounted the add
 * drawer and then mounted a fresh one, so pressing "Add" appeared to dump you
 * back into an empty create form. Nothing said the person had been created,
 * and the natural next move was to fill it in and press Add again.
 *
 * So the end of the flow is now explicit, and it carries the one thing the
 * owner actually needs next: the credentials to hand over. The invitation is
 * on its way by email and WhatsApp, but that is somebody else's infrastructure
 * and it can be slow or silently dropped. What is on this screen cannot be.
 *
 * The password is shown in the clear on purpose. It was chosen thirty seconds
 * ago by the person reading it, for somebody standing next to them; hiding it
 * behind dots here would protect nothing and would mean the only copy lives in
 * a message that may not arrive.
 *
 * Props:
 *   staff  { name, loginId, password, email, phone, invitation }
 *   onAddAnother, onClose
 */

const StaffAddedModal = ({ staff, onAddAnother, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (!staff) return null;

  const firstName = (staff.name || '').trim().split(' ')[0] || 'They';

  const details =
    `${staff.name} — your MolarPlus sign-in\n` +
    `Login: ${staff.loginId}\n` +
    `Password: ${staff.password}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright (insecure origin, denied
      // permission). The details are right there to read off, so this is a
      // nudge, not an error worth a toast.
      setCopyFailed(true);
    }
  };

  const sending = [
    staff.invitation?.email === 'sending' && staff.email,
    staff.invitation?.whatsapp === 'sending' && `WhatsApp on ${staff.phone}`,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-added-title"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-7 pb-5 text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
            <Check size={22} strokeWidth={3} className="text-emerald-600" />
          </div>
          <h3 id="staff-added-title" className="mt-3 text-lg font-semibold text-gray-900">
            {staff.name} is in
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Give {firstName} these details and they can sign in right now.
          </p>
        </div>

        <div className="px-6 pb-5">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-gray-200 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sign-in details
              </span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#29828a] hover:text-[#216b71]"
              >
                {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <dl className="divide-y divide-gray-100">
              <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                <dt className="text-sm text-gray-500 shrink-0">Login</dt>
                <dd className="text-sm font-medium text-gray-900 break-all text-right">
                  {staff.loginId}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                <dt className="text-sm text-gray-500 shrink-0">Password</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono break-all text-right">
                  {staff.password}
                </dd>
              </div>
            </dl>
          </div>

          {copyFailed && (
            <p className="mt-2 text-xs text-gray-400">
              Your browser blocked the clipboard. Read them off above instead.
            </p>
          )}

          {/* Honest about tense: the sends run after the save, so this is what
              is on its way, not what has landed. */}
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-3">
            {sending.length ? (
              <>
                <Send size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Sending the same details to {sending.join(' and ')}.
                </p>
              </>
            ) : (
              <>
                <WhatsAppIcon size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  No email or WhatsApp number on file, so nothing was sent. Hand these over
                  yourself.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onAddAnother}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <UserPlus size={15} /> Add another
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffAddedModal;
