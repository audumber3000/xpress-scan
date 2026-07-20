import React, { useState } from 'react';
import { Pill, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../Pagination';
import EmptyState from '../common/EmptyState';
import { takeOutBoxes } from '../../assets/illustrations';
import { formatDateTime } from '../../utils/datetime';
import { StockStatusBadge, ExpiryCell } from './StockBadges';

const ITEMS_PER_PAGE = 10;

const MedicationTable = ({ medications, onEditItem, onDeleteItem }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginated = medications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-[#f8fafc] sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Medicine</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Strength / Form</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Stock</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
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
