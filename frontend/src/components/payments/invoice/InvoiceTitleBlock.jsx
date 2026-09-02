import React from 'react';
import { FileText, Wallet, IndianRupee } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate, formatDateTime } from '../../../utils/datetime';
import { statusLabel, outstandingAge } from './invoiceStatus';
import InvoiceStatCard from './InvoiceStatCard';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The identity band: which bill this is on the left, the three facts that get
 * asked about at the counter on the right, in one row.
 *
 * Stacking the cards under the title cost a whole band of height and stretched
 * each card to a third of the drawer. Inline and content-sized, the same
 * information takes about half the space.
 *
 * `stats` overrides the cards on the right, so each tab shows the figures it is
 * actually about while the identity half stays identical across all three.
 */
const InvoiceTitleBlock = ({ invoice, stats = null }) => {
  if (!invoice) return null;

  const { label, tone } = statusLabel(invoice);
  const age = outstandingAge(invoice);
  const isDraft = invoice.status === 'draft';
  const settled = !isDraft && Number(invoice.due_amount || 0) <= 0;
  // The serialiser returns payments newest first, so the head of the list is the
  // most recent one. Guarded rather than indexed blindly: a draft has none.
  const lastPayment = (invoice.payments || [])[0] || null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 pb-4 mb-5 border-b border-gray-200">
      <div className="flex items-start gap-2.5 min-w-[260px] flex-1">
        <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
          <FileText size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-gray-900 leading-tight truncate" title={invoice.invoice_number || ''}>
            Invoice #{invoice.invoice_number || '—'}
          </h2>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${tone}`}>
              {label}
            </span>
            {invoice.payment_mode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-600">
                via {invoice.payment_mode}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">Created on {formatDateTime(invoice.created_at)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {stats || <>
        {/* Invoice date and Finalized on are both gone. The first repeated the
            "Created on ..." line two rows above it, and the second was almost
            always the same day again — three cards to say one date. */}
        <InvoiceStatCard
          icon={Wallet}
          tone={lastPayment ? 'emerald' : 'gray'}
          label="Last payment"
          value={lastPayment ? money(lastPayment.amount) : 'None yet'}
          sub={lastPayment
            ? [formatDate(lastPayment.paid_on || lastPayment.created_at), lastPayment.method].filter(Boolean).join(' · ')
            : 'Nothing collected'}
        />
        <InvoiceStatCard
          icon={IndianRupee}
          tone={settled ? 'emerald' : 'red'}
          label={isDraft ? 'Draft total' : 'Balance due'}
          value={money(isDraft ? invoice.total : invoice.due_amount)}
          sub={age ? age.text : (settled ? 'Settled in full' : undefined)}
          subTone={age?.overdue ? 'text-red-600 font-medium' : 'text-gray-400'}
        />
        </>}
      </div>
    </div>
  );
};

export default InvoiceTitleBlock;
