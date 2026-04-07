import React, { useState } from "react";
import InvoiceLineItemForm from "./InvoiceLineItemForm";

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
        <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
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
                        <button type="button" onClick={() => setLocalDiscountType('amount')} className={`px-2 py-0.5 text-xs font-semibold rounded-md ${localDiscountType === 'amount' ? 'bg-white shadow-sm text-[#2a276e]' : 'text-gray-500'}`}>₹</button>
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
