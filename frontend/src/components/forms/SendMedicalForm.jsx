import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList, Copy, Check, Loader2, Tablet, X, CheckCircle2, Clock, FileText,
} from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { notify } from '../../utils/notify';
import { formatDate } from '../../utils/datetime';

/**
 * Send this patient the medical history, from wherever the front desk is.
 *
 * One component in two places on purpose — the moment a patient is registered,
 * and the moment they are booked in. Two copies of this logic would drift, and
 * the second one would be the one that forgot the tablet.
 *
 * It says what is already true before it offers to do anything. A control that
 * reads "Send medical form" on a patient who signed one last week is asking
 * staff to send a duplicate, and on an appointment card it is worse than
 * useless: the question a doctor has with the patient in the waiting room is
 * "do we have their history", and the answer was sitting one request away.
 *
 * So there are three resting states, and only the last one is a plain button:
 *
 *   signed    the history is on file, with the date and a way to read it
 *   pending   a link is out and unanswered, with the option to send another
 *   none      nothing on file, send it
 *
 * The tablet route is not a nicety. A large share of patients will not open a
 * WhatsApp link before they sit down, and a form that only works over WhatsApp
 * is one the receptionist ends up reading aloud.
 */
const SendMedicalForm = ({ patientId, patientName, patientPhone, variant = 'button',
                          templates: given, onSent }) => {
  const [template, setTemplate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [whatsapping, setWhatsapping] = useState(false);
  const [opening, setOpening] = useState(false);

  const pick = (rows) =>
    (Array.isArray(rows) ? rows : []).find((t) => t.kind === 'medical_history' && t.is_active) || null;

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    try {
      // `given` is for callers that already hold the template list; the
      // patient's own forms always have to be fetched, since that is the part
      // that differs per row.
      const [tpl, sent] = await Promise.all([
        given ? Promise.resolve(given) : api.get('/forms/templates').catch(() => []),
        api.get(`/forms/patient/${patientId}`).catch(() => []),
      ]);
      setTemplate(pick(tpl));
      setHistory((Array.isArray(sent) ? sent : []).filter((s) => s.kind === 'medical_history'));
    } finally {
      setLoading(false);
    }
  }, [patientId, given]);

  useEffect(() => { load(); }, [load]);

  // No medical form set up yet. Silent rather than a prompt to go and build
  // one: this appears beside unrelated work, and a clinic that has not set one
  // up does not want to be told so every time it opens an appointment.
  if (loading || !template) return null;

  const signed = history.find((h) => h.status === 'submitted' || h.status === 'applied');
  const pending = history.find((h) => (h.status === 'sent' || h.status === 'opened') && !h.expired);
  const url = link ? `${window.location.origin}/form/fill/${link.token}` : '';

  const send = async () => {
    setSending(true);
    try {
      const res = await api.post(`/forms/patient/${patientId}/send`, { template_id: template.id });
      setLink(res);
      setCopied(false);
      onSent?.(res);
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not create the form link.'));
    } finally { setSending(false); }
  };

  const sendWhatsApp = async () => {
    if (!link) return;
    setWhatsapping(true);
    try {
      const res = await api.post('/forms/send-whatsapp', {
        submission_id: link.id,
        app_origin: window.location.origin,
      });
      // The endpoint answers honestly when the clinic never switched
      // patient-form messages on. Reporting that as a success is how staff stop
      // chasing a patient nobody actually messaged.
      if (res?.sent) notify.sent(`Medical form sent to ${patientName || 'the patient'} on WhatsApp`);
      else notify.problem(res?.message || 'That message could not be sent. The link above still works.');
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not send that WhatsApp message.'));
    } finally { setWhatsapping(false); }
  };

  const viewSigned = async () => {
    setOpening(true);
    try {
      const res = await api.get(`/forms/submissions/${signed.id}/pdf`);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch {
      notify.problem('That signed copy could not be opened. The answers are on the patient file.');
    } finally { setOpening(false); }
  };

  // ── A link was just made: how to get it to them ─────────────────────────
  if (link) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-emerald-900">
            Medical form ready for {patientName || 'this patient'}
          </p>
          <button onClick={() => setLink(null)} aria-label="Close"
            className="p-0.5 text-emerald-700/60 hover:text-emerald-900 shrink-0">
            <X size={14} />
          </button>
        </div>
        <p className="mt-0.5 text-[11.5px] text-emerald-800/80">
          The link works once and expires in {link.expires_in_hours || 24} hours.
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {patientPhone && (
            <button onClick={sendWhatsApp} disabled={whatsapping}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-[12px] font-semibold hover:brightness-95 disabled:opacity-50">
              {whatsapping ? <Loader2 size={12} className="animate-spin" /> : <WhatsAppIcon className="w-3.5 h-3.5" />}
              WhatsApp it
            </button>
          )}
          <a href={`/form/fill/${link.token}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 text-[12px] font-semibold hover:bg-emerald-100">
            <Tablet size={12} /> Fill in here
          </a>
          <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); notify.sent('Link copied'); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 text-[12px] font-semibold hover:bg-emerald-100">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    );
  }

  // ── Already signed ──────────────────────────────────────────────────────
  if (signed) {
    return (
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-800 min-w-0">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          <span className="truncate">
            Medical history on file
            {signed.submitted_at ? ` · ${formatDate(signed.submitted_at)}` : ''}
          </span>
        </span>
        {signed.has_pdf && (
          <button type="button" onClick={viewSigned} disabled={opening}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-[12px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e] transition disabled:opacity-50">
            {opening ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} View
          </button>
        )}
        {/* Quiet on purpose. Re-sending is the rare case here — a patient whose
            health has changed — so it must be available without competing with
            the fact that the history is already on file. */}
        <button type="button" onClick={send} disabled={sending}
          className="text-[12px] font-semibold text-gray-500 hover:text-[#2a276e] hover:underline disabled:opacity-50">
          {sending ? 'Working…' : 'Send again'}
        </button>
      </div>
    );
  }

  // ── Sent, still waiting ─────────────────────────────────────────────────
  if (pending) {
    return (
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800 min-w-0">
          <Clock size={14} className="shrink-0 text-amber-600" />
          <span className="truncate">
            Form sent{pending.sent_at ? ` ${formatDate(pending.sent_at)}` : ''}, not filled in yet
          </span>
        </span>
        <button type="button" onClick={send} disabled={sending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-[12px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e] transition disabled:opacity-50">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <ClipboardList size={12} />}
          Send a new link
        </button>
      </div>
    );
  }

  // ── Nothing on file ─────────────────────────────────────────────────────
  if (variant === 'icon') {
    return (
      <button
        type="button" onClick={send} disabled={sending}
        title="Send the medical form" aria-label="Send the medical form"
        className="w-9 h-9 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#2a276e] hover:text-[#2a276e] transition-colors disabled:opacity-50"
      >
        {sending ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />}
      </button>
    );
  }

  return (
    <button
      type="button" onClick={send} disabled={sending}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e] transition disabled:opacity-50"
    >
      {sending ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
      Send medical form
    </button>
  );
};

export default SendMedicalForm;
