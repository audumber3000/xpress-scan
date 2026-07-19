import React, { useState } from 'react';
import { AlertTriangle, CalendarClock, PackageCheck, X } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { expiryStatus, isLowStock } from '../../utils/stockStatus';

// Alerts side panel for the active stock tab (general stock or medications).
// Two kinds of alert: low stock (at/below reorder level) and expiry
// (expired or expiring within 30 days, computed in the clinic timezone).
const InventoryAlerts = ({ items = [], onOpenVendors, onRestock, onClose, label = 'Stock' }) => {
  const [restocking, setRestocking] = useState(null);
  const [addQty, setAddQty] = useState('');

  const confirmRestock = (item) => {
    const qty = parseFloat(addQty);
    if (!qty || qty <= 0) return;
    onRestock?.(item.id, Number(item.quantity) + qty);
    setRestocking(null);
    setAddQty('');
  };

  const lowStock = items.filter(isLowStock);
  const expiryItems = items
    .map((it) => ({ it, info: expiryStatus(it.expiry_date) }))
    .filter((x) => x.info && x.info.status !== 'ok')
    .sort((a, b) => a.info.days - b.info.days);

  const totalAlerts = lowStock.length + expiryItems.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#2a276e] leading-tight">{label}</h3>
            <h3 className="text-lg font-bold text-[#2a276e] leading-tight">Alerts</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalAlerts > 0 && (
            <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow-sm shadow-red-200">
              {totalAlerts}
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition" aria-label="Close">
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1 -mr-1">
        {totalAlerts === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 text-green-300" strokeWidth={1.5} />
            <p className="font-medium text-gray-500">Everything looks good</p>
            <p className="text-xs text-gray-400 mt-1">No low stock or expiring items.</p>
          </div>
        ) : (
          <>
            {/* Expiry alerts */}
            {expiryItems.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                  <CalendarClock size={14} /> Expiry ({expiryItems.length})
                </p>
                <div className="space-y-2">
                  {expiryItems.map(({ it, info }) => (
                    <div key={it.id} className={`rounded-xl p-3 border ${info.status === 'expired' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-[#2a276e] text-sm truncate">{it.name}</h4>
                        <span className={`text-xs font-bold shrink-0 ${info.status === 'expired' ? 'text-red-600' : 'text-amber-700'}`}>
                          {info.status === 'expired' ? 'Expired' : `${info.days}d left`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Expires {formatDate(it.expiry_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low stock */}
            {lowStock.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                  <AlertTriangle size={14} /> Low stock ({lowStock.length})
                </p>
                <div className="space-y-2">
                  {lowStock.map(item => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-[#2a276e] text-sm pr-2 truncate">{item.name}</h4>
                        <div className="text-right shrink-0">
                          <span className="text-red-500 font-bold text-sm block">{item.quantity} left</span>
                          <span className="text-gray-400 text-[10px] font-medium block">Reorder at {item.min_stock_level}</span>
                        </div>
                      </div>
                      {restocking?.id === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="1" value={addQty}
                            onChange={e => setAddQty(e.target.value)}
                            placeholder="Add qty" autoFocus
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
                          className="w-full flex items-center justify-center gap-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#2a276e] hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          Restock
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-5 mt-4 border-t border-gray-100 shrink-0">
        <button
          onClick={onOpenVendors}
          className="w-full py-3.5 bg-[#0d0a2d] hover:bg-[#1a1548] text-white rounded-xl font-bold transition-colors shadow-md shadow-[#0d0a2d]/20 text-sm"
        >
          View All Vendors
        </button>
      </div>
    </div>
  );
};

export default InventoryAlerts;
