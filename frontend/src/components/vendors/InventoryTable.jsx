import React, { useState } from 'react';

const InventoryTable = ({ inventory, onUpdateItem, onOpenAdd, onEditItem, onDeleteItem }) => {
  const [editingItem, setEditingItem] = useState(null);
  const [minStockInput, setMinStockInput] = useState("");
  const [activeTab, setActiveTab] = useState('All Categories');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleSaveAlert = () => {
    if (!editingItem) return;
    onUpdateItem(editingItem.id, { min_stock_level: parseFloat(minStockInput) || 0 });
    setEditingItem(null);
    setMinStockInput("");
  };

  const getStockStatus = (quantity, min) => {
    if (quantity <= min) return <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md text-xs">Low Stock Alert</span>;
    if (quantity <= min * 1.5) return <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-md text-xs">Getting Low</span>;
    return <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md text-xs">Healthy</span>;
  };

  // Filter 
  const filteredInventory = inventory.filter(item => {
    if (activeTab === 'All Categories') return true;
    return item.category === activeTab;
  });

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedItems = filteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Table Filters/Tabs */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-6 overflow-x-auto shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => { setActiveTab('All Categories'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold transition-colors shrink-0 ${
              activeTab === 'All Categories' ? 'bg-gray-50 border-gray-200 text-[#2a276e]' : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            All Categories
          </button>

          <div className="flex items-center gap-6 text-sm font-bold text-gray-500">
            {['Equipment', 'Consumables', 'Lab Services'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={`pb-1 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab 
                    ? 'border-[#2a276e] text-[#2a276e]' 
                    : 'border-transparent hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={onOpenAdd}
          className="flex items-center gap-2 bg-[#2a276e] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#1a1548] transition-colors shadow-sm text-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Item
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100 sticky top-0 bg-white z-10 shadow-sm">
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Item Name</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Category</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Current Stock</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Alert Threshold</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Status</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="py-4 px-6">
                  <span className="font-bold text-[#2a276e]">{item.name}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Vendor: {item.vendor_name || 'Unassigned'}</span>
                </td>
                <td className="py-4 px-6">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                    {item.category || 'General'}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <span className="font-bold text-gray-900 text-lg">{item.quantity}</span>
                  <span className="text-gray-500 text-xs ml-1">{item.unit || 'units'}</span>
                </td>
                <td className="py-4 px-6">
                  {editingItem?.id === item.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="w-20 px-2 py-1 border border-[#2a276e] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                        value={minStockInput}
                        onChange={e => setMinStockInput(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleSaveAlert} className="p-1.5 bg-[#2a276e] text-white rounded-md hover:bg-[#1a1548] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                      </button>
                      <button onClick={() => setEditingItem(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-600">{item.min_stock_level}</span>
                      <button 
                        onClick={() => { setEditingItem(item); setMinStockInput(item.min_stock_level.toString()); }}
                        className="text-xs font-bold text-[#2a276e] hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Set Alert
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-4 px-6">
                  {getStockStatus(item.quantity, item.min_stock_level)}
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEditItem && (
                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1.5 text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 rounded-lg transition-colors"
                        title="Edit item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan="6" className="py-16 text-center text-gray-500 text-sm">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                  No inventory items found. Add items to track them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm shrink-0">
        <div className="text-gray-500 font-medium">
          Showing <span className="text-gray-900 font-bold">{filteredInventory.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredInventory.length)}</span> of <span className="text-gray-900 font-bold">{filteredInventory.length}</span> items
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryTable;
