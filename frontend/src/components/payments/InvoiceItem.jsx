import React, { memo, useState } from "react";
import WhatsAppIcon from '../common/WhatsAppIcon';
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import { api } from "../../utils/api";
import { getCurrencySymbol } from "../../utils/currency";
import { formatRelative, clinicDateKey, clinicToday } from "../../utils/datetime";
import { notify } from '../../utils/notify';
import WorkDoneCell from "./WorkDoneCell";
import { useAuth } from "../../contexts/AuthContext";
import { isManualWhatsApp, shareInvoiceManually } from "../../utils/whatsapp";

const InvoiceItem = memo(({ invoice, onSelect }) => {
  const { user } = useAuth();
  const [isSendingWA, setIsSendingWA] = useState(false);

  const handleWhatsApp = async (e) => {
    e.stopPropagation();
    setIsSendingWA(true);
    try {
        // Manual mode (desktop): download the PDF + open WhatsApp from own number.
        if (isManualWhatsApp(user)) {
            const opened = await shareInvoiceManually(invoice, user);
            if (opened) notify.done('Invoice PDF downloaded — attach it in the WhatsApp chat');
            else notify.problem('Patient phone number is required');
        } else {
            await api.post(`/invoices/${invoice.id}/send-whatsapp`);
        }
    } catch (err) {
        notify.problem(err, "Could not send the invoice on WhatsApp");
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
      {/* Invoice number with the patient's ID beneath it — the two references
          someone quotes on the phone, together. */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-[#2a276e]">
          {invoice.invoice_number}
        </div>
        <div className="text-xs text-gray-400">
          {invoice.patient_display_id ? `Patient #${invoice.patient_display_id}` : '—'}
        </div>
      </td>

      {/* Name over contact number, so the phone no longer needs its own column */}
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
            <div className="text-xs text-gray-400">{invoice.patient_phone || 'No phone'}</div>
          </div>
        </div>
      </td>

      {/* The column the phone number was taking up: what this bill was for */}
      <td className="px-6 py-4">
        <WorkDoneCell items={invoice.line_items} />
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
                <WhatsAppIcon size={16} />
              </button>
          )}
        </div>
      </td>
    </tr>
  );
});

InvoiceItem.displayName = "InvoiceItem";

export default InvoiceItem;







