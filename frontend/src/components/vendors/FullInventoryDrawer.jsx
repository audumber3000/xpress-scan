import React, { useState } from 'react';

const FullInventoryDrawer = ({ isOpen, onClose, inventory, onUpdateItem, onOpenAdd }) => {
  const [editingItem, setEditingItem] = useState(null);
  const [minStockInput, setMinStockInput] = useState("");

  if (!isOpen) return null;

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

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Complete Inventory</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Manage stock levels and configure low-stock alerts.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenAdd}
              className="flex items-center gap-2 bg-[#2a276e] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#1a1548] transition-colors shadow-sm text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add New Item
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Item Name</th>
                  <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Category</th>
                  <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Current Stock</th>
                  <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Alert Threshold</th>
                  <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Status</th>
                  <th className="py-4 px-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory.map(item => (
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
                    <td className="py-4 px-6 text-right">
                      <button className="text-gray-400 hover:text-[#2a276e] p-2 hover:bg-gray-100 rounded-lg transition-colors">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                         </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {inventory.length === 0 && (
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
        </div>
      </div>
    </>
  );
};

export default FullInventoryDrawer;
