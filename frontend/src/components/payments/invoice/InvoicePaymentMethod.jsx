import React from 'react';

/**
 * How the money came in. One cell of the summary strip.
 *
 * The reference showed a masked phone number and a "View UPI Details" link here.
 * That number is the patient's contact number, not a payment instrument, and the
 * link opened onto nothing — no UPI handle is stored anywhere. The mode and the
 * invoice's UTR are what we actually hold.
 */
const InvoicePaymentMethod = ({ invoice }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Payment method</p>
    {invoice?.payment_mode ? (
      <>
        <p className="text-[13px] font-semibold text-gray-900 truncate" title={invoice.payment_mode}>
          {invoice.payment_mode}
        </p>
        {invoice.utr ? (
          <p className="text-[12px] text-gray-600 truncate" title={invoice.utr}>Ref {invoice.utr}</p>
        ) : (
          <p className="text-[12px] text-gray-400">No reference recorded</p>
        )}
      </>
    ) : (
      <p className="text-[12px] text-gray-400">Set when the first payment is recorded.</p>
    )}
  </div>
);

export default InvoicePaymentMethod;
