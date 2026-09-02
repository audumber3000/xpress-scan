import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Send, Copy, Check, ExternalLink } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { notify } from '../../utils/notify';
import { formatDateTime } from '../../utils/datetime';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';
import FormReviewModal from '../forms/FormReviewModal';
import { useIsDentalPatient } from '../../utils/casePaper';

/**
 * Forms sent to this patient, and what came back.
 *
 * The link is shown as copyable text as well as being sendable, because a
 * clinic with an empty wallet still needs a way to hand the patient the form —
 * reading it out at the desk or pasting it into their own WhatsApp.
 */
const STATUS = {
  sent:      { label: 'Sent',       cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  opened:    { label: 'Opened',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submitted: { label: 'Needs review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  applied:   { label: 'Reviewed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const FormsTab = ({ patientId, patient }) => {
  const [templates, setTemplates] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [justSent, setJustSent] = useState(null);
  const [copied, setCopied] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const isDental = useIsDentalPatient(patient);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        api.get('/forms/templates'),
        api.get(`/forms/patient/${patientId}`),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setRows(Array.isArray(s) ? s : []);
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load forms.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // A form written for the other kind of case paper is hidden rather than
  // greyed out: offering a dental history to a skin patient is noise, not a
  // choice somebody wants to be reminded they cannot make.
  const usable = templates.filter(
    (t) => t.is_active && (!t.case_paper_type || t.case_paper_type === (isDental ? 'dental' : 'general'))
  );

  const send = async (templateId) => {
    setSending(true);
    setError('');
    try {
      const res = await api.post(`/forms/patient/${patientId}/send`, { template_id: templateId });
      setJustSent(res);
      setCopied(false);
      load();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not create the link.'));
    } finally {
      setSending(false);
    }
  };

  const linkFor = (token) => `${window.location.origin}/form/fill/${token}`;

  if (loading) {
    return <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
      <Spinner className="w-4 h-4" /> Loading forms
    </div>;
  }

  return (
    <div className="space-y-4">
      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Send a form</h3>
        </div>
        <div className="p-4">
          {usable.length === 0 ? (
            <p className="text-[13px] text-gray-500">
              No forms set up yet. Add one in Control Center to start sending them.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {usable.map((t) => (
                <button
                  key={t.id}
                  onClick={() => send(t.id)}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-medium hover:border-[#2a276e]/40 hover:bg-indigo-50/30 transition disabled:opacity-50"
                >
                  <Send size={13} /> {t.name}
                </button>
              ))}
            </div>
          )}

          {justSent && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[13px] font-semibold text-emerald-900">
                Link ready, valid for {justSent.expires_in_hours} hours
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded border border-emerald-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700">
                  {linkFor(justSent.token)}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(linkFor(justSent.token));
                    setCopied(true);
                    notify.done('Link copied');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-emerald-300 bg-white text-emerald-800 text-[12px] font-semibold hover:bg-emerald-100"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">History</h3>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ClipboardList size={22} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">No forms sent to this patient yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => {
              const s = STATUS[r.status] || STATUS.sent;
              const needsReview = r.status === 'submitted';
              return (
                <li key={r.id} className="px-4 py-3 flex items-center gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">{r.form_name}</p>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>
                        {s.label}
                      </span>
                      {r.expired && r.status !== 'applied' && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-500">
                          Link expired
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Sent {formatDateTime(r.sent_at)}
                      {r.submitted_at ? ` · answered ${formatDateTime(r.submitted_at)}` : ''}
                    </p>
                  </div>
                  {(r.status === 'submitted' || r.status === 'applied') && (
                    <button
                      onClick={() => setReviewing(r.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold shrink-0 transition ${
                        needsReview
                          ? 'bg-[#2a276e] text-white hover:bg-[#1e1c4f]'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {needsReview ? 'Review' : 'View'} <ExternalLink size={12} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reviewing && (
        <FormReviewModal
          submissionId={reviewing}
          onClose={() => setReviewing(null)}
          onApplied={(res) => {
            load();
            notify.done(res?.count ? `${res.count} field${res.count === 1 ? '' : 's'} updated` : 'Marked reviewed');
          }}
        />
      )}
    </div>
  );
};

export default FormsTab;
