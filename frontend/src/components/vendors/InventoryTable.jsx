import React, { useState } from 'react';
import { Package, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../Pagination';
import EmptyState from '../common/EmptyState';
import { takeOutBoxes } from '../../assets/illustrations';
import { formatDateTime } from '../../utils/datetime';
import { StockStatusBadge, ExpiryCell } from './StockBadges';

const ITEMS_PER_PAGE = 10;

// General stock table. Reorder level is kept internal (edited in the drawer),
// so it's no longer a visible column; Expiry and Updated are shown instead.
const InventoryTable = ({ inventory, onEditItem, onDeleteItem }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedItems = inventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-[#f8fafc] sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Stock</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginatedItems.map(item => (
              <tr
                key={item.id}
                onClick={() => onEditItem?.(item)}
                className="hover:bg-indigo-50/30 transition-colors duration-150 group cursor-pointer"
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#2a276e]/10 rounded-full flex items-center justify-center text-[#2a276e] flex-shrink-0">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">Vendor: {item.vendor_name || 'Unassigned'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    {item.category || 'General'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-medium tabular-nums">{item.quantity}</span>
                  <span className="text-xs text-gray-500 ml-1">{item.unit || 'units'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><ExpiryCell date={item.expiry_date} /></td>
                <td className="px-6 py-4 whitespace-nowrap"><StockStatusBadge item={item} /></td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{formatDateTime(item.updated_at || item.created_at)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-1">
                    {onEditItem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditItem(item); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 transition-colors"
                        title="Edit item" aria-label="Edit item"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete item" aria-label="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-8">
                  <EmptyState
                    image={takeOutBoxes}
                    title="No stock items yet"
                    subtitle="Add items to start tracking stock levels and expiry."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={currentPage} pageSize={ITEMS_PER_PAGE} totalItems={inventory.length} onPageChange={setCurrentPage} />
    </div>
  );
};

export default InventoryTable;
