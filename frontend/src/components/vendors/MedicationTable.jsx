import React, { useState } from 'react';
import { Pill, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../Pagination';
import EmptyState from '../common/EmptyState';
import { takeOutBoxes } from '../../assets/illustrations';
import { formatDateTime } from '../../utils/datetime';
import { StockStatusBadge, ExpiryCell } from './StockBadges';
import useColumnWidths from '../../utils/useColumnWidths';
import { ColGroup, ResizableHead } from '../common/ColumnResizer';

// Column layout for the resizable table. `width` is a percentage and the set
// must sum to 100; `min` is the pixel floor a drag can reach.
const MEDICATION_COLUMNS = [
  { key: 'medicine', label: 'Medicine',         width: 22, min: 150 },
  { key: 'strength', label: 'Strength / Form',  width: 16, min: 120 },
  { key: 'stock',    label: 'Current Stock',    width: 14, min: 110 },
  { key: 'expiry',   label: 'Expiry',           width: 13, min: 100 },
  { key: 'status',   label: 'Status',           width: 13, min: 100 },
  { key: 'updated',  label: 'Updated',          width: 13, min: 100 },
  { key: 'actions',  label: 'Actions',          width: 9,  min: 80, align: 'right' },
];

// Matches the other list pages now that the table gets the whole window.
const ITEMS_PER_PAGE = 25;

const MedicationTable = ({ medications, onEditItem, onDeleteItem, headerOffset = 0 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { tableRef, widths, startResize, reset: resetColumns } = useColumnWidths(
    'inventory.medications', MEDICATION_COLUMNS,
  );

  const paginated = medications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
      <div>
        <table ref={tableRef} className="w-full min-w-[880px] table-fixed mp-table-fixed divide-y divide-gray-200">
          <ColGroup widths={widths} />
          <ResizableHead
            columns={MEDICATION_COLUMNS}
            startResize={startResize}
            onReset={resetColumns}
            style={{ top: headerOffset }}
          />
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.map(item => (
              <tr
                key={item.id}
                onClick={() => onEditItem?.(item)}
                className="hover:bg-indigo-50/30 transition-colors duration-150 group cursor-pointer"
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Pill size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.generic_name || item.vendor_name || 'No generic'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {[item.strength, item.form].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-medium tabular-nums">{item.quantity}</span>
                  <span className="text-xs text-gray-500 ml-1">{item.unit || 'unit'}</span>
                  {item.units_per_pack > 0 && item.pack_unit && (
                    <span className="block text-[11px] text-gray-400">≈ {(item.quantity / item.units_per_pack).toFixed(1)} {item.pack_unit.toLowerCase()}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><ExpiryCell date={item.expiry_date} /></td>
                <td className="px-6 py-4 whitespace-nowrap"><StockStatusBadge item={item} /></td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{formatDateTime(item.updated_at || item.created_at)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditItem?.(item); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 transition-colors"
                      title="Edit medication" aria-label="Edit medication"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteItem?.(item.id); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete medication" aria-label="Delete medication"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-8">
                  <EmptyState
                    image={takeOutBoxes}
                    title="No medications yet"
                    subtitle="Add medicines to start tracking stock and expiry."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={currentPage} pageSize={ITEMS_PER_PAGE} totalItems={medications.length} onPageChange={setCurrentPage} />
    </div>
  );
};

export default MedicationTable;
