import React, { useState } from 'react';
import { Package, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../Pagination';
import EmptyState from '../common/EmptyState';
import { takeOutBoxes } from '../../assets/illustrations';
import { formatDateTime } from '../../utils/datetime';
import { StockStatusBadge, ExpiryCell } from './StockBadges';
import useColumnWidths from '../../utils/useColumnWidths';
import { ColGroup, ResizableHead } from '../common/ColumnResizer';

// Column layout for the resizable table. `width` is a percentage and the set
// must sum to 100; `min` is the pixel floor a drag can reach.
const STOCK_COLUMNS = [
  { key: 'item',     label: 'Item',          width: 24, min: 160 },
  { key: 'category', label: 'Category',      width: 14, min: 100 },
  { key: 'stock',    label: 'Current Stock', width: 14, min: 110 },
  { key: 'expiry',   label: 'Expiry',        width: 14, min: 100 },
  { key: 'status',   label: 'Status',        width: 13, min: 100 },
  { key: 'updated',  label: 'Updated',       width: 12, min: 100 },
  { key: 'actions',  label: 'Actions',       width: 9,  min: 80, align: 'right' },
];

// Matches the other list pages now that the table gets the whole window.
const ITEMS_PER_PAGE = 25;

// General stock table. Reorder level is kept internal (edited in the drawer),
// so it's no longer a visible column; Expiry and Updated are shown instead.
const InventoryTable = ({ inventory, onEditItem, onDeleteItem, headerOffset = 0 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { tableRef, widths, startResize, reset: resetColumns } = useColumnWidths(
    'inventory.stock', STOCK_COLUMNS,
  );

  const paginatedItems = inventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
      <div>
        <table ref={tableRef} className="w-full min-w-[880px] table-fixed mp-table-fixed divide-y divide-gray-200">
          <ColGroup widths={widths} />
          <ResizableHead
            columns={STOCK_COLUMNS}
            startResize={startResize}
            onReset={resetColumns}
            style={{ top: headerOffset }}
          />
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
