import React, { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { api } from '../../utils/api';

/**
 * InventoryTransactionDrawer — right drawer to record a manual stock movement.
 * Direction In (restock) or Out (usage/wastage); item + quantity required;
 * an optional patient (searchable) and a note. Stock is adjusted server-side.
 */
const InventoryTransactionDrawer = ({ open, onClose, inventoryItems = [], onSaved }) => {
  const [direction, setDirection] = useState('out');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Optional patient attribution (searchable).
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    if (open) {
      setDirection('out'); setItemId(''); setQty(''); setNote('');
      setPatientQuery(''); setPatientResults([]); setSelectedPatient(null);
    }
  }, [open]);

  // Debounced patient search (server-side; covers all patients).
  useEffect(() => {
    if (selectedPatient) return;
    const q = patientQuery.trim();
    if (q.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await api.get(`/patients/?search=${encodeURIComponent(q)}&limit=6`);
        setPatientResults(Array.isArray(data) ? data : []);
      } catch { setPatientResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [patientQuery, selectedPatient]);

  const handleSave = async () => {
    const q = parseFloat(qty);
    if (!itemId || !q || q <= 0) return;
    setSaving(true);
    try {
      await api.post('/inventory/transactions', {
        inventory_item_id: Number(itemId),
        direction,
        quantity: q,
        patient_id: selectedPatient?.id || null,
        note: note.trim() || null,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white shadow-2xl z-[70] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-bold text-gray-900">Record stock movement</h3>
            <p className="text-sm text-gray-500 mt-0.5">Adjusts the item's stock count</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 w-full">
              {[
                { id: 'out', label: 'Used / Out' },
                { id: 'in', label: 'Restock / In' },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setDirection(o.id)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                    direction === o.id ? 'bg-[#2a276e] text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
            >
              <option value="">Select an item…</option>
              {inventoryItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}{typeof it.quantity === 'number' ? ` — ${it.quantity}${it.unit ? ' ' + it.unit : ''} in stock` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input
              type="number" min="0" step="any" value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="How many"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
            />
          </div>

          {/* Optional patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient <span className="text-gray-400 font-normal">(optional)</span></label>
            {selectedPatient ? (
              <div className="flex items-center justify-between px-4 py-2 bg-[#2a276e]/5 border border-[#2a276e]/15 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{selectedPatient.name}</span>
                <button onClick={() => { setSelectedPatient(null); setPatientQuery(''); }} className="text-xs text-gray-500 hover:text-gray-700">Change</button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                />
                {patientResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => { setSelectedPatient(p); setPatientResults([]); }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-900">{p.name}</span>
                          <span className="text-xs text-gray-400">{p.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="e.g. wastage, expired, opening stock…"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving || !itemId || !qty}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50"
          >
            <Check size={16} /> {saving ? 'Saving…' : 'Record movement'}
          </button>
        </div>
      </div>
    </>
  );
};

export default InventoryTransactionDrawer;
