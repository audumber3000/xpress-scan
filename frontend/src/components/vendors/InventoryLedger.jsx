import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight, User } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';
import InventoryTransactionDrawer from './InventoryTransactionDrawer';

const fmtDate = (s) => {
  if (!s) return '';
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * InventoryLedger — the "Usage" tab: every stock movement for the clinic.
 * Visit usage flows in automatically (carries the patient); manual in/out
 * entries are added via the right drawer. Deleting a row reverses its stock
 * effect (handled server-side).
 */
const InventoryLedger = ({ inventoryItems = [], onStockChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/inventory/transactions?limit=200');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load inventory ledger:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this entry? Its effect on stock will be reversed.')) return;
    try {
      await api.delete(`/inventory/transactions/${id}`);
      toast.success('Entry removed — stock updated');
      fetchLedger();
      onStockChanged?.();
    } catch {
      toast.error('Failed to remove entry');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Stock Usage & Ledger</h3>
          <p className="text-sm text-gray-500 mt-0.5">Every movement — used in visits, restocks, and manual entries</p>
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Used for</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-gray-500">No stock movements yet</p>
                <p className="text-xs text-gray-400 mt-1">Inventory used during visits shows here automatically.</p>
              </td></tr>
            ) : rows.map((r) => {
              const isIn = r.direction === 'in';
              return (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.item_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                      isIn ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {isIn ? 'In' : 'Out'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {isIn ? '+' : '−'}{r.quantity}{r.unit ? ` ${r.unit}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {r.patient_name ? (
                      <span className="inline-flex items-center gap-1.5"><User size={14} className="text-gray-400" />{r.patient_name}</span>
                    ) : r.case_paper_id ? 'Visit' : <span className="text-gray-400">Manual</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={r.note || ''}>{r.note || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDate(r.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove and reverse stock"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
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
