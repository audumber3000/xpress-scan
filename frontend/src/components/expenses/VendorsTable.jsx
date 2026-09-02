import React from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';

/**
 * Who the clinic pays: labs, suppliers, consultants.
 *
 * The old version of this table carried its own category tabs, its own
 * pagination and its own page shell, which is how the section ended up with
 * three different table designs on three tabs. Filters and paging now come from
 * the Expenses page, the same ones the other two tabs use.
 *
 * The open-balance column is the reason this tab sits under Expenses at all: a
 * vendor is only interesting here as somebody money is owed to.
 */

const initials = (name) => {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const StatusPill = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
    active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

export const VendorRows = ({ rows, owedBy, onEdit }) => (
  <>
    {rows.map((v) => {
      const owed = owedBy?.[v.id] || 0;
      return (
        <tr
          key={v.id}
          onClick={() => onEdit(v)}
          className="hover:bg-gray-50 cursor-pointer transition-colors group"
        >
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-[#9B8CFF]/12 text-[#2a276e] grid place-items-center font-bold text-xs flex-shrink-0">
                {initials(v.name)}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{v.name}</div>
                <div className="text-xs text-gray-400">{v.phone || v.email || 'No contact details'}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {v.category || 'General'}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {v.contact_name || 'Unassigned'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {owed > 0 ? (
              <span className="text-sm font-semibold text-red-600">{formatMoney(owed)}</span>
            ) : (
              <span className="text-sm text-gray-400">Settled</span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap"><StatusPill active={!!v.is_active} /></td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {v.last_order_date ? formatDate(v.last_order_date) : 'No orders'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <span className="inline-flex p-2 rounded-lg text-gray-300 group-hover:text-[#2a276e] group-hover:bg-gray-100 transition-colors">
              <MoreVertical size={16} />
            </span>
          </td>
        </tr>
      );
    })}
  </>
);

/** Below 1024px, one stacked card per vendor. */
export const VendorCardList = ({ rows, owedBy, onEdit }) => (
  <div className="divide-y divide-gray-100">
    {rows.map((v) => {
      const owed = owedBy?.[v.id] || 0;
      return (
        <button
          key={v.id}
          onClick={() => onEdit(v)}
          className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[3.5rem] active:bg-gray-50 transition-colors"
        >
          <span className="w-9 h-9 rounded-lg bg-[#9B8CFF]/12 text-[#2a276e] grid place-items-center font-bold text-xs flex-shrink-0">
            {initials(v.name)}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">{v.name}</span>
              {!v.is_active && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {[v.category || 'General', v.contact_name, v.phone].filter(Boolean).join(' · ')}
            </p>
          </div>

          {owed > 0 && (
            <span className="text-sm font-bold text-red-600 tabular-nums flex-shrink-0">
              {formatMoney(owed)}
            </span>
          )}
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </button>
      );
    })}
  </div>
);

// Column layout for the resizable table. `width` is a percentage of the table
// and the set must sum to 100; `min` is the pixel floor a drag can take a column
// down to. Changing this list invalidates saved layouts, which is handled.
export const VENDOR_COLUMNS = [
  { key: 'vendor',   label: 'Vendor',       width: 22, min: 150 },
  { key: 'category', label: 'Category',     width: 14, min: 100 },
  { key: 'contact',  label: 'Contact',      width: 17, min: 120 },
  { key: 'balance',  label: 'Open balance', width: 15, min: 110, align: 'right' },
  { key: 'status',   label: 'Status',       width: 12, min: 96 },
  { key: 'last',     label: 'Last order',   width: 12, min: 100 },
  { key: 'action',   label: '',             width: 8,  min: 72, align: 'right' },
];
