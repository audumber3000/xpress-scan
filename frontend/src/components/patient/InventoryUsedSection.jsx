import React, { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';

/**
 * InventoryUsedSection — record inventory consumed during a visit, on the case
 * paper. Adding an item decrements its stock (handled server-side); removing a
 * record restores it. Mirrors the lab-orders pattern: pick an item + quantity,
 * see the list, delete a row.
 */
const InventoryUsedSection = ({ consumptions = [], inventoryItems = [], onAdd, onDelete }) => {
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const q = parseFloat(qty);
    if (!itemId || !q || q <= 0) return;
    setSaving(true);
    try {
      await onAdd(Number(itemId), q);
      setItemId('');
      setQty('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Package size={20} className="text-[#2a276e]" />
        Inventory Used
      </h3>

      {/* Add row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all"
        >
          <option value="">Select an item…</option>
          {inventoryItems.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}{typeof it.quantity === 'number' ? ` — ${it.quantity}${it.unit ? ' ' + it.unit : ''} left` : ''}
            </option>
          ))}
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
          disabled={saving || !itemId || !qty}
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
                <p className="text-sm font-semibold text-gray-900 truncate">{c.item_name}</p>
                <p className="text-xs text-gray-500">
                  {c.quantity}{c.unit ? ` ${c.unit}` : ''} used
                </p>
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
