import React, { useState } from 'react';

const InventoryAlerts = ({ inventory, onOpenVendors, onRestock }) => {
  const [restocking, setRestocking] = useState(null);
  const [addQty, setAddQty] = useState('');

  const confirmRestock = (item) => {
    const qty = parseFloat(addQty);
    if (!qty || qty <= 0) return;
    onRestock?.(item.id, item.quantity + qty);
    setRestocking(null);
    setAddQty('');
  };
  // Filter inventory items that are at or below their minimum stock level
  const alerts = inventory.filter(item => Number(item.quantity) <= Number(item.min_stock_level));

  // Helper to calculate progress percentage for the red bar
  const calculateProgress = (quantity, min_stock) => {
    if (min_stock <= 0) return 0;
    const percentage = (quantity / min_stock) * 100;
    return Math.min(Math.max(percentage, 5), 100); // Between 5% and 100%
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#2a276e]">Inventory</h3>
            <h3 className="text-lg font-bold text-[#2a276e] -mt-1">Alerts</h3>
          </div>
        </div>
        {alerts.length > 0 && (
          <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm shadow-red-200">
            {alerts.length}
          </div>
        )}
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {alerts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium text-gray-500">All stock is healthy</p>
          </div>
        ) : (
          alerts.map(item => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-[#2a276e] text-sm pr-2 truncate">{item.name}</h4>
                <div className="text-right shrink-0">
                  <span className="text-red-500 font-bold text-sm block">{item.quantity} left</span>
                  <span className="text-gray-400 text-[10px] font-medium block">Min: {item.min_stock_level}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3 truncate">Vendor: {item.vendor_name || 'Unknown'}</p>
              
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${calculateProgress(item.quantity, item.min_stock_level)}%` }}
                ></div>
              </div>

              {/* Restock */}
              {restocking?.id === item.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={e => setAddQty(e.target.value)}
                    placeholder="Add qty"
                    autoFocus
                    className="flex-1 px-2 py-1.5 text-sm border border-[#2a276e] rounded-lg outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                  />
                  <button onClick={() => confirmRestock(item)} className="p-1.5 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  </button>
                  <button onClick={() => { setRestocking(null); setAddQty(''); }} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setRestocking(item); setAddQty(''); }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#2a276e] hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Restock
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom Action */}
      <div className="pt-6 mt-4 border-t border-gray-100 shrink-0">
        <button 
          onClick={onOpenVendors}
          className="w-full py-4 bg-[#0d0a2d] hover:bg-[#1a1548] text-white rounded-xl font-bold transition-colors shadow-md shadow-[#0d0a2d]/20 text-sm"
        >
          View All Vendors
        </button>
      </div>
    </div>
  );
};

export default InventoryAlerts;
