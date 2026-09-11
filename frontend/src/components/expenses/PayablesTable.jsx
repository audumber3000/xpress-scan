import React from 'react';
import { FlaskConical, Stethoscope, Wallet, Check, Undo2, RefreshCw, Package, Paperclip } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import { formatDate, formatRelative } from '../../utils/datetime';

/**
 * What the clinic owes — all of it, from wherever it came.
 *
 * Three sources, one list. A lab bill and a consultant's fee are raised per
 * CASE, when work is done; a supplier's bill is raised per VENDOR, when goods
 * are invoiced on credit. They arrive differently and they are settled
 * differently, but the question they answer is identical — who is owed, how
 * much, and is it late — so splitting them across two tabs meant the clinic had
 * to add two numbers together to know what it owed. They do not.
 *
 * A pure renderer. Loading, filters, search, pagination and the empty state all
 * belong to the Expenses page, exactly as the invoice table's do to Payments —
 * one chrome, three tabs. This file only knows how to draw a payable.
 *
 * These rows used to be invisible. `LabOrder.cost` recorded what a lab charged
 * and then went nowhere, so money-out counted manual expenses only. Settling a
 * row writes an Expense, which is what puts it into the ledger, the CSV export
 * and the dashboard's Net card.
 */

const KIND = {
  lab: { icon: FlaskConical, label: 'Lab', cls: 'bg-[#29828a]/10 text-[#29828a]' },
  consultant: { icon: Stethoscope, label: 'Consultant', cls: 'bg-purple-50 text-purple-700' },
  bill: { icon: Package, label: 'Supplier', cls: 'bg-amber-50 text-amber-700' },
};
const kindOf = (k) => KIND[k] || { icon: Wallet, label: 'Other', cls: 'bg-gray-100 text-gray-600' };

const SettleButton = ({ row, busy, onSettle, onUnsettle, compact }) => {
  const paid = row.status === 'paid';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); (paid ? onUnsettle : onSettle)(row); }}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[2.25rem] rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
        paid
          ? 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
          : 'bg-[#2a276e] hover:bg-[#1e1c4f] text-white'
      }`}
    >
      {busy
        ? <RefreshCw size={13} className="animate-spin" />
        : paid
          ? <><Undo2 size={13} />{!compact && 'Undo'}</>
          : <><Check size={13} />{!compact && (row.source === 'bill' ? 'Pay' : 'Mark paid')}</>}
    </button>
  );
};


/**
 * The supplier's bill, for a bill row. Opens it when there is one, and offers
 * to attach one when there is not — in real life the bill is usually paid first
 * and found in the email later, so the row has to take it at any point.
 * Case costs have no file of their own and get nothing here.
 */
const BillFile = ({ row, busy, onAttach }) => {
  if (row.source !== 'bill') return null;
  if (row.bill_file_url) {
    return (
      <a
        href={row.bill_file_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Open the supplier's bill"
        className="inline-flex items-center justify-center p-2 rounded-lg text-[#2a276e] hover:bg-[#2a276e]/10 transition-colors"
      >
        <Paperclip size={15} />
      </a>
    );
  }
  return (
    <label
      title="Attach the supplier's bill"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center p-2 rounded-lg text-gray-300 hover:text-[#2a276e] hover:bg-gray-100 transition-colors cursor-pointer ${busy ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <Paperclip size={15} />
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAttach(row, f); }}
      />
    </label>
  );
};

export const PayablesRows = ({ rows, busyId, onSettle, onUnsettle, onAttach }) => (
  <>
    {rows.map((r) => {
      const k = kindOf(r.kind);
      const Icon = k.icon;
      const paid = r.status === 'paid';
      return (
        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{r.created_at ? formatDate(r.created_at) : '—'}</div>
            <div className="text-xs text-gray-400">{r.created_at ? formatRelative(r.created_at).relative : ''}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
                paid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}>
                <Icon size={15} />
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{r.payee_name || 'Unassigned'}</div>
                <div className="text-xs text-gray-400">
                  {r.source === 'bill'
                    ? (r.total_amount ? `Bill total ${formatMoney(r.total_amount)}` : 'Supplier bill')
                    : (r.patient_name || 'No patient linked')}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="text-sm text-gray-900 break-words">{r.description || 'Work'}</div>
            {r.basis === 'percentage' && (
              <div className="text-xs text-gray-400">{r.percentage}% of what the patient paid</div>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${k.cls}`}>
              {k.label}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {/* Only bills carry terms, so this is blank for a case cost rather
                than inventing a due date nobody agreed to. */}
            {r.due_date ? (
              <>
                <div className={`text-sm ${r.days_overdue > 0 ? 'font-semibold text-red-600' : 'text-gray-900'}`}>
                  {formatDate(r.due_date)}
                </div>
                {r.days_overdue > 0 && (
                  <div className="text-xs text-red-500">{r.days_overdue}d overdue</div>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`text-sm font-semibold ${paid ? 'text-gray-500' : 'text-red-600'}`}>
              {formatMoney(r.amount)}
            </span>
            {/* What has already gone against it. Only a bill can be part-paid. */}
            {r.paid_so_far > 0 && !paid && (
              <div className="text-xs text-gray-400">{formatMoney(r.paid_so_far)} paid</div>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {paid ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Paid{r.paid_on ? ` ${formatDate(r.paid_on)}` : ''}
              </span>
            ) : r.paid_so_far > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                Part paid
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                Unpaid
              </span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <div className="inline-flex items-center gap-1">
              <BillFile row={r} busy={busyId === r.id} onAttach={onAttach} />
              <SettleButton row={r} busy={busyId === r.id} onSettle={onSettle} onUnsettle={onUnsettle} />
            </div>
          </td>
        </tr>
      );
    })}
  </>
);

/**
 * Below 1024px the seven columns have no honest layout, so a payable becomes
 * a stacked card. Same vocabulary, same tap target, no horizontal scroll.
 */
export const PayablesCardList = ({ rows, busyId, onSettle, onUnsettle, onAttach }) => (
  <div className="divide-y divide-gray-100">
    {rows.map((r) => {
      const k = kindOf(r.kind);
      const Icon = k.icon;
      const paid = r.status === 'paid';
      return (
        <div key={r.id} className="px-4 py-3 flex items-center gap-3 min-h-[3.5rem]">
          <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
            paid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <Icon size={15} />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {r.payee_name || 'Unassigned'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${k.cls}`}>
                {k.label}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {[r.description || 'Work',
                r.source === 'bill' ? (r.due_date ? `due ${formatDate(r.due_date)}` : null) : r.patient_name,
              ].filter(Boolean).join(' · ')}
            </p>
            <p className={`text-sm font-bold tabular-nums ${paid ? 'text-gray-500' : 'text-red-600'}`}>
              {formatMoney(r.amount)}
              {paid && <span className="ml-1.5 text-[11px] font-semibold text-green-700">paid</span>}
              {!paid && r.days_overdue > 0 && (
                <span className="ml-1.5 text-[11px] font-semibold text-red-500">
                  {r.days_overdue}d overdue
                </span>
              )}
              {!paid && r.paid_so_far > 0 && (
                <span className="ml-1.5 text-[11px] font-semibold text-blue-600">part paid</span>
              )}
            </p>
          </div>

          <BillFile row={r} busy={busyId === r.id} onAttach={onAttach} />
          <SettleButton row={r} busy={busyId === r.id} onSettle={onSettle} onUnsettle={onUnsettle} compact />
        </div>
      );
    })}
  </div>
);

// Column layout for the resizable table. `width` is a percentage of the table
// and the set must sum to 100; `min` is the pixel floor a drag can take a column
// down to. Changing this list invalidates saved layouts, which is handled.
export const PAYABLE_COLUMNS = [
  { key: 'raised', label: 'Raised',  width: 11, min: 92 },
  { key: 'payee',  label: 'Payee',   width: 18, min: 140 },
  { key: 'for',    label: 'For',     width: 19, min: 140 },
  { key: 'kind',   label: 'Kind',    width: 10, min: 88 },
  { key: 'due',    label: 'Due',     width: 11, min: 92 },
  { key: 'amount', label: 'Amount',  width: 11, min: 96, align: 'right' },
  { key: 'status', label: 'Status',  width: 11, min: 96 },
  { key: 'action', label: '',        width: 11, min: 128, align: 'right' },
];
