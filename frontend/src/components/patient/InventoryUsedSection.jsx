import React, { useState } from 'react';
import { Package, Plus, Trash2, ReceiptText, Lock } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';

// Invoice status shown next to a billed item ("added to bill INV-xxx · Draft").
const INV_STATUS = {
  draft: ['Draft', 'bg-gray-100 text-gray-600 border-gray-200'],
  finalized: ['Generated', 'bg-blue-50 text-blue-700 border-blue-200'],
  partially_paid: ['Partial', 'bg-amber-50 text-amber-700 border-amber-200'],
  paid_verified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  paid_unverified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-600 border-red-200'],
};

// A row billed onto anything past a draft (generated/partial/paid) is locked —
// the charge can't be pulled without editing that bill, so no delete here.
const isLocked = (c) => !!c.invoice_number && !!c.invoice_status && c.invoice_status !== 'draft';

/**
 * InventoryUsedSection — record inventory consumed during a visit, on the case
 * paper. Adding an item decrements its stock (handled server-side) and prompts
 * whether to also put it on the bill. Removing a record prompts whether to drop
 * it from the bill only or undo it entirely (which restores stock).
 *
 * onAdd(kind, id, qty, addToBilling) · onDelete(id, mode) · onBill(id)
 */
const InventoryUsedSection = ({ consumptions = [], inventoryItems = [], medicationItems = [], onAdd, onDelete, onBill }) => {
  const [selected, setSelected] = useState(''); // "inv:<id>" | "med:<id>"
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  // Pending prompts: { name, kind, id, qty } for add; the consumption row for delete.
  const [addPrompt, setAddPrompt] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null);

  const label = (it) => `${it.name}${typeof it.quantity === 'number' ? ` — ${it.quantity}${it.unit ? ' ' + it.unit : ''} left` : ''}`;

  const itemName = () => {
    if (!selected) return '';
    const [kind, id] = selected.split(':');
    const src = kind === 'med' ? medicationItems : inventoryItems;
    return src.find((it) => String(it.id) === id)?.name || 'this item';
  };

  // Step 1: clicking Add opens the billing prompt instead of saving immediately.
  const handleAddClick = () => {
    const q = parseFloat(qty);
    if (!selected || !q || q <= 0) return;
    const [kind, id] = selected.split(':');
    setAddPrompt({ name: itemName(), kind, id: Number(id), qty: q });
  };

  // Step 2: chosen from the prompt — save with or without billing.
  const commitAdd = async (addToBilling) => {
    if (!addPrompt) return;
    setSaving(true);
    try {
      await onAdd(addPrompt.kind, addPrompt.id, addPrompt.qty, addToBilling);
      setSelected('');
      setQty('');
      setAddPrompt(null);
    } finally {
      setSaving(false);
    }
  };

  const commitDelete = async (mode) => {
    if (!deletePrompt) return;
    setSaving(true);
    try {
      await onDelete(deletePrompt.id, mode);
      setDeletePrompt(null);
    } finally {
      setSaving(false);
    }
  };

  const isBilled = deletePrompt?.invoice_number;
  const delQtyLabel = deletePrompt ? `${deletePrompt.quantity}${deletePrompt.unit ? ` ${deletePrompt.unit}` : ''}` : '';

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
          className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all"
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
          className="w-full sm:w-24 shrink-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 transition-all"
        />
        <button
          onClick={handleAddClick}
          disabled={saving || !selected || !qty}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 shrink-0 whitespace-nowrap bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 shadow-sm"
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
                {c.invoice_number ? (() => {
                  const [lbl, cls] = INV_STATUS[c.invoice_status] || INV_STATUS.draft;
                  return (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap">
                      <span className="text-gray-400">Added to bill</span>
                      <span className="font-semibold text-[#2a276e]">{c.invoice_number}</span>
                      <span className={`px-1.5 py-0.5 rounded-full border ${cls}`}>{lbl}</span>
                    </p>
                  );
                })() : (
                  <p className="text-[11px] mt-0.5 text-gray-400">Not billed</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!c.invoice_number && onBill && (
                  <button
                    onClick={() => onBill(c.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[#2a276e] hover:bg-[#2a276e]/10 transition-colors"
                    title="Add this item to the bill"
                  >
                    <ReceiptText size={14} /> Bill
                  </button>
                )}
                {isLocked(c) ? (
                  <span
                    className="p-1.5 text-gray-300"
                    title="Billed on a finalized/paid invoice — can't be removed here"
                  >
                    <Lock size={14} />
                  </span>
                ) : (
                  <button
                    onClick={() => setDeletePrompt(c)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove"
                    aria-label="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Prompt: add to billing or just record? */}
      <ConfirmDialog
        open={!!addPrompt}
        onClose={() => !saving && setAddPrompt(null)}
        title={`Add ${addPrompt?.name || 'item'} to the bill?`}
        message="Recording use always deducts it from stock. Choose whether to also add it to this visit's draft invoice."
        actions={[
          { label: 'Add to bill', variant: 'primary', onClick: () => commitAdd(true), disabled: saving },
          { label: "Just record (don't bill)", variant: 'secondary', onClick: () => commitAdd(false), disabled: saving },
        ]}
      />

      {/* Prompt: remove from bill only, or entirely (restock)? */}
      <ConfirmDialog
        open={!!deletePrompt}
        onClose={() => !saving && setDeletePrompt(null)}
        tone="danger"
        title={`Remove ${deletePrompt?.item_name || 'item'}?`}
        message={
          isBilled
            ? `It's on bill ${deletePrompt.invoice_number}. Remove it from the bill only (keeps it recorded as used), or remove it entirely and put ${delQtyLabel} back in stock.`
            : `This will delete the usage record and put ${delQtyLabel} back in stock.`
        }
        actions={
          isBilled
            ? [
                { label: 'Remove from bill only', variant: 'secondary', onClick: () => commitDelete('billing_only'), disabled: saving },
                { label: 'Remove entirely & restock', variant: 'danger', onClick: () => commitDelete('entirely'), disabled: saving },
              ]
            : [
                { label: 'Remove & restock', variant: 'danger', onClick: () => commitDelete('entirely'), disabled: saving },
              ]
        }
      />
    </div>
  );
};

export default InventoryUsedSection;
