import React, { useState } from "react";
import InvoiceLineItemForm from "./InvoiceLineItemForm";

const InvoiceLineItems = ({ lineItems, onAdd, onEdit, onDelete, canEdit }) => {
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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
                    <td colSpan={canEdit ? 5 : 4}>
                      <InvoiceLineItemForm
                        lineItem={item}
                        onSave={handleSave}
                        onCancel={handleCancel}
                      />
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
                              className="p-1 text-blue-600 hover:text-blue-800 transition"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="p-1 text-red-600 hover:text-red-800 transition"
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
        <div className="text-center py-8 text-gray-500">
          <p>No line items. {canEdit && "Click 'Add Item' to add items to this invoice."}</p>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-end space-x-6">
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Subtotal:</div>
            <div className="text-sm text-gray-600 mb-1">Tax:</div>
            <div className="text-lg font-semibold text-gray-900">Total:</div>
          </div>
          <div className="text-right min-w-[120px]">
            <div className="text-sm font-medium text-gray-900 mb-1">
              ₹{lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
            </div>
            <div className="text-sm font-medium text-gray-900 mb-1">₹0.00</div>
            <div className="text-lg font-bold text-[#25D366]">
              ₹{lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceLineItems;


