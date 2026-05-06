import React, { useState } from "react";
import InvoiceLineItemForm from "./InvoiceLineItemForm";
import { getCurrencySymbol } from "../../utils/currency";

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
          width: 20, height: 20, borderRadius: '50%',
          background: '#e0f2fe', border: '1px solid #7dd3fc',
          color: '#0369a1', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', lineHeight: '18px', textAlign: 'center',
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

const InvoiceLineItems = ({ invoice, lineItems, onAdd, onEdit, onDelete, onUpdateInvoice, canEdit }) => {
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Local discount state for toggling without immediately spamming API
  const [localDiscount, setLocalDiscount] = useState(invoice?.discount || 0);
  const [localDiscountType, setLocalDiscountType] = useState(invoice?.discount_type || 'amount');
  const [discountEditing, setDiscountEditing] = useState(false);

  const handleEdit = (lineItem) => {
    setEditingId(lineItem.id);
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSave = async (lineItemData) => {
    if (editingId) {
      await onEdit(editingId, lineItemData);
      setEditingId(null);
    } else {
      await onAdd(lineItemData);
      setShowAddForm(false);
    }
  };

  const handleApplyDiscount = () => {
    onUpdateInvoice({
      discount: parseFloat(localDiscount) || 0,
      discount_type: localDiscountType
    });
    setDiscountEditing(false);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount || 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
          <GSTInfoPopover />
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
            }}
            className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition text-sm font-medium"
          >
            + Add Item
          </button>
        )}
      </div>


      {showAddForm && !editingId && (
        <InvoiceLineItemForm
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {lineItems && lineItems.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lineItems.map((item) => (
                <tr key={item.id}>
                  {editingId === item.id ? (
                    <td colSpan={canEdit ? 5 : 4} className="p-0">
                      <div className="p-2 border-2 border-blue-400 m-1 rounded-lg">
                        <InvoiceLineItemForm
                          lineItem={item}
                          onSave={handleSave}
                          onCancel={handleCancel}
                        />
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatAmount(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatAmount(item.amount)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <p>No line items found. {canEdit && "Click 'Add Item' to start building this invoice."}</p>
        </div>
      )}

      {/* Backend-Calculated Totals Row */}
      {invoice && (
        <div className="border-t border-gray-200 pt-4 mt-6">
          <div className="flex justify-end pr-4">
            <div className="w-[300px] flex flex-col gap-2">
              
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span className="font-medium text-gray-900">{formatAmount(invoice.subtotal)}</span>
              </div>

              {/* Discount Row */}
              {canEdit ? (
                <div className="flex items-center justify-between group pt-1 pb-1">
                  <span className="text-sm text-gray-600 flex items-center gap-1 cursor-pointer" onClick={() => setDiscountEditing(true)}>
                    Discount:
                    {!discountEditing && (
                      <svg className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    )}
                  </span>

                  {discountEditing ? (
                    <div className="flex items-center gap-2">
                       <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                        <button type="button" onClick={() => setLocalDiscountType('percentage')} className={`px-2 py-0.5 text-xs font-semibold rounded-md ${localDiscountType === 'percentage' ? 'bg-white shadow-sm text-[#2a276e]' : 'text-gray-500'}`}>%</button>
                        <button type="button" onClick={() => setLocalDiscountType('amount')} className={`px-2 py-0.5 text-xs font-semibold rounded-md ${localDiscountType === 'amount' ? 'bg-white shadow-sm text-[#2a276e]' : 'text-gray-500'}`}>{getCurrencySymbol()}</button>
                      </div>
                      <input 
                        type="number"
                        min="0"
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-right"
                        value={localDiscount}
                        onChange={(e) => setLocalDiscount(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleApplyDiscount} className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-200 transition">Apply</button>
                    </div>
                  ) : (
                    <span 
                      className="text-sm font-medium text-red-600 cursor-pointer hover:bg-gray-100 px-1 rounded transition"
                      onClick={() => setDiscountEditing(true)}
                    >
                      - {formatAmount(invoice.discount_amount)}
                    </span>
                  )}
                </div>
              ) : (
                invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Discount:</span>
                    <span className="font-medium text-red-600">- {formatAmount(invoice.discount_amount)}</span>
                  </div>
                )
              )}

              {invoice.tax > 0 && (
                 <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax:</span>
                  <span className="font-medium text-gray-900">{formatAmount(invoice.tax)}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-1">
                <span className="text-gray-900">Total:</span>
                <span className="text-[#25D366]">{formatAmount(invoice.total)}</span>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceLineItems;
