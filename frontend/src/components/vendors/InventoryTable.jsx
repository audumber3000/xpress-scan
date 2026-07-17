import React, { useState } from 'react';
import { Package, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../Pagination';

const ITEMS_PER_PAGE = 10;

const InventoryTable = ({ inventory, onUpdateItem, onEditItem, onDeleteItem }) => {
  const [editingItem, setEditingItem] = useState(null);
  const [minStockInput, setMinStockInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSaveAlert = () => {
    if (!editingItem) return;
    onUpdateItem(editingItem.id, { min_stock_level: parseFloat(minStockInput) || 0 });
    setEditingItem(null);
    setMinStockInput('');
  };

  const getStockStatus = (quantity, min) => {
    if (quantity <= min) return (
      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">Low Stock</span>
    );
    if (quantity <= min * 1.5) return (
      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Getting Low</span>
    );
    return (
      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-50 text-green-700 border border-green-200">Healthy</span>
    );
  };

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
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert Threshold</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {editingItem?.id === item.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        className="w-20 px-2 py-1 border border-[#2a276e] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                        value={minStockInput}
                        onChange={e => setMinStockInput(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleSaveAlert} className="px-2 py-1 text-xs font-semibold text-white bg-[#2a276e] rounded-md hover:bg-[#1a1548] transition-colors">Save</button>
                      <button onClick={() => setEditingItem(null)} className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{item.min_stock_level}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingItem(item); setMinStockInput((item.min_stock_level ?? 0).toString()); }}
                        className="px-2 py-0.5 text-xs font-semibold text-[#2a276e] bg-[#2a276e]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Set
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStockStatus(item.quantity, item.min_stock_level)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-1">
                    {onEditItem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditItem(item); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 transition-colors"
                        title="Edit item"
                        aria-label="Edit item"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete item"
                        aria-label="Delete item"
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
                <td colSpan="6" className="px-6 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Package className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-gray-900">No inventory items</p>
                    <p className="text-sm text-gray-500 mt-1">Add items to track stock levels.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageSize={ITEMS_PER_PAGE}
        totalItems={inventory.length}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default InventoryTable;
