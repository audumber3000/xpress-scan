import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { getCurrencySymbol } from '../../../utils/currency';

/**
 * What this patient has actually been billed, paid and still owes.
 *
 * Invoices only, on purpose. The treatment plan carries its own estimate, and
 * the reference this came from mixed the two into one set of figures — a header
 * reading one number, a summary reading another, and a plan total that was
 * neither. Money a patient owes and money somebody sketched onto a plan are
 * different facts, and a doctor reading them as one is how a clinic chases a
 * bill that was never raised.
 *
 * The Due figure here is the same arithmetic the header's Outstanding chip uses,
 * from the same array, so the two cannot disagree.
 */
const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN')}`;

const Line = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-600">{label}</span>
    <span className={`text-sm font-bold tabular-nums ${tone || 'text-gray-900'}`}>{value}</span>
  </div>
);

const FinancialSummaryCard = ({ invoices = [], onOpenBilling, onNewPayment }) => {
  const totals = useMemo(() => {
    // Drafts are excluded throughout: an unissued invoice is not money anybody
    // owes, which is how the rest of the app counts it too.
    const live = invoices.filter((i) => !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()));
    const billed = live.reduce((s, i) => s + Number(i.total || 0), 0);
    const paid = live.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const due = live.reduce((s, i) => s + Number(i.due_amount ?? 0), 0);
    return { billed, paid, due, count: live.length };
  }, [invoices]);

  return (
    <OverviewCard title="Financial Summary" action="View Details" onOpen={onOpenBilling}>
      {totals.count === 0 ? (
        <OverviewEmpty>Nothing billed to this patient yet.</OverviewEmpty>
      ) : (
        <>
          {/* "Total Billed", not "Total Treatment". These come from issued
              invoices; the treatment plan's own estimate lives with the plan
              and is a different number about a different thing. */}
          <Line label="Total Billed" value={money(totals.billed)} />
          <Line label="Total Paid" value={money(totals.paid)} tone="text-emerald-600" />
          <Line
            label="Total Due"
            value={money(totals.due)}
            tone={totals.due > 0 ? 'text-red-600' : 'text-gray-900'}
          />
        </>
      )}
      <div className="p-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onNewPayment}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer"
        >
          <Plus size={15} /> New Payment
        </button>
      </div>
    </OverviewCard>
  );
};

export default FinancialSummaryCard;
