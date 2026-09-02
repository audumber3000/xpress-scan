import React from 'react';
import { Info } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The close of the left column on a bill that is not settled.
 *
 * The totals stack above already carries the figure. What this adds is the
 * instruction — that the bill is open and what closes it — which a number on
 * its own does not say.
 */
const PartlyPaidBanner = ({ invoice }) => {
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return null;
  const due = Number(invoice.due_amount ?? 0);
  if (due <= 0) return null;

  const partly = invoice.status === 'partially_paid';

  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <Info size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-amber-900">
          {partly ? 'This invoice is partially paid' : 'This invoice is unpaid'}
        </p>
        <p className="text-[12px] text-amber-800 mt-0.5">
          {money(due)} still to collect. Record the remaining payment to settle it.
        </p>
      </div>
    </div>
  );
};

export default PartlyPaidBanner;
