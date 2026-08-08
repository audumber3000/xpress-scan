import React from 'react';
import { IndianRupee, ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/**
 * A one-line stand-in for the payment history on the invoice tab.
 *
 * The full schedule lives in its own tab now, so what belongs here is only the
 * answer to "has this been paid, and is there more to collect" — plus a way
 * through to the detail. Repeating the whole list would defeat the point of
 * having moved it.
 */
const PartPaymentSummary = ({ invoice, onOpen }) => {
  const canRecord = ['finalized', 'partially_paid', 'paid_unverified', 'paid_verified'].includes(invoice?.status);
  if (!canRecord) return null;

  const count = (invoice?.payments || []).length;
  const total = Number(invoice?.total || 0);
  const paid = Number(invoice?.paid_amount || 0);
  const due = Number(invoice?.due_amount ?? Math.max(total - paid, 0));
  const settled = due <= 0 && paid > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-6 w-full text-left rounded-xl border border-gray-200 bg-white hover:border-[#2a276e]/40 hover:bg-indigo-50/30 transition-colors px-5 py-4 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-[#2a276e]/10 text-[#2a276e] flex items-center justify-center shrink-0">
        <IndianRupee size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">
          {count === 0
            ? 'No payments yet'
            : `Part payment history · ${count} payment${count === 1 ? '' : 's'}`}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {count === 0
            ? 'Record the first payment against this invoice.'
            : (
              <>
                <span className="font-semibold text-green-600">{money(paid)}</span> collected
                {settled
                  ? ' · settled in full'
                  : <> · <span className="font-semibold text-amber-600">{money(due)}</span> still due</>}
              </>
            )}
        </p>
      </div>

      <span className="flex items-center gap-1 text-xs font-semibold text-[#2a276e] shrink-0">
        {count === 0 ? 'Record payment' : 'View all'} <ChevronRight size={15} />
      </span>
    </button>
  );
};

export default PartPaymentSummary;
