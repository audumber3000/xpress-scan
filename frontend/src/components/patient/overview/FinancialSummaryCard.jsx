import React, { useMemo } from 'react';
import { Plus, Banknote } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { getCurrencySymbol } from '../../../utils/currency';
import { owingInvoices } from '../billing/outstanding';

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

const FinancialSummaryCard = ({ invoices = [], onOpenBilling, onRecordPayment, onNewInvoice }) => {
  const totals = useMemo(() => {
    // Drafts are excluded throughout: an unissued invoice is not money anybody
    // owes, which is how the rest of the app counts it too.
    const live = invoices.filter((i) => !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()));
    const billed = live.reduce((s, i) => s + Number(i.total || 0), 0);
    const paid = live.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const due = live.reduce((s, i) => s + Number(i.due_amount ?? 0), 0);
    return { billed, paid, due, count: live.length };
  }, [invoices]);

  // The same rule Record payment uses on the billing tab, so a button that is
  // enabled here always has something to open there.
  const canTakePayment = owingInvoices(invoices).length > 0;

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
      {/* Two buttons, because there were always two actions and one of them was
          lying. The single "New Payment" button opened the new-invoice drawer:
          the label promised to take money and the drawer asked you to raise a
          bill instead. They are separate things and a clinic does both from
          here, so each gets its own control saying what it does.

          Record payment leads, because taking money against a bill that already
          exists is the commoner of the two on a patient's file. It is disabled
          when nothing is outstanding rather than quietly falling through to a
          new invoice, which would be the old lie in a new place. */}
      <div className="p-3 border-t border-gray-100 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRecordPayment}
          disabled={!canTakePayment}
          title={canTakePayment ? undefined : 'No bill of this patient has a balance left to pay.'}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <Banknote size={14} /> Record payment
        </button>
        <button
          type="button"
          onClick={onNewInvoice}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Plus size={14} /> New invoice
        </button>
      </div>
    </OverviewCard>
  );
};

export default FinancialSummaryCard;
