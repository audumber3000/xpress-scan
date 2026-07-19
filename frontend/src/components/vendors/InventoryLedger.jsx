import React, { useState, useEffect, useCallback } from 'react';
import { Plus, User } from 'lucide-react';
import { api } from '../../utils/api';
import InventoryTransactionDrawer from './InventoryTransactionDrawer';
import { formatDateTime } from '../../utils/datetime';

// Event label + colour for each ledger action. Falls back to in/out for older
// rows that predate the action field.
const ACTION_META = {
  added:     { label: 'Added',     cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  restocked: { label: 'Restocked', cls: 'bg-green-100 text-green-800 border-green-200' },
  received:  { label: 'Received',  cls: 'bg-green-100 text-green-800 border-green-200' },
  used:      { label: 'Used',      cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  deducted:  { label: 'Deducted',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  adjusted:  { label: 'Adjusted',  cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  removed:   { label: 'Removed',   cls: 'bg-red-100 text-red-800 border-red-200' },
};
const actionInfo = (r) => ACTION_META[r.action] || (r.direction === 'in'
  ? { label: 'Stock in', cls: 'bg-green-100 text-green-800 border-green-200' }
  : { label: 'Stock out', cls: 'bg-amber-100 text-amber-800 border-amber-200' });

/**
 * InventoryLedger — the "Usage" tab: an activity log of everything that happens
 * to inventory (stock and medications): added, restocked, used, deducted,
 * removed. Read-only history; manual in/out movements are recorded via the
 * right drawer. Times are shown in the clinic's timezone.
 */
const InventoryLedger = ({ inventoryItems = [], onStockChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/inventory/transactions?limit=300');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load inventory ledger:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Activity log</h3>
          <p className="text-sm text-gray-500 mt-0.5">Everything that happens to inventory: added, restocked, used, deducted, removed</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm inline-flex items-center gap-1.5"
        >
          <Plus size={16} /> Record movement
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-[#f8fafc] sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">For</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-gray-500">No activity yet</p>
                <p className="text-xs text-gray-400 mt-1">Adding, restocking or using inventory shows here.</p>
              </td></tr>
            ) : rows.map((r) => {
              const isIn = r.direction === 'in';
              const info = actionInfo(r);
              return (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {r.item_name}
                    {r.medication_stock_id != null && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Med</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${info.cls}`}>{info.label}</span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isIn ? 'text-green-600' : 'text-amber-600'}`}>
                    {isIn ? '+' : '−'}{r.quantity}{r.unit ? ` ${r.unit}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {r.patient_name ? (
                      <span className="inline-flex items-center gap-1.5"><User size={14} className="text-gray-400" />{r.patient_name}</span>
                    ) : r.case_paper_id ? 'Visit' : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[220px] truncate" title={r.note || ''}>{r.note || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InventoryTransactionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inventoryItems={inventoryItems}
        onSaved={() => { fetchLedger(); onStockChanged?.(); }}
      />
    </div>
  );
};

export default InventoryLedger;
