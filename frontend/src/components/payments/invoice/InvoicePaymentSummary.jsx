import React from 'react';
import { ChevronRight } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import Spinner from '../../common/Spinner';
import { getCurrencySymbol } from '../../../utils/currency';
import PaymentDonut from './PaymentDonut';
import { invoiceMoney } from './invoiceStatus';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Where the money stands, and the two things you can do about it. The third
 * cell of the summary strip.
 *
 * A draft has nothing billed yet, so a ring of zero against zero would be a
 * picture of nothing. It states the run-up instead.
 */
const InvoicePaymentSummary = ({
  invoice,
  onRecordPayment,
  onSendReminder,
  sendingReminder,
}) => {
  const isDraft = invoice?.status === 'draft';
  const { total, paid, due } = invoiceMoney(invoice);
  const canRecord = ['finalized', 'partially_paid'].includes(invoice?.status);
  const canRemind = due > 0 && !isDraft && !!invoice?.patient_phone && invoice?.status !== 'cancelled';

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Payment summary</p>

      {isDraft ? (
        <>
          <p className="text-[15px] font-bold text-gray-900 tabular-nums">{money(total)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Nothing owed yet. Issue the invoice to collect against it.</p>
        </>
      ) : (
        <PaymentDonut total={total} paid={paid} due={due} />
      )}

      {(canRecord || canRemind) && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {canRecord && (
            <button
              type="button"
              onClick={onRecordPayment}
              className="w-full px-3 py-1.5 border border-[#2a276e]/30 bg-indigo-50/60 text-[#2a276e] rounded-lg hover:bg-indigo-50 transition-colors font-semibold text-[12px]"
            >
              + Record payment
            </button>
          )}
          {canRemind && (
            <button
              type="button"
              onClick={onSendReminder}
              disabled={sendingReminder}
              title="Shares the invoice on WhatsApp"
              className="w-full inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-[12px] disabled:opacity-50"
            >
              <WhatsAppIcon size={13} brand />
              <span className="flex-1 text-left">Send bill again</span>
              {sendingReminder ? <Spinner className="w-3 h-3" /> : <ChevronRight size={13} className="text-gray-400" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoicePaymentSummary;
