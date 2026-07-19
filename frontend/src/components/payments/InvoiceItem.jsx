import React, { memo, useState } from "react";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import { api } from "../../utils/api";
import { getCurrencySymbol } from "../../utils/currency";
import { formatRelative, clinicDateKey, clinicToday } from "../../utils/datetime";
import { toast } from "react-toastify";

const InvoiceItem = memo(({ invoice, onSelect }) => {
  const [isSendingWA, setIsSendingWA] = useState(false);

  const handleWhatsApp = async (e) => {
    e.stopPropagation();
    setIsSendingWA(true);
    try {
        await api.post(`/invoices/${invoice.id}/send-whatsapp`);
        toast.success("Invoice sent successfully via WhatsApp");
    } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to send invoice via WhatsApp");
    } finally {
        setIsSendingWA(false);
    }
  };
  const formatAmount = (amount) =>
    `${getCurrencySymbol()}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Dates render in the clinic's timezone (see utils/datetime).
  const getRelativeTime = (dateString) => formatRelative(dateString);

  const getStatusBadge = (invoice) => {
    const { status, payment_mode, created_at } = invoice;
    const isCreatedToday = created_at && clinicDateKey(created_at) === clinicToday();
    
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
      <div className="flex flex-col gap-1 items-start">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
          {displayStatus}
        </span>
        {(status === 'paid_verified' || status === 'paid_unverified' || status === 'partially_paid') && payment_mode && (
          <span className="text-xs text-gray-500 font-medium ml-1">via {payment_mode}</span>
        )}
      </div>
    );
  };

  return (
    <tr 
      onClick={() => onSelect(invoice.id)}
      className="hover:bg-indigo-50/30 transition-colors duration-150 cursor-pointer group"
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-semibold text-[#2a276e]">
          {invoice.invoice_number}
        </span>
      </td>
      <td className="px-6 py-5 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <img 
            src={generatePatientPersona({ name: invoice.patient_name }, 80)} 
            onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(invoice.patient_name || 'Patient'); }}
            alt={invoice.patient_name || 'Patient'} 
            className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
          />
          <div>
            <div className="text-sm font-semibold text-gray-900">{invoice.patient_name || 'Unknown Patient'}</div>
            <div className="text-xs text-gray-400">Patient</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-700">{invoice.patient_phone || '—'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-900">{formatAmount(invoice.total)}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(invoice)}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">{getRelativeTime(invoice.created_at).relative}</div>
          <div className="text-xs text-gray-400">{getRelativeTime(invoice.created_at).exact}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onSelect(invoice.id); }}
            className="text-gray-400 hover:text-[#2a276e] transition-colors p-1 rounded-full hover:bg-gray-100"
            title={(invoice.status === 'paid_verified' || invoice.status === 'paid_unverified') ? "View Invoice" : "Edit Invoice"}
          >
            {(invoice.status === 'paid_verified' || invoice.status === 'paid_unverified') ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </button>
          {invoice.patient_phone && invoice.status !== 'draft' && (
              <button 
                onClick={handleWhatsApp}
                disabled={isSendingWA}
                className={`text-gray-400 hover:text-[#25D366] transition-colors p-1 rounded-full hover:bg-gray-100 ${isSendingWA ? 'animate-pulse' : ''}`}
                title="Send via WhatsApp"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </button>
          )}
        </div>
      </td>
    </tr>
  );
});

InvoiceItem.displayName = "InvoiceItem";

export default InvoiceItem;







