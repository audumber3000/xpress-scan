import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';
import { formatRelative, clinicDateKey, clinicToday } from '../../utils/datetime';

/**
 * The invoice list below 768px.
 *
 * A seven-column table has no honest phone layout — shrunk, the columns are too
 * narrow to read and the page scrolls sideways. Each invoice becomes a stacked
 * card instead: same data, same tap target, no horizontal scroll.
 *
 * Status vocabulary is deliberately identical to InvoiceItem's, so a bill reads
 * the same on a phone as it does on the desktop table.
 */

const statusOf = (invoice) => {
  const { status, created_at } = invoice;
  const createdToday = created_at && clinicDateKey(created_at) === clinicToday();

  if (status === 'draft') return { label: 'Incomplete', cls: 'bg-gray-100 text-gray-700' };
  if (status === 'finalized') {
    return { label: createdToday ? 'Unpaid' : 'Pending', cls: 'bg-red-50 text-red-700' };
  }
  if (status === 'partially_paid') return { label: 'Partial', cls: 'bg-amber-50 text-amber-700' };
  if (status === 'paid_verified' || status === 'paid_unverified') {
    return { label: 'Paid', cls: 'bg-green-50 text-green-700' };
  }
  if (status === 'cancelled') return { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' };
  return { label: status || 'Draft', cls: 'bg-gray-100 text-gray-700' };
};

const InvoiceCardList = ({ invoices, onSelect }) => {
  const cur = getCurrencySymbol();

  return (
    <div className="divide-y divide-gray-100">
      {invoices.map((invoice) => {
        const s = statusOf(invoice);
        const total = Number(invoice.total || 0);
        const due = Number(invoice.due_amount || 0);

        return (
          <button
            key={invoice.id}
            onClick={() => onSelect(invoice.id)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[3.5rem] active:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {invoice.patient_name || 'Unknown patient'}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${s.cls}`}>
                  {s.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {invoice.invoice_number}
                {/* .relative, not the whole object — formatRelative returns
                    { relative, exact }, and interpolating it printed a literal
                    "[object Object]" beside every invoice number on phones. */}
                {invoice.created_at ? ` · ${formatRelative(invoice.created_at).relative}` : ''}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900 tabular-nums">
                {cur}{total.toLocaleString('en-IN')}
              </p>
              {/* Only shown when money is actually still owed — on a settled
                  bill a "₹0 due" line is noise. */}
              {due > 0 && (
                <p className="text-[11px] text-red-600 font-semibold tabular-nums">
                  {cur}{due.toLocaleString('en-IN')} due
                </p>
              )}
            </div>

            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default InvoiceCardList;
