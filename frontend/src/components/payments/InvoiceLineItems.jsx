import React, { useState, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import InvoiceLineItemForm from "./InvoiceLineItemForm";
import { getCurrencySymbol } from "../../utils/currency";
import { useIsDentalPatient } from '../../utils/casePaper';

/* ── GST Info Popover ─────────────────────────────────────────────────────── */
const GST_INFO = {
  exempt: [
    { label: "SAC 9993 — EXEMPT (0% GST)", items: [
      "OPD Consultation & Registration",
      "Intraoral X-rays (RVG / IOPA), OPG, CBCT",
      "Dental Fillings (Composite, GIC, Amalgam)",
      "Root Canal Treatment (RCT), Pulpotomy",
      "Routine & surgical Extractions, Impacted Wisdom Teeth",
      "Scaling & Root Planing (for disease treatment)",
      "Crowns & Bridges (PFM, Zirconia, Metal) — when part of treatment plan",
      "Dental Implants & Dentures",
      "Metal / Ceramic Braces (functional malocclusion treatment)",
      "Jaw fracture treatment, cyst/tumour removal",
    ]},
  ],
  taxable: [
    { label: "SAC 999722 — TAXABLE (18% GST)", items: [
      "Teeth Whitening / Bleaching (in-office or take-home)",
      "Veneers / Laminates (purely cosmetic on healthy teeth)",
      "Tooth Jewellery / Dental Gems",
      "Gingival Depigmentation (gum bleaching — aesthetic only)",
      "Cosmetic Enamel Contouring",
    ]},
    { label: "HSN 3004 — Sale of Goods (5–18% GST)", items: [
      "Mouthwashes, Dental Floss, Interdental Brushes (18%)",
      "Medicated Toothpaste (12–18% depending on composition)",
      "Over-the-counter dental kits / prescribed gels sold separately",
    ]},
  ],
  note: "Composite Supply Rule: The crown/implant fee you charge a patient remains 0% even if your lab charges you 12% GST — the primary service is healthcare. Consult your CA for jurisdiction-specific advice.",
};

const GSTInfoPopover = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="GST Guide for Indian Dental Clinics"
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: 'transparent', border: '1px solid #cbd5e1',
          color: '#94a3b8', fontSize: 10, fontWeight: 700,
          cursor: 'pointer', lineHeight: '14px', textAlign: 'center',
          flexShrink: 0,
        }}
      >ℹ</button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
          />
          {/* Panel */}
          <div style={{
            position: 'absolute', right: 0, top: 28, zIndex: 999,
            width: 420, maxHeight: '75vh', overflowY: 'auto',
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.15)',
            padding: '16px 18px', fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>🇮🇳 GST Guide — Indian Dental Clinics</span>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
            </div>

            {GST_INFO.exempt.map(sec => (
              <div key={sec.label} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>🟢 {sec.label}</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', lineHeight: 1.7 }}>
                  {sec.items.map(it => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}

            {GST_INFO.taxable.map(sec => (
              <div key={sec.label} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>🔴 {sec.label}</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', lineHeight: 1.7 }}>
                  {sec.items.map(it => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#78350f', marginTop: 4 }}>
              ⚠️ <strong>Composite Supply Rule:</strong> {GST_INFO.note}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const InvoiceLineItems = ({ invoice, lineItems, onAdd, onEdit, onDelete, canEdit }) => {
  const isDental = useIsDentalPatient({ case_paper_type: invoice?.patient_case_paper_type });
  const [editingId, setEditingId] = useState(null);

  const items = lineItems || [];
  const editingItem = items.find((i) => i.id === editingId) || null;

  // Rows that just arrived or just changed get a soft tint for a moment, so the
  // eye finds the line it has just added in a list of eight without reading
  // every row. Worked out by comparing ids across renders rather than by
  // listening for the save: a line added by a preset, by the keyboard or by
  // anything else lands the same way. Nothing flashes on first load — every
  // row would be "new" and the highlight would mean nothing.
  const [fresh, setFresh] = useState(() => new Set());
  const seenIds = useRef(null);
  const flashTimer = useRef(null);
  const flash = (ids) => {
    if (!ids.length) return;
    setFresh(new Set(ids));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFresh(new Set()), 1600);
  };
  const idKey = items.map((i) => i.id).join(',');
  useEffect(() => {
    const ids = idKey ? idKey.split(',') : [];
    if (seenIds.current) flash(ids.filter((id) => !seenIds.current.includes(id)));
    seenIds.current = ids;
  }, [idKey]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const handleSave = async (lineItemData) => {
    if (editingId) {
      const id = editingId;
      await onEdit(id, lineItemData);
      setEditingId(null);
      // An edit keeps its id, so the comparison above cannot see it.
      flash([String(id)]);
    } else {
      await onAdd(lineItemData);
    }
  };

  const rowTone = (id, editing) => (
    editing ? 'bg-[#2a276e]/[0.04]'
      : fresh.has(String(id)) ? 'bg-[#29828a]/10'
        : 'hover:bg-gray-50/70'
  );

  // Currency symbol comes from the clinic (same source as the rest of the app).
  const formatAmount = (amount) =>
    `${getCurrencySymbol()}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    // One card: the lines, and the bar that adds the next one docked beneath
    // them. There used to be an "Add Item" button that opened a tall form above
    // the table and closed it again after every save, plus a separate panel
    // for adding from stock. The bar is simply always there now.
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">Procedures &amp; line items</h3>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <GSTInfoPopover />
        </div>
        {canEdit && (
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-white font-sans text-gray-500">Tab</kbd>
            <span>to move</span>
            <span className="text-gray-300">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-white font-sans text-gray-500">↵</kbd>
            <span>to add</span>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <>
        {/* Phones get the same lines as stacked cards. Seven columns have no
            honest layout at 375px — the description came out three words wide
            and the money scrolled off the side — so below `md` each line is one
            block: what, where, how many at what, and the total. */}
        <ul className="md:hidden divide-y divide-gray-100">
          {items.map((item, idx) => {
            const editing = editingId === item.id;
            return (
              <li key={item.id} className={`px-3 py-3 flex items-start gap-3 transition-colors duration-700 ${rowTone(item.id, editing)}`}>
                <span className="text-[11px] font-mono text-gray-400 tabular-nums pt-0.5 w-5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 break-words">{item.description}</div>
                  <div className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {item.tooth_number ? <span className="font-mono">{item.tooth_number} · </span> : null}
                    {item.quantity} × {formatAmount(item.unit_price)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-gray-900 tabular-nums">{formatAmount(item.amount)}</div>
                  {canEdit && (
                    <div className="flex justify-end gap-0.5 mt-1 -mr-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(editing ? null : item.id)}
                        className={`p-2 rounded-md transition-colors ${editing ? 'text-[#2a276e] bg-[#2a276e]/10' : 'text-gray-400 hover:text-[#2a276e]'}`}
                        title={editing ? 'Stop editing' : 'Edit'}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="p-2 rounded-md text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-[#f8fafc]">
              <tr className="border-b border-gray-100">
                <th className="pl-4 pr-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {isDental ? 'Tooth / area' : 'Area / site'}
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-14">Qty</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Unit price</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                {canEdit && <th className="pr-4 pl-2 py-2.5 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const editing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors duration-700 ${rowTone(item.id, editing)}`}
                  >
                    <td className="pl-4 pr-2 py-3 text-xs font-mono text-gray-400 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-gray-900 break-words">{item.description}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 font-mono">
                      {item.tooth_number || <span className="text-gray-300 font-sans">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-center text-gray-900 tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-3 text-sm text-right text-gray-700 tabular-nums">{formatAmount(item.unit_price)}</td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-gray-900 tabular-nums">{formatAmount(item.amount)}</td>
                    {canEdit && (
                      <td className="pr-4 pl-2 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(editing ? null : item.id)}
                            className={`p-1.5 rounded-md transition-colors ${editing ? 'text-[#2a276e] bg-[#2a276e]/10' : 'text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5'}`}
                            title={editing ? 'Stop editing' : 'Edit'}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No line items yet.{canEdit && ' Add the first one below.'}
        </div>
      )}

      {/* Editing reuses the same bar: the row being changed is highlighted
          above, and its values load into the bar below — no second form
          squeezed inside the table. `key` remounts it per row so switching
          between rows loads each one cleanly. */}
      {canEdit && (
        <InvoiceLineItemForm
          key={editingItem ? `edit-${editingItem.id}` : 'add'}
          lineItem={editingItem}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
          patient={{ case_paper_type: invoice?.patient_case_paper_type }}
        />
      )}
    </div>
  );
};

export default InvoiceLineItems;
