import React, { useState } from 'react';
import { Plus, Trash2, IndianRupee } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(/\dT\d|Z/.test(s) ? s : `${s}T00:00:00`);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * InvoicePayments — the partial-payment schedule for an invoice. Lists each
 * installment (date · amount · method), shows the running balance, and lets
 * staff add or remove a payment. paid/due/status are recomputed server-side
 * from the sum of these rows.
 */
const InvoicePayments = ({ invoice, onAdd, onDelete, canEdit = true }) => {
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
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
                <span className="text-xs text-gray-500 ml-2">{fmtDate(p.paid_on || p.created_at)}</span>
                {p.method && <span className="text-xs text-gray-400 ml-2">· {p.method}</span>}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input
              type="number" min="0" step="any" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (due ${money(due)})`}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 col-span-2 md:col-span-1"
            />
            <input
              type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPaidOn(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
            />
            <select
              value={method} onChange={(e) => setMethod(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
            >
              {['Cash', 'UPI', 'Card', 'Net Banking', 'Cheque', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
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
        </div>
      )}
    </div>
  );
};

export default InvoicePayments;
