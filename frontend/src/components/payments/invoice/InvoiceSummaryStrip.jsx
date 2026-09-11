import React from 'react';
import InvoiceBillTo from './InvoiceBillTo';
import InvoicePaymentMethod from './InvoicePaymentMethod';
import InvoicePaymentSummary from './InvoicePaymentSummary';

/**
 * Who, how, and where it stands — one band across the top of the bill.
 *
 * Three cells divided by hairlines, with no box around them. This is the strip
 * a paper invoice carries above its line items, and running it full width lets
 * the document below it be a document: table, totals, note. The previous
 * two-column split put the figures on one side and the goods on the other,
 * which reads like a dashboard, not a bill.
 *
 * The box went too. The dividers already separate the three cells, and a border
 * around them as well was a frame around a frame — it made the strip compete
 * with the line-items card below, which is the one thing on this screen that
 * genuinely is a container.
 */
const InvoiceSummaryStrip = ({ invoice, onRecordPayment, onSendReminder, sendingReminder }) => {
  if (!invoice) return null;

  return (
    <div className="py-1 mb-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:divide-x md:divide-gray-100">
        <div className="md:pr-4">
          <InvoiceBillTo invoice={invoice} />
        </div>
        <div className="md:px-4 border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
          <InvoicePaymentMethod invoice={invoice} />
        </div>
        <div className="md:pl-4 border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
          <InvoicePaymentSummary
            invoice={invoice}
            onRecordPayment={onRecordPayment}
            onSendReminder={onSendReminder}
            sendingReminder={sendingReminder}
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummaryStrip;
