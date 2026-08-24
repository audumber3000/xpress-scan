import React from 'react';
import { Download, FileText } from 'lucide-react';
import { formatPrice } from '../../../utils/plans';
import { openInvoice } from './invoiceHtml';

/**
 * Billing history.
 *
 * Each row prints in the currency that payment was actually taken in, read from
 * the payment itself rather than from today's settings. A clinic that paid in
 * rupees and later moved abroad should still see rupees against the old rows.
 *
 * Below `sm` each payment is a stacked card rather than a five-column grid.
 * The grid version on a 360px screen put "INV-SUB_12_1724..." and an amount in
 * the same 70px column.
 */
const HistoryTab = ({ history, clinicName }) => {
  if (!history.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
        <FileText size={28} className="mx-auto mb-2 text-gray-200" />
        <p className="text-sm font-medium text-gray-400">No payments yet</p>
        <p className="mt-1 text-xs text-gray-300">
          Invoices appear here once you are on a paid plan.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="hidden grid-cols-5 gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3 sm:grid">
        {['Invoice', 'Plan', 'Amount', 'Date', 'Status'].map((h) => (
          <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</div>
        ))}
      </div>

      <div className="divide-y divide-gray-50">
        {history.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-gray-50/40 sm:grid sm:grid-cols-5 sm:items-center sm:gap-3"
          >
            <span className="truncate font-mono text-xs text-gray-500">{inv.invoice}</span>

            <span className="text-sm text-gray-700">{inv.plan}</span>

            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {formatPrice(inv.amount, inv.currency)}
              {inv.tax_amount ? (
                <span className="ml-1 text-[11px] font-normal text-gray-400">
                  incl. {formatPrice(inv.tax_amount, inv.currency)} tax
                </span>
              ) : null}
            </span>

            <span className="text-xs text-gray-500">{inv.date}</span>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  inv.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${inv.status === 'PAID' ? 'bg-green-500' : 'bg-amber-500'}`} />
                {inv.status}
              </span>
              <button
                onClick={() => openInvoice(inv, clinicName)}
                title="Open invoice"
                aria-label={`Open invoice ${inv.invoice}`}
                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-[#29828a]"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryTab;
