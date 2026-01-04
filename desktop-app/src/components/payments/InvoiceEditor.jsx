import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";
import InvoiceHeader from "./InvoiceHeader";
import InvoiceLineItems from "./InvoiceLineItems";
import InvoiceActions from "./InvoiceActions";
import MarkAsPaidModal from "./MarkAsPaidModal";

const InvoiceEditor = ({ invoiceId, onClose, onSave }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/invoices/${invoiceId}`);
      setInvoice(data);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast.error("Failed to load invoice");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineItem = async (lineItemData) => {
    try {
      setSaving(true);
      const updated = await api.post(`/invoices/${invoiceId}/line-items`, lineItemData);
      setInvoice(updated);
      toast.success("Line item added successfully");
    } catch (error) {
      console.error("Error adding line item:", error);
      toast.error("Failed to add line item");
    } finally {
      setSaving(false);
    }
  };

  const handleEditLineItem = async (lineItemId, lineItemData) => {
    try {
      setSaving(true);
      const updated = await api.put(`/invoices/${invoiceId}/line-items/${lineItemId}`, lineItemData);
      setInvoice(updated);
      toast.success("Line item updated successfully");
    } catch (error) {
      console.error("Error updating line item:", error);
      toast.error("Failed to update line item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLineItem = async (lineItemId) => {
    if (!window.confirm("Are you sure you want to delete this line item?")) {
      return;
    }

    try {
      setSaving(true);
      const updated = await api.delete(`/invoices/${invoiceId}/line-items/${lineItemId}`);
      setInvoice(updated);
      toast.success("Line item deleted successfully");
    } catch (error) {
      console.error("Error deleting line item:", error);
      toast.error("Failed to delete line item");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async (paymentData) => {
    try {
      setSaving(true);
      const updated = await api.post(`/invoices/${invoiceId}/mark-as-paid`, paymentData);
      setInvoice(updated);
      toast.success("Invoice marked as paid successfully");
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast.error("Failed to mark invoice as paid");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${baseURL}/invoices/${invoiceId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice?.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    }
  };

  const canEdit = invoice?.status === 'draft';

  if (loading) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />
        <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <GearLoader size="w-8 h-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

        <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Invoice Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <InvoiceHeader invoice={invoice} />
            
            <InvoiceLineItems
              lineItems={invoice?.line_items || []}
              onAdd={handleAddLineItem}
              onEdit={handleEditLineItem}
              onDelete={handleDeleteLineItem}
              canEdit={canEdit}
            />

            {invoice?.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Notes:</h3>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <InvoiceActions
              invoice={invoice}
              onMarkAsPaid={() => setShowMarkPaidModal(true)}
              onDownloadPDF={handleDownloadPDF}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>

      {showMarkPaidModal && (
        <MarkAsPaidModal
          invoice={invoice}
          onClose={() => setShowMarkPaidModal(false)}
          onConfirm={handleMarkAsPaid}
        />
      )}
    </>
  );
};

export default InvoiceEditor;

