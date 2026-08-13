import React from 'react';
import { FlaskConical, Stethoscope, Wallet, Check, Undo2, RefreshCw } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import { formatDate, formatRelative } from '../../utils/datetime';

/**
 * What the clinic owes for work already done: lab bills and consultant fees.
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
};
const kindOf = (k) => KIND[k] || { icon: Wallet, label: 'Other', cls: 'bg-gray-100 text-gray-600' };

const SettleButton = ({ row, busy, onSettle, onUnsettle, compact }) => {
  const paid = row.status === 'paid';
  return (
    <button
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
          : <><Check size={13} />{!compact && 'Mark paid'}</>}
    </button>
  );
};

export const PayablesRows = ({ rows, busyId, onSettle, onUnsettle }) => (
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
                <div className="text-xs text-gray-400">{r.patient_name || 'No patient linked'}</div>
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
            <span className={`text-sm font-semibold ${paid ? 'text-gray-500' : 'text-red-600'}`}>
              {formatMoney(r.amount)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {paid ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Paid{r.paid_on ? ` ${formatDate(r.paid_on)}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                Unpaid
              </span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <SettleButton row={r} busy={busyId === r.id} onSettle={onSettle} onUnsettle={onUnsettle} />
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
export const PayablesCardList = ({ rows, busyId, onSettle, onUnsettle }) => (
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
              {[r.description || 'Work', r.patient_name].filter(Boolean).join(' · ')}
            </p>
            <p className={`text-sm font-bold tabular-nums ${paid ? 'text-gray-500' : 'text-red-600'}`}>
              {formatMoney(r.amount)}
              {paid && <span className="ml-1.5 text-[11px] font-semibold text-green-700">paid</span>}
            </p>
          </div>

          <SettleButton row={r} busy={busyId === r.id} onSettle={onSettle} onUnsettle={onUnsettle} compact />
        </div>
      );
    })}
  </div>
);

export const PAYABLE_COLUMNS = ['Raised', 'Payee', 'For', 'Kind', 'Amount', 'Status', ''];
