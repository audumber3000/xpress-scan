import React from 'react';
import PaymentDonut from './PaymentDonut';
import SendReminderCard from './SendReminderCard';
import InvoiceTotals from './InvoiceTotals';

const Panel = ({ title, action, children }) => (
  <section className="rounded-lg border border-gray-200 p-3.5">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

/**
 * The right-hand column: the whole money story in one card, then what you can do
 * about it.
 *
 * The breakdown used to sit in the left column under the line items. That split
 * the figures across both columns and, once the timeline moved to its own tab,
 * left this one ending halfway up the drawer against a long column of dead
 * space. Billed on the left, owed on the right.
 *
 * A draft has no money story to tell — nothing has been billed, so a ring of
 * zero against zero would be a picture of nothing. It shows the run-up instead.
 */
const InvoiceMoneyPanel = ({
  invoice,
  canEdit,
  onUpdateInvoice,
  onRecordPayment,
  onViewPayments,
  onViewActivity,
  onSendReminder,
  sendingReminder,
}) => {
  if (!invoice) return null;

  const isDraft = invoice.status === 'draft';
  const total = Number(invoice.total || 0);
  const due = Number(invoice.due_amount ?? Math.max(total - Number(invoice.paid_amount || 0), 0));
  const settledStatus = ['paid_verified', 'paid_unverified'].includes(invoice.status);
  // Older bills were marked paid without ever having their paid_amount written,
  // so the stored figure reads 0 against a balance of 0. Taken at face value the
  // ring would be a full amber "nothing collected" on a bill that is settled —
  // and that is most of the paid invoices in the book, not an edge case. The
  // status and the balance agree, so they win over the blank column.
  const rawPaid = Number(invoice.paid_amount || 0);
  const paid = (settledStatus && due <= 0 && rawPaid <= 0) ? total : rawPaid;
  const paymentCount = (invoice.payments || []).length;
  const canRecord = ['finalized', 'partially_paid'].includes(invoice.status);
  const canRemind = due > 0 && !isDraft && !!invoice.patient_phone && invoice.status !== 'cancelled';

  return (
    <div className="space-y-3">
      <Panel
        title="Payment summary"
        action={
          paymentCount > 0 ? (
            <button
              type="button"
              onClick={onViewPayments}
              className="text-[11px] font-semibold text-[#2a276e] hover:underline"
            >
              {paymentCount} payment{paymentCount === 1 ? '' : 's'}
            </button>
          ) : null
        }
      >
        {!isDraft && (
          <>
            <PaymentDonut total={total} paid={paid} due={due} />
            <div className="my-3 border-t border-gray-100" />
          </>
        )}

        <InvoiceTotals invoice={invoice} canEdit={canEdit} onUpdateInvoice={onUpdateInvoice} />

        {isDraft && (
          <p className="text-[11px] text-gray-500 mt-2">
            Nothing is owed yet. Generate the final invoice to start collecting against it.
          </p>
        )}

        <button
          type="button"
          onClick={onViewActivity}
          className="mt-3 pt-2.5 border-t border-gray-100 w-full text-[11px] font-semibold text-[#2a276e] hover:underline text-left"
        >
          View full activity →
        </button>
      </Panel>

      {canRecord && (
        <button
          type="button"
          onClick={onRecordPayment}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-[#2a276e]/30 bg-indigo-50/60 text-[#2a276e] rounded-lg hover:bg-indigo-50 transition-colors font-semibold text-[13px]"
        >
          + Record payment
        </button>
      )}

      {canRemind && (
        <SendReminderCard onSend={onSendReminder} sending={sendingReminder} />
      )}
    </div>
  );
};

export default InvoiceMoneyPanel;
