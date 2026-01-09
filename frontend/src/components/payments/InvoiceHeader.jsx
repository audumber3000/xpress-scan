import React from "react";

const InvoiceHeader = ({ invoice }) => {
  if (!invoice) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: "bg-gray-100 text-gray-800 border-gray-200", dot: "bg-gray-500" },
      paid_unverified: { color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
      paid_verified: { color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
      cancelled: { color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const label = status === 'paid_unverified' && invoice.payment_mode === 'UPI' 
      ? 'UPI – Unverified' 
      : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
        {label}
      </span>
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
          {getStatusBadge(invoice.status)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Bill To:</h3>
          <div className="text-sm text-gray-900">
            <div className="font-semibold">{invoice.patient_name || 'N/A'}</div>
            {invoice.patient_phone && (
              <div className="text-gray-600">Phone: {invoice.patient_phone}</div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Details:</h3>
          <div className="text-sm text-gray-900 space-y-1">
            <div>Invoice #: {invoice.invoice_number}</div>
            <div>Date: {formatDate(invoice.created_at)}</div>
            {invoice.paid_at && (
              <div>Paid: {formatDate(invoice.paid_at)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHeader;







