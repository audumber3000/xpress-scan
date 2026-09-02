import React from 'react';
import { FileText, CheckCircle2, IndianRupee } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { invoiceMoney } from './invoiceStatus';
import InvoiceStatCard from './InvoiceStatCard';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What the bill came to, what has come in, and what is left.
 *
 * The stat set for the Part payments and Activity tabs. The Invoice tab keeps
 * Last payment and Balance due, because the totals it needs are already spelled
 * out in the stack under its line items — repeating them in the band would be
 * the same figures twice on one screen. These two tabs have no such stack, so
 * this is the only place the arithmetic appears.
 *
 * "Collected" rather than "Total collected": with "Invoice total" alongside it,
 * a third "total" in the row stops distinguishing anything.
 */
const InvoiceCollectionStats = ({ invoice }) => {
  const { total, paid, due } = invoiceMoney(invoice);
  const nothingLeft = due <= 0 && total > 0;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <>
      <InvoiceStatCard
        icon={FileText}
        tone="indigo"
        label="Invoice total"
        value={money(total)}
      />
      <InvoiceStatCard
        icon={CheckCircle2}
        tone={paid > 0 ? 'emerald' : 'gray'}
        label="Collected"
        value={money(paid)}
        sub={paid > 0 ? `${pct}% of the bill` : 'Nothing yet'}
      />
      <InvoiceStatCard
        icon={IndianRupee}
        tone={nothingLeft ? 'emerald' : 'red'}
        label="Balance due"
        value={money(due)}
        sub={nothingLeft ? 'Settled in full' : 'Still to collect'}
        subTone={nothingLeft ? 'text-gray-400' : 'text-red-600 font-medium'}
      />
    </>
  );
};

export default InvoiceCollectionStats;
