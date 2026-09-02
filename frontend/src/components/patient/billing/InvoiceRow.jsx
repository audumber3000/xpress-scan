import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate } from '../../../utils/datetime';

/**
 * One invoice in the list.
 *
 * The second line under the amount is whichever fact matters for that bill: how
 * much has been paid on a part-paid one, how it was paid on a settled one. A
 * fully paid invoice does not need its own total repeated back at it.
 */
const STATUS = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  finalized: { label: 'Unpaid', cls: 'bg-amber-50 text-amber-700' },
  partially_paid: { label: 'Partial', cls: 'bg-amber-50 text-amber-700' },
  paid_unverified: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  paid_verified: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-400' },
};

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const InvoiceRow = ({ invoice, onOpen }) => {
  const s = STATUS[String(invoice.status || '').toLowerCase()] || STATUS.finalized;
  const paid = Number(invoice.paid_amount || 0);
  const due = Number(invoice.due_amount || 0);

  const sub = due > 0 && paid > 0
    ? `Paid ${money(paid)} · ${money(due)} due`
    : due > 0
      ? `${money(due)} due`
      : invoice.payment_mode
        ? `Paid via ${invoice.payment_mode}`
        : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(invoice)}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors cursor-pointer group"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate">
            {invoice.invoice_number || `#${invoice.id}`}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${s.cls}`}>
            {s.label}
          </span>
        </span>
        <span className="block text-[11px] text-gray-400 mt-0.5">
          {formatDate(invoice.finalized_at || invoice.created_at)}
        </span>
      </span>

      <span className="text-right flex-shrink-0">
        <span className="block text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
          {money(invoice.total)}
        </span>
        {sub && (
          <span className={`block text-[11px] tabular-nums whitespace-nowrap ${due > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {sub}
          </span>
        )}
      </span>

      <ChevronRight size={15} className="text-gray-300 group-hover:text-[#2a276e] transition-colors flex-shrink-0" />
    </button>
  );
};

export default InvoiceRow;
