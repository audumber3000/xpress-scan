import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Copy, Check, Tablet, ClipboardList, ShieldCheck, ExternalLink,
  CheckCircle2, Clock,
} from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import Spinner from '../../common/Spinner';
import InlineFeedback from '../../common/InlineFeedback';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import { formatDate } from '../../../utils/datetime';

/**
 * Send this patient the medical history, from the file header.
 *
 * Not a SendListModal, though it sits beside three of them. Those exist to pick
 * one record out of many the patient already has; there is exactly one medical
 * form and nothing to choose from. What this dialog has to answer instead is
 * the question staff actually have at the header: does this patient already
 * have a history on file, and is it recent enough to trust? So it opens by
 * saying that, and only then offers to send.
 *
 * Three ways out, because a link over WhatsApp is not the only way a form gets
 * filled in. A patient standing at the desk fills it on the clinic's tablet,
 * and a clinic with no wallet balance still needs something it can paste.
 */
const ACTION =
  'inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-lg border text-sm font-semibold ' +
  'transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]';

const SendMedicalFormModal = ({ open, onClose, patient }) => {
  const [template, setTemplate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // The Documents tab can render before the patient has loaded, so the
    // dialog is reachable a moment before there is an id to ask about.
    if (!patient?.id) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [templates, sent] = await Promise.all([
        api.get('/forms/templates'),
        api.get(`/forms/patient/${patient.id}`).catch(() => []),
      ]);
      const list = Array.isArray(templates) ? templates : [];
      setTemplate(list.find((t) => t.kind === 'medical_history' && t.is_active) || null);
      setHistory((Array.isArray(sent) ? sent : []).filter((s) => s.kind === 'medical_history'));
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not check this patient\'s forms.'));
    } finally { setLoading(false); }
  }, [patient?.id]);

  useEffect(() => {
    if (!open) return;
    setLink(null); setCopied(false); setError('');
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  /** Mint the link once per dialog, whichever button asked for it. Pressing
   *  WhatsApp and then Copy must hand out the same link, not burn the first. */
  const ensureLink = async () => {
    if (link) return link;
    const res = await api.post(`/forms/patient/${patient.id}/send`, { template_id: template.id });
    setLink(res);
    return res;
  };

  const run = async (which, fn) => {
    setBusy(which); setError('');
    try {
      await fn();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'That did not work. Please try again.'));
    } finally { setBusy(''); }
  };

  const sendWhatsApp = () => run('whatsapp', async () => {
    const made = await ensureLink();
    const res = await api.post('/forms/send-whatsapp', {
      submission_id: made.id,
      app_origin: window.location.origin,
    });
    // The endpoint answers honestly when the clinic never switched patient-form
    // messages on, rather than reporting a send that never happened. Reporting
    // that as success is how staff stop chasing a patient nobody messaged.
    if (res?.sent) {
      notify.sent(`Medical form sent to ${patient.name || 'the patient'} on WhatsApp.`);
      onClose();
    } else {
      setError(res?.message || 'That message could not be sent. The link below still works.');
    }
  });

  const openHere = () => run('tablet', async () => {
    const made = await ensureLink();
    window.open(`/form/fill/${made.token}`, '_blank', 'noopener,noreferrer');
    onClose();
  });

  const copyLink = () => run('copy', async () => {
    const made = await ensureLink();
    await navigator.clipboard?.writeText(`${window.location.origin}/form/fill/${made.token}`);
    setCopied(true);
    notify.sent('Link copied. Paste it wherever you like.');
  });

  const signed = history.find((h) => h.status === 'submitted' || h.status === 'applied');
  const pending = history.find((h) => (h.status === 'sent' || h.status === 'opened') && !h.expired);
  const url = link ? `${window.location.origin}/form/fill/${link.token}` : '';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-tight">Send the medical form</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {patient?.name || 'This patient'} fills it in and signs on their phone. It comes back as a
              signed PDF on their file.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Checking this patient's forms
            </div>
          ) : !template ? (
            <div className="py-6 text-center">
              <ClipboardList size={24} className="mx-auto text-gray-300" />
              <p className="mt-2.5 text-sm font-semibold text-gray-800">No medical form set up yet</p>
              <p className="mt-1 text-[13px] text-gray-500 max-w-sm mx-auto">
                Set one up once and it can go to every patient after that.
              </p>
              <a href="/paperwork"
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1a1548]">
                <ExternalLink size={14} /> Set it up in Paperwork
              </a>
            </div>
          ) : (
            <>
              {/* What staff came here to find out, answered before the buttons.
                  Re-sending a form somebody signed last month is the commonest
                  waste this dialog can prevent.

                  A band rather than InlineFeedback: that carries role="alert",
                  which is right for "Save failed" and wrong for a status line
                  that would then be announced every time the dialog opens. */}
              {signed ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    Already signed{signed.submitted_at ? ` on ${formatDate(signed.submitted_at)}` : ''}.
                    It is on the Documents tab. Send it again only if their health has changed.
                  </span>
                </div>
              ) : pending ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                  <Clock size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    A form is already with them{pending.sent_at ? `, sent ${formatDate(pending.sent_at)}` : ''},
                    and not filled in yet. Sending again just gives them a fresh link.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700">
                  <ClipboardList size={15} className="shrink-0 mt-0.5 text-gray-400" />
                  <span>No medical history on file for {patient?.name || 'this patient'} yet.</span>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(template.schema || []).filter((f) => f.type !== 'section').length} questions ·
                  the link works once and expires in 24 hours
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={sendWhatsApp}
                  disabled={!patient?.phone || !!busy}
                  title={patient?.phone ? 'Send it on WhatsApp' : 'This patient has no phone number on file'}
                  className={`${ACTION} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300`}>
                  {busy === 'whatsapp' ? <Spinner className="w-4 h-4" /> : <WhatsAppIcon size={16} brand />}
                  WhatsApp it
                </button>

                <button type="button" onClick={openHere} disabled={!!busy}
                  title="Open the form on this device and hand it over"
                  className={`${ACTION} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300`}>
                  {busy === 'tablet' ? <Spinner className="w-4 h-4" /> : <Tablet size={16} className="text-[#2a276e]" />}
                  Fill in here
                </button>

                <button type="button" onClick={copyLink} disabled={!!busy}
                  className={`${ACTION} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300`}>
                  {busy === 'copy' ? <Spinner className="w-4 h-4" />
                    : copied ? <Check size={16} className="text-emerald-600" />
                    : <Copy size={16} className="text-[#2a276e]" />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>

              {!patient?.phone && (
                <p className="text-xs text-gray-500">
                  No phone number on file, so WhatsApp is unavailable. The other two still work.
                </p>
              )}

              {/* Shown once a link exists so a failed WhatsApp send is never a
                  dead end: the link is already made and can be handed over. */}
              {url && (
                <code className="block w-full truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {url}
                </code>
              )}

              {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

              <p className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-0.5">
                <ShieldCheck size={12} />
                The signed copy records when it was submitted, from where, and a checksum of the document.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendMedicalFormModal;
