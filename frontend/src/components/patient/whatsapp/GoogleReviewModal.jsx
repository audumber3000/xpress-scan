import React, { useCallback, useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import GoogleGlyph from '../../common/GoogleGlyph';
import InlineFeedback from '../../common/InlineFeedback';
import SectionError from '../../common/SectionError';
import Spinner from '../../common/Spinner';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import { formatDate } from '../../../utils/datetime';
import { isManualWhatsApp, shareReviewRequestManually } from '../../../utils/whatsapp';

/**
 * Ask this patient for a Google review.
 *
 * One ask rather than a list, so this is its own dialog instead of a
 * SendListModal with a single row. What it mostly does is tell the truth before
 * anybody presses anything: whether a listing is even connected, and whether
 * this patient was already asked recently.
 *
 * It reports the cooldown, it does not enforce it. The 90 days exist to stop
 * the automatic ask that fires on payment from nagging people. Somebody
 * standing at the desk with a happy patient knows something the rule does not,
 * so they are told the date and allowed to go ahead.
 */
const GoogleReviewModal = ({ open, onClose, patient, user }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setStatus(await api.get(`/patients/${patient.id}/google-review`));
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, "We couldn't check this patient's review history."));
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setSendError('');
    fetchStatus();
  }, [open, fetchStatus]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const manual = isManualWhatsApp(user);

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      if (manual) {
        // Own-number mode: no backend send, no wallet charge. The whole message
        // is the link, so WhatsApp opens with it already written.
        const opened = shareReviewRequestManually(patient, status.review_link, user);
        if (!opened) throw new Error("This patient's number can't be opened in WhatsApp.");
        notify.sent(`WhatsApp opened with the review link for ${patient.name}.`);
      } else {
        await api.post(`/patients/${patient.id}/google-review`);
        notify.sent(`Review request sent to ${patient.name} on WhatsApp.`);
      }
      setSent(true);
    } catch (err) {
      console.error('Review request failed:', err);
      setSendError(getFriendlyErrorMessage(err, "That didn't send. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const connected = !!status?.listing_connected;
  const canSend = connected && !!status?.has_phone;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-tight">Ask for a Google review</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              A short message to {patient?.name} with a link to your listing.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Checking
            </div>
          )}

          {!loading && loadError && (
            <SectionError title={loadError} onRetry={fetchStatus} className="border-0" />
          )}

          {!loading && !loadError && (
            <>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200">
                <span className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <GoogleGlyph size={17} />
                </span>
                <div className="min-w-0 text-sm">
                  {!connected && (
                    <p className="text-gray-700">
                      No Google listing is connected yet, so there is no review link to send.
                      Connect one in Integrations, then come back here.
                    </p>
                  )}
                  {connected && !status.has_phone && (
                    <p className="text-gray-700">
                      This patient has no phone number on file, so there is nowhere to send it.
                    </p>
                  )}
                  {canSend && (
                    <>
                      <p className="text-gray-700">
                        {status.last_asked_at
                          ? `Last asked on ${formatDate(status.last_asked_at)}.`
                          : 'This patient has not been asked before.'}
                      </p>
                      {status.within_cooldown && (
                        <p className="text-amber-700 mt-1">
                          That is inside the {status.cooldown_days} day gap the automatic ask
                          keeps. You can still send it.
                        </p>
                      )}
                      <a
                        href={status.review_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#2a276e] hover:underline mt-2"
                      >
                        Preview the link <ExternalLink size={12} />
                      </a>
                    </>
                  )}
                </div>
              </div>

              {sendError && <InlineFeedback className="mt-3">{sendError}</InlineFeedback>}
              {sent && (
                <InlineFeedback tone="success" className="mt-3">
                  {manual
                    ? 'WhatsApp is open with the message ready to send.'
                    : 'On its way.'}
                </InlineFeedback>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending || loading}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors ${
              !canSend || sending || loading
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-transparent bg-[#2a276e] text-white hover:bg-[#1a1548] cursor-pointer'
            }`}
          >
            {sending ? <><Spinner className="w-3.5 h-3.5" /> Sending</> : <><WhatsAppIcon size={15} /> {sent ? 'Send again' : 'Send the ask'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleReviewModal;
