import React, { useCallback, useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import InlineFeedback from '../../common/InlineFeedback';
import SectionError from '../../common/SectionError';
import Spinner from '../../common/Spinner';
import { notify } from '../../../utils/notify';
import { getFriendlyErrorMessage } from '../../../utils/api';

/**
 * Pick one thing on the patient's record and WhatsApp it to them.
 *
 * Three of the four WhatsApp menu actions are the same shape: fetch what this
 * patient already has, list it, and put a Send beside each row. Only the words
 * and the two functions differ, so they share this rather than existing three
 * times with three sets of near-identical bugs.
 *
 * A modal, not a drawer: nothing is being created here, an existing record is
 * being sent.
 *
 * Feedback follows the tiers in utils/notify.js. A send that succeeds is
 * invisible by nature, the message left for somebody else's phone, so it earns
 * the toast (`notify.sent`) and the row keeps a quiet "Sent" so the list still
 * reads correctly after the toast has gone. A send that fails has a control to
 * attach itself to, so it goes inline on that row instead of interrupting.
 *
 * Props:
 *   open, onClose
 *   title, subtitle, emptyTitle, emptySubtitle
 *   load()            async () => rows
 *   describe(row)     { key, primary, secondary, trailing? } for one line
 *   send(row)         async; throws to fail the row
 *   sentMessage(row)  the toast sentence for a successful send
 */
const SendListModal = ({
  open,
  onClose,
  title,
  subtitle,
  emptyTitle = 'Nothing to send yet',
  emptySubtitle,
  load,
  describe,
  send,
  sentMessage,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // id -> 'sending' | 'sent' | an error sentence. One map rather than three
  // pieces of state, so a row can only be in one of them at a time.
  const [state, setState] = useState({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setRows((await load()) || []);
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, "We couldn't load this list."));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setState({});
    fetchRows();
  }, [open, fetchRows]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSend = async (row) => {
    const { key } = describe(row);
    setState((s) => ({ ...s, [key]: 'sending' }));
    try {
      await send(row);
      setState((s) => ({ ...s, [key]: 'sent' }));
      notify.sent(sentMessage(row));
    } catch (err) {
      console.error('WhatsApp send failed:', err);
      setState((s) => ({
        ...s,
        [key]: getFriendlyErrorMessage(err, "That didn't send. Please try again."),
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Loading
            </div>
          )}

          {!loading && loadError && (
            <SectionError title={loadError} onRetry={fetchRows} className="border-0" />
          )}

          {!loading && !loadError && rows.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-base font-semibold text-gray-900">{emptyTitle}</p>
              {emptySubtitle && <p className="text-sm text-gray-500 mt-1">{emptySubtitle}</p>}
            </div>
          )}

          {!loading && !loadError && rows.map((row) => {
            const { key, primary, secondary, trailing } = describe(row);
            const rowState = state[key];
            const sending = rowState === 'sending';
            const sent = rowState === 'sent';
            const error = rowState && !sending && !sent ? rowState : '';

            return (
              <div key={key} className="px-2 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{primary}</p>
                    {secondary && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{secondary}</p>
                    )}
                  </div>

                  {trailing && (
                    <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{trailing}</span>
                  )}

                  {/* Stays pressable after a success. Sending the same bill a
                      second time is a normal thing to want, and a button that
                      disables itself forever reads as an error. */}
                  <button
                    type="button"
                    onClick={() => handleSend(row)}
                    disabled={sending}
                    className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 min-w-[6rem] rounded-lg text-sm font-semibold border transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e] ${
                      sending
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : sent
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer'
                          : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    {sending && <><Spinner className="w-3.5 h-3.5" /> Sending</>}
                    {!sending && sent && <><Check size={15} /> Sent</>}
                    {!sending && !sent && <><WhatsAppIcon size={15} brand /> Send</>}
                  </button>
                </div>

                {error && <InlineFeedback className="mt-1.5 pl-0.5">{error}</InlineFeedback>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SendListModal;
