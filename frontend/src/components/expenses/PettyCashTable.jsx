import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Scale, Trash2 } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import { formatDate, formatRelative } from '../../utils/datetime';

/**
 * The cash drawer, as a table.
 *
 * Same seven-column shell as Payables and the Ledger, and for the same reason:
 * this is a list of movements with a date, a description and an amount, which
 * is exactly what the other two are. It had its own cards and its own dialogs
 * for a while, and the result was a tab that looked like a different product.
 *
 * The one column the other two do not have is the running balance, and it is
 * the only reason anybody opens this tab. It is computed forward by the server
 * on read rather than stored, so a back-dated entry reorders every balance
 * after it instead of leaving the older rows quietly wrong.
 */

const KIND = {
  top_up: {
    icon: ArrowDownLeft, label: 'Top-up',
    chip: 'bg-green-50 text-green-700', tile: 'bg-green-50 text-green-700',
  },
  spend: {
    icon: ArrowUpRight, label: 'Spend',
    chip: 'bg-amber-100 text-amber-800', tile: 'bg-red-50 text-red-600',
  },
  adjustment: {
    icon: Scale, label: 'Adjustment',
    chip: 'bg-gray-100 text-gray-700', tile: 'bg-gray-100 text-gray-600',
  },
};
const kindOf = (k) => KIND[k] || KIND.adjustment;

const Amount = ({ value }) => (
  <span className={`text-sm font-semibold ${value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
    {value >= 0 ? '+' : '−'} {formatMoney(Math.abs(value))}
  </span>
);

export const PettyCashRows = ({ rows, busyId, onRemove }) => (
  <>
    {rows.map((r) => {
      const k = kindOf(r.kind);
      const Icon = k.icon;
      return (
        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{formatDate(r.occurred_on)}</div>
            <div className="text-xs text-gray-400">
              {r.occurred_on ? formatRelative(r.occurred_on).relative : ''}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${k.tile}`}>
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {r.description || k.label}
                </div>
                <div className="text-xs text-gray-400">
                  {r.kind === 'top_up' ? 'Into the drawer' : r.kind === 'spend' ? 'Out of the drawer' : 'Correction'}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="text-sm text-gray-900 break-words">{r.category || '—'}</div>
            {/* A spend writes a ledger row; a top-up deliberately does not. */}
            {r.expense_id && <div className="text-xs text-gray-400">In your ledger</div>}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${k.chip}`}>
              {k.label}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right"><Amount value={r.amount} /></td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            {/* The drawer as it stood after this movement, so it can be read
                down the column instead of added up by hand. */}
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {formatMoney(r.balance_after)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <button
              type="button"
              onClick={() => onRemove(r)}
              disabled={busyId === r.id}
              title="Remove this movement"
              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </td>
        </tr>
      );
    })}
  </>
);

export const PettyCashCardList = ({ rows, busyId, onRemove }) => (
  <div className="divide-y divide-gray-100">
    {rows.map((r) => {
      const k = kindOf(r.kind);
      const Icon = k.icon;
      return (
        <div key={r.id} className="px-4 py-3 flex items-center gap-3 min-h-[3.5rem]">
          <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${k.tile}`}>
            <Icon size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {r.description || k.label}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${k.chip}`}>
                {k.label}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {[formatDate(r.occurred_on), r.category].filter(Boolean).join(' · ')}
            </p>
            <p className="text-sm font-bold tabular-nums">
              <Amount value={r.amount} />
              <span className="ml-2 text-[11px] font-semibold text-gray-400">
                balance {formatMoney(r.balance_after)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(r)}
            disabled={busyId === r.id}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      );
    })}
  </div>
);

export const PETTY_CASH_COLUMNS = [
  { key: 'date',    label: 'Date',        width: 13, min: 100 },
  { key: 'what',    label: 'What for',    width: 26, min: 170 },
  { key: 'cat',     label: 'Category',    width: 18, min: 130 },
  { key: 'kind',    label: 'Kind',        width: 12, min: 96 },
  { key: 'amount',  label: 'In / out',    width: 12, min: 104, align: 'right' },
  { key: 'balance', label: 'Balance',     width: 12, min: 104, align: 'right' },
  { key: 'action',  label: '',            width: 7,  min: 64,  align: 'right' },
];
