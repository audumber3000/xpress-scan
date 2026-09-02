import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';

/**
 * Invoiced, paid, due — the three numbers, and the button that changes them.
 *
 * Drafts are excluded from all three. An unissued invoice has been shown to
 * nobody and is owed by nobody; counting it as invoiced would inflate the top
 * line and make Due wrong the moment anyone checked it against a bill.
 */
const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Line = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-600">{label}</span>
    <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${tone || 'text-gray-900'}`}>{value}</span>
  </div>
);

const PaymentSummaryCard = ({ invoices = [], onRecordPayment }) => {
  const t = useMemo(() => {
    const live = invoices.filter((i) => !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()));
    return {
      invoiced: live.reduce((s, i) => s + Number(i.total || 0), 0),
      paid: live.reduce((s, i) => s + Number(i.paid_amount || 0), 0),
      due: live.reduce((s, i) => s + Number(i.due_amount || 0), 0),
    };
  }, [invoices]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Payment summary</h3>
      </div>
      <Line label="Total invoiced" value={money(t.invoiced)} />
      <Line label="Total paid" value={money(t.paid)} tone="text-emerald-600" />
      <Line label="Total due" value={money(t.due)} tone={t.due > 0 ? 'text-red-600' : 'text-gray-900'} />
      <div className="p-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onRecordPayment}
          className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer"
        >
          <Plus size={15} /> Record payment
        </button>
      </div>
    </section>
  );
};

export default PaymentSummaryCard;
