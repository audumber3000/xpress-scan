import React from "react";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import { getCurrencySymbol } from "../../utils/currency";

const InvoiceHeader = ({ invoice }) => {
  if (!invoice) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ", " + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Use the clinic's currency symbol (same source as the rest of the app) so
  // the case-paper invoice matches every other screen instead of falling back to ₹.
  const formatAmount = (amount) =>
    `${getCurrencySymbol()}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (invoice) => {
    const { status, payment_mode, created_at } = invoice;
    const isCreatedToday = created_at && new Date(created_at).toDateString() === new Date().toDateString();
    
    let displayStatus = "Draft";
    let color = "bg-gray-100 text-gray-800 border-gray-200";

    if (status === 'draft') {
        displayStatus = "Incomplete";
    } else if (status === 'finalized') {
        displayStatus = isCreatedToday ? "Unpaid" : "Pending";
        color = "bg-red-100 text-red-800 border-red-200";
    } else if (status === 'partially_paid') {
        displayStatus = "Partial";
        color = "bg-amber-100 text-amber-800 border-amber-200";
    } else if (status === 'paid_verified' || status === 'paid_unverified') {
        displayStatus = "Paid Successfully";
        color = "bg-green-100 text-green-800 border-green-200";
    } else if (status === 'cancelled') {
        displayStatus = "Cancelled";
    }

    return (
      <div className="flex flex-col gap-1 items-end">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${color}`}>
          {displayStatus}
        </span>
        {(status === 'paid_verified' || status === 'paid_unverified' || status === 'partially_paid') && payment_mode && (
          <span className="text-xs text-gray-500 font-medium mr-1">via {payment_mode}</span>
        )}
      </div>
    );
  };

  return (
    <div className="border-b border-gray-200 pb-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoice #{invoice.invoice_number}</h2>
          <p className="text-sm text-gray-600 mt-1">Created on {formatDate(invoice.created_at)}</p>
        </div>
        <div>
          {getStatusBadge(invoice)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Bill To:</h3>
          <div className="flex items-center gap-3">
            <img 
              src={generatePatientPersona({ name: invoice.patient_name }, 80)} 
              onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(invoice.patient_name || 'Patient'); }}
              alt={invoice.patient_name || 'Patient'} 
              className="w-10 h-10 rounded-full flex-shrink-0 object-cover border border-gray-100 shadow-sm"
            />
            <div className="text-sm text-gray-900">
              <div className="font-semibold text-[#2a276e]">{invoice.patient_name || 'N/A'}</div>
              {invoice.patient_phone && (
                <div className="text-gray-600 mt-0.5">{invoice.patient_phone}</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Details:</h3>
          <div className="text-sm text-gray-900 space-y-1">
            <div>Invoice #: {invoice.invoice_number}</div>
            <div>Date: {formatDate(invoice.created_at)}</div>
            {invoice.finalized_at && (
              <div>Finalized: {formatDate(invoice.finalized_at)}</div>
            )}
            {invoice.paid_at && (
              <div>Paid: {formatDate(invoice.paid_at)}</div>
            )}
            {typeof invoice.due_amount === 'number' && invoice.status !== 'draft' && (
              <div className="font-semibold mt-2 pt-2 border-t border-gray-100">Due: {formatAmount(invoice.due_amount || 0)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHeader;







