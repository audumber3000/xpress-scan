import React, { useState, useEffect } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import Spinner from '../../common/Spinner';
import { useIsDentalPatient } from '../../../utils/casePaper';

/**
 * Send a form to this patient, from the Documents tab.
 *
 * Sending lives beside the documents because what comes back IS a document —
 * the answered form files itself in the list below. A separate tab for it made
 * the same paperwork live in two places depending on whether it had been
 * answered yet.
 *
 * The link is shown as copyable text as well as sendable: a clinic with no
 * wallet balance still needs a way to hand the patient the form.
 */
const SendFormBar = ({ patientId, patient, onSent }) => {
  const [templates, setTemplates] = useState([]);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const isDental = useIsDentalPatient(patient);

  useEffect(() => {
    let off = false;
    api.get('/forms/templates')
      .then((t) => { if (!off) setTemplates(Array.isArray(t) ? t : []); })
      .catch(() => {});
    return () => { off = true; };
  }, []);

  // A form written for the other case paper is hidden, not greyed out:
  // offering a dental history to a skin patient is noise, not a choice.
  const usable = templates.filter(
    (t) => t.is_active && (!t.case_paper_type || t.case_paper_type === (isDental ? 'dental' : 'general'))
  );
  if (!usable.length) return null;

  const send = async (id) => {
    setSending(true);
    try {
      const res = await api.post(`/forms/patient/${patientId}/send`, { template_id: id });
      setLink(res);
      setCopied(false);
      onSent?.();
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not create the link.'));
    } finally { setSending(false); }
  };

  const url = link ? `${window.location.origin}/form/fill/${link.token}` : '';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-gray-500 mr-1">Send a form:</span>
        {usable.map((t) => (
          <button key={t.id} onClick={() => send(t.id)} disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[12px] font-medium hover:border-[#2a276e]/40 hover:bg-indigo-50/30 transition disabled:opacity-50">
            <Send size={12} /> {t.name}
          </button>
        ))}
        {sending && <Spinner className="w-3.5 h-3.5 text-gray-400" />}
      </div>

      {link && (
        <div className="mt-2.5 flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] text-gray-700">
            {url}
          </code>
          <button
            onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); notify.done('Link copied'); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-emerald-300 bg-white text-emerald-800 text-[12px] font-semibold hover:bg-emerald-100 shrink-0">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SendFormBar;
