import React from "react";

const InvoiceItem = ({ invoice, onSelect }) => {
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status, paymentMode) => {
    const statusConfig = {
      draft: { color: "bg-gray-100 text-gray-800 border-gray-200", dot: "bg-gray-500" },
      paid_unverified: { color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
      paid_verified: { color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
      cancelled: { color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const label = status === 'paid_unverified' && paymentMode === 'UPI' 
      ? 'UPI – Unverified' 
      : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
        {label}
      </span>
    );
  };

  return (
    <tr 
      onClick={() => onSelect(invoice.id)}
      className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
    >
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <span className="text-gray-900 font-medium text-sm">
          {invoice.invoice_number}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="font-semibold text-gray-900">{invoice.patient_name || 'Unknown Patient'}</div>
          <div className="text-sm text-gray-500">Patient</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{invoice.patient_phone || 'N/A'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatAmount(invoice.total)}</td>
      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(invoice.status, invoice.payment_mode)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{invoice.payment_mode || '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatDate(invoice.created_at)}</td>
    </tr>
  );
};

export default InvoiceItem;







