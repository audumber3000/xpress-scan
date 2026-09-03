import React, { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Send, Check, X, Wand2, Download } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { notify } from '../../utils/notify';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';
import InsuranceCard from '../quotations/InsuranceCard';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { downloadAuthedFile } from '../../utils/whatsapp';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  sent:     { label: 'Sent',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Quotations for this patient, with their cover above them.
 *
 * The two are one screen because a quotation without the policy behind it is
 * just a price list — what a patient decides on is their own share, and that
 * cannot be shown without knowing the cover.
 *
 * The headline figure on every row is what the patient pays, not the total.
 * The total is the clinic's number; the patient's share is the one that
 * decides whether the treatment happens.
 */
const QuotationsTab = ({ patientId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get(`/quotations?patient_id=${patientId}`) || []);
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load quotations.'));
    } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true); setError('');
    try { await fn(); await load(); if (okMsg) notify.done(okMsg); }
    catch (e) { setError(getFriendlyErrorMessage(e, 'That did not work.')); }
    finally { setBusy(false); }
  };

  const fromPlan = () => act(
    () => api.post(`/quotations/from-treatment-plan/${patientId}`),
    'Quotation built from the treatment plan');

  if (loading) {
    return <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
      <Spinner className="w-4 h-4" /> Loading quotations
    </div>;
  }

  return (
    <div className="space-y-4">
      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      <InsuranceCard patientId={patientId} onChanged={load} />

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Quotations</h3>
          <button onClick={fromPlan} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a276e] text-white text-[12px] font-semibold hover:bg-[#1e1c4f] disabled:opacity-50">
            <Wand2 size={13} /> Build from treatment plan
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FileSpreadsheet size={22} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">No quotations for this patient yet.</p>
            <p className="mt-1 text-[12px] text-gray-400">
              Plan the treatment on the chart first, then build a quotation from it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((q) => {
              const s = STATUS[q.status] || STATUS.draft;
              const isOpen = open === q.id;
              return (
                <li key={q.id} className="px-4 py-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button onClick={() => setOpen(isOpen ? null : q.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-gray-900">{q.quotation_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                        {q.expired && <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-700">Expired</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {q.line_items.length} item{q.line_items.length === 1 ? '' : 's'}
                        {q.valid_until ? ` · valid to ${formatDate(q.valid_until)}` : ''}
                      </p>
                    </button>

                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-bold text-gray-900 tabular-nums">{money(q.patient_portion)}</p>
                      <p className="text-[11px] text-gray-500">
                        patient pays{q.insurance_estimate > 0 ? ` · insurer ${money(q.insurance_estimate)}` : ''}
                      </p>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px]">
                          <thead className="bg-gray-50">
                            <tr>
                              {['Procedure', 'Tooth', 'Band', 'Amount', 'Insurer', 'Patient'].map((h, i) => (
                                <th key={h} className={`px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500 ${i > 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {q.line_items.map((l) => (
                              <tr key={l.id}>
                                <td className="px-3 py-2 text-[12px] text-gray-900">{l.description}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-600">{l.tooth_number || '—'}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-600 capitalize">{l.benefit_category}</td>
                                <td className="px-3 py-2 text-[12px] text-gray-900 text-right tabular-nums">{money(l.amount)}</td>
                                <td className="px-3 py-2 text-[12px] text-emerald-600 text-right tabular-nums">{money(l.insurance_estimate)}</td>
                                <td className="px-3 py-2 text-[12px] font-semibold text-gray-900 text-right tabular-nums">{money(l.patient_portion)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-500">
                          {q.insurance?.covered
                            ? <>Estimated against {q.insurance.payer_name}
                                {q.insurance.annual_max_reached ? ' · annual maximum reached' : ''}</>
                            : 'No cover on file — the whole amount is the patient’s.'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => act(() => downloadAuthedFile(
                              `/quotations/${q.id}/pdf`, `Quotation_${q.quotation_number}.pdf`))}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-50">
                            <Download size={12} /> PDF
                          </button>
                          {(q.status === 'draft' || q.status === 'sent') && (
                            <>
                              {/* Sending marks it sent, so there is no separate
                                  "mark sent" to forget. The manual one stays for
                                  a clinic that hands the PDF over at the desk. */}
                              <button
                                onClick={() => act(async () => {
                                  const r = await api.post(`/quotations/${q.id}/send-whatsapp`, {});
                                  if (r && r.sent === false) notify.problem(r.message);
                                }, null)}
                                disabled={busy || !q.patient_phone}
                                title={q.patient_phone ? 'Send on WhatsApp' : 'No phone number on file'}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-50">
                                <WhatsAppIcon size={12} brand /> Send
                              </button>
                              {q.status === 'draft' && (
                                <button onClick={() => act(() => api.post(`/quotations/${q.id}/send`), 'Marked as sent')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a276e] text-white text-[12px] font-semibold hover:bg-[#1e1c4f] disabled:opacity-50">
                                  <Send size={12} /> Mark sent
                                </button>
                              )}
                              <button onClick={() => act(() => api.post(`/quotations/${q.id}/respond`, { accepted: true }), 'Accepted')}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[12px] font-semibold hover:bg-emerald-50 disabled:opacity-50">
                                <Check size={12} /> Accepted
                              </button>
                              <button onClick={() => act(() => api.post(`/quotations/${q.id}/respond`, { accepted: false }), 'Declined')}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-50">
                                <X size={12} /> Declined
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default QuotationsTab;
