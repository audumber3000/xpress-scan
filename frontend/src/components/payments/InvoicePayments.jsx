import React, { useState } from 'react';
import { Plus, Trash2, IndianRupee } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate, formatTime, clinicToday } from '../../utils/datetime';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// Renders in the clinic's timezone; pure dates (paid_on) are shown as-is.
const fmtDate = (s) => formatDate(s);

/**
 * InvoicePayments — the partial-payment schedule for an invoice. Lists each
 * installment (date · amount · method), shows the running balance, and lets
 * staff add or remove a payment. paid/due/status are recomputed server-side
 * from the sum of these rows.
 */
const InvoicePayments = ({ invoice, onAdd, onDelete, canEdit = true }) => {
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(clinicToday());
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const payments = invoice?.payments || [];
  const total = Number(invoice?.total || 0);
  const paid = Number(invoice?.paid_amount || 0);
  const due = Number(invoice?.due_amount ?? Math.max(total - paid, 0));
  const canRecord = ['finalized', 'partially_paid', 'paid_unverified', 'paid_verified'].includes(invoice?.status);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await onAdd({ amount: amt, paid_on: paidOn, method, note: note.trim() || null });
      setAmount(''); setNote('');
    } finally {
      setSaving(false);
    }
  };

  if (!canRecord) {
    return (
      <div className="mt-6 p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
        Finalize the invoice to start recording payments.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <IndianRupee size={16} className="text-[#2a276e]" /> Payments
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{payments.length} payment{payments.length === 1 ? '' : 's'} recorded</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gray-500">Paid <span className="font-semibold text-green-600">{money(paid)}</span></div>
          <div className="text-gray-500">Balance <span className={`font-semibold ${due > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(due)}</span></div>
        </div>
      </div>

      {/* Payment list */}
      {payments.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-900">{money(p.amount)}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {fmtDate(p.paid_on || p.created_at)}{p.created_at ? `, ${formatTime(p.created_at)}` : ''}
                </span>
                {p.method && <span className="text-xs text-gray-400 ml-2">· {p.method}</span>}
                {/* Money dated earlier than the day it was written down — worth
                    seeing at a glance when the books are reconciled. */}
                {p.is_back_dated && (
                  <span
                    title={`Money received ${fmtDate(p.paid_on)}, entered ${fmtDate(p.recorded_on)}`}
                    className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700"
                  >
                    Back-dated
                  </span>
                )}
                {p.note && <span className="text-xs text-gray-400 ml-2">· {p.note}</span>}
              </div>
              {canEdit && (
                <button
                  onClick={() => onDelete(p.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Remove payment"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add payment */}
      {canEdit && due > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 bg-white">
          {/* Labelled, because an unlabelled date box next to an amount reads as
              decoration — the field existed before but nobody could find it. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
              <input
                type="number" min="0" step="any" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Due ${money(due)}`}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Payment date
              </label>
              <input
                type="date" value={paidOn} max={clinicToday()}
                onChange={(e) => setPaidOn(e.target.value)}
                title="The day the money was actually received. Pick an earlier date to record a payment taken before today."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Method</label>
              <select
                value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
              >
                {['Cash', 'UPI', 'Card', 'Net Banking', 'Cheque', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button
              onClick={submit}
              disabled={saving || !amount}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 col-span-2 md:col-span-1"
            >
              <Plus size={16} /> Add
            </button>
          </div>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
          />
          {/* Recording money that came in on an earlier day is normal; saying so
              out loud is what keeps the books and the cash drawer agreeing. */}
          {paidOn < clinicToday() && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              This payment will be dated <span className="font-semibold">{fmtDate(paidOn)}</span>, so it counts
              towards that day's collection. We'll note that you entered it today.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoicePayments;
