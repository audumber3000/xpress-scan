import React, { useMemo } from 'react';
import Spinner from '../../common/Spinner';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate } from '../../../utils/datetime';

/**
 * What is owed, since when, and on which bill.
 *
 * "Due since" is the oldest unpaid invoice, not the newest — the age of a debt
 * is measured from when it started, and showing the most recent bill's date
 * would make a four-month-old balance look like a fresh one.
 *
 * The whole card disappears when nothing is owed. A card reading "₹0.00 due
 * since —" is a row of blanks pretending to be information.
 */
const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Line = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-xs text-gray-600">{label}</span>
    <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${tone || 'text-gray-900'}`}>{value}</span>
  </div>
);

const OutstandingCard = ({ invoices = [], onRemind, reminding = false }) => {
  const info = useMemo(() => {
    const owing = invoices
      .filter((i) => Number(i.due_amount || 0) > 0)
      .filter((i) => !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()))
      .sort((a, b) => new Date(a.finalized_at || a.created_at || 0) - new Date(b.finalized_at || b.created_at || 0));
    if (!owing.length) return null;
    const oldest = owing[0];
    const since = oldest.finalized_at || oldest.created_at;
    const days = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : null;
    return {
      due: owing.reduce((s, i) => s + Number(i.due_amount || 0), 0),
      since,
      days,
      // The bill the reminder will be about: the oldest one still owing.
      invoice: oldest,
    };
  }, [invoices]);

  if (!info) return null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Outstanding</h3>
      </div>

      <div className="m-3 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
        <Line label="Amount due" value={money(info.due)} tone="text-red-600" />
        <Line
          label="Due since"
          value={info.since
            ? `${formatDate(info.since)}${info.days != null ? ` (${info.days}d)` : ''}`
            : '—'}
        />
        <Line label="Oldest invoice" value={info.invoice.invoice_number || `#${info.invoice.id}`} />

        <button
          type="button"
          onClick={() => onRemind(info.invoice)}
          disabled={reminding}
          className="mt-2.5 w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {reminding ? <Spinner className="w-4 h-4" /> : <WhatsAppIcon size={16} brand />}
          {reminding ? 'Preparing' : 'Send reminder'}
        </button>
      </div>
    </section>
  );
};

export default OutstandingCard;
