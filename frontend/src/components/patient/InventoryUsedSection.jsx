import React, { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';

// Invoice status shown next to a billed item ("added to bill INV-xxx · Draft").
const INV_STATUS = {
  draft: ['Draft', 'bg-gray-100 text-gray-600 border-gray-200'],
  finalized: ['Generated', 'bg-blue-50 text-blue-700 border-blue-200'],
  partially_paid: ['Partial', 'bg-amber-50 text-amber-700 border-amber-200'],
  paid_verified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  paid_unverified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-600 border-red-200'],
};

/**
 * InventoryUsedSection — record inventory consumed during a visit, on the case
 * paper. Adding an item decrements its stock (handled server-side); removing a
 * record restores it. Mirrors the lab-orders pattern: pick an item + quantity,
 * see the list, delete a row.
 */
const InventoryUsedSection = ({ consumptions = [], inventoryItems = [], medicationItems = [], onAdd, onDelete }) => {
  const [selected, setSelected] = useState(''); // "inv:<id>" | "med:<id>"
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const label = (it) => `${it.name}${typeof it.quantity === 'number' ? ` — ${it.quantity}${it.unit ? ' ' + it.unit : ''} left` : ''}`;

  const handleAdd = async () => {
    const q = parseFloat(qty);
    if (!selected || !q || q <= 0) return;
    const [kind, id] = selected.split(':');
    setSaving(true);
    try {
      await onAdd(kind, Number(id), q);
      setSelected('');
      setQty('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Package size={20} className="text-[#2a276e]" />
        Inventory & Medicines Used
      </h3>

      {/* Add row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all"
        >
          <option value="">Select an item…</option>
          {inventoryItems.length > 0 && (
            <optgroup label="Consumables">
              {inventoryItems.map((it) => <option key={`inv-${it.id}`} value={`inv:${it.id}`}>{label(it)}</option>)}
            </optgroup>
          )}
          {medicationItems.length > 0 && (
            <optgroup label="Medications">
              {medicationItems.map((it) => <option key={`med-${it.id}`} value={`med:${it.id}`}>{label(it)}</option>)}
            </optgroup>
          )}
        </select>
        <input
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
          className="w-full sm:w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !selected || !qty}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 shadow-sm"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* List */}
      {consumptions.length === 0 ? (
        <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">No inventory recorded for this visit</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {consumptions.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {c.item_name}
                  {c.medication_stock_id != null && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-emerald-600">Med</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {c.quantity}{c.unit ? ` ${c.unit}` : ''} used
                </p>
                {c.invoice_number && (() => {
                  const [lbl, cls] = INV_STATUS[c.invoice_status] || INV_STATUS.draft;
                  return (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap">
                      <span className="text-gray-400">Added to bill</span>
                      <span className="font-semibold text-[#2a276e]">{c.invoice_number}</span>
                      <span className={`px-1.5 py-0.5 rounded-full border ${cls}`}>{lbl}</span>
                    </p>
                  );
                })()}
              </div>
              <button
                onClick={() => onDelete(c.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                title="Remove and restore stock"
                aria-label="Remove"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InventoryUsedSection;
