import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import { formatDate, formatTime, formatRelative } from '../../utils/datetime';

/**
 * The day book: every rupee in and every rupee out, newest first.
 *
 * The columns are deliberately the same seven the Payments ledger used before
 * it moved here, so a clinic that has been reading this table for months does
 * not have to relearn it. What changed is where it lives: beside the payables
 * that feed it, rather than beside the invoices that only feed one half.
 *
 * Money in stays on the screen even though the section is called Expenses.
 * What went out only means something next to what came in, and hiding the other
 * half turns a net position into a list of outgoings.
 */

/**
 * Settling a payable stamps `[case_cost:12]` into the expense notes so the two
 * records can be tied back together. That is a marker for us, not a sentence
 * for the clinic, and it was being printed at the end of every settled lab
 * bill. It stays in the record and comes off the screen.
 */
const readable = (text) => (text || '').replace(/\s*[;·]?\s*\[case_cost:\d+\]/g, '').trim();

export const LedgerRows = ({ rows, onOpenExpense, onOpenInvoice }) => (
  <>
    {rows.map((item) => {
      const out = item.type === 'expense';
      return (
        <tr
          key={`${item.type}_${item.id}`}
          onClick={() => (out ? onOpenExpense(item.id) : onOpenInvoice(item.invoice_id))}
          className="hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div>{formatDate(item.date)}</div>
            {item.recorded_at && <div className="text-xs text-gray-400">{formatTime(item.recorded_at)}</div>}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
                out ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
              }`}>
                {out ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{item.entity_name || 'Unnamed'}</div>
                <div className="text-xs text-gray-400">{out ? 'Money out' : 'Money in'}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="text-sm text-gray-900 break-words">{readable(item.description)}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              out ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {item.category}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`text-sm font-semibold ${out ? 'text-red-600' : 'text-green-600'}`}>
              {out ? '-' : '+'}{formatMoney(item.amount)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {item.payment_method || 'Unknown'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
            {item.bill_file_url ? (
              <a
                href={item.bill_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2a276e] hover:text-[#1e1c4f] inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                View bill
              </a>
            ) : (
              <span className="text-[#2a276e]">Open</span>
            )}
          </td>
        </tr>
      );
    })}
  </>
);

/** Below 1024px, one stacked card per movement. */
export const LedgerCardList = ({ rows, onOpenExpense, onOpenInvoice }) => (
  <div className="divide-y divide-gray-100">
    {rows.map((item) => {
      const out = item.type === 'expense';
      return (
        <button
          key={`${item.type}_${item.id}`}
          onClick={() => (out ? onOpenExpense(item.id) : onOpenInvoice(item.invoice_id))}
          className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[3.5rem] active:bg-gray-50 transition-colors"
        >
          <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
            out ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}>
            {out ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {item.entity_name || item.category || (out ? 'Expense' : 'Payment')}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                out ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {item.category}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {[readable(item.description), item.payment_method].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-bold tabular-nums ${out ? 'text-red-600' : 'text-green-600'}`}>
              {out ? '-' : '+'}{formatMoney(item.amount)}
            </p>
            {/* formatRelative returns { relative, exact } — the whole object
                in JSX is what crashed this page the first time it rendered. */}
            <p className="text-[11px] text-gray-400">{item.date ? formatRelative(item.date).relative : ''}</p>
          </div>

          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </button>
      );
    })}
  </div>
);

// Column layout for the resizable table. `width` is a percentage of the table
// and the set must sum to 100; `min` is the pixel floor a drag can take a column
// down to. Changing this list invalidates saved layouts, which is handled.
export const LEDGER_COLUMNS = [
  { key: 'date',        label: 'Date',        width: 12, min: 96 },
  { key: 'entity',      label: 'Entity',      width: 18, min: 130 },
  { key: 'description', label: 'Description', width: 24, min: 150 },
  { key: 'category',    label: 'Category',    width: 14, min: 100 },
  { key: 'flow',        label: 'In / Out',    width: 13, min: 100, align: 'right' },
  { key: 'mode',        label: 'Mode',        width: 10, min: 84 },
  { key: 'details',     label: 'Details',     width: 9,  min: 84, align: 'right' },
];
