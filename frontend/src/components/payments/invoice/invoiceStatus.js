import { clinicDateKey, clinicToday, parseServerDate } from '../../../utils/datetime';

/**
 * The one place invoice status becomes something a receptionist can read.
 *
 * Lifted out of InvoiceHeader so the title block and anything else that needs a
 * status pill agree on the wording. The mapping is not identity: a `finalized`
 * invoice reads "Unpaid" on the day it was raised and "Pending" after that,
 * because chasing money on the same afternoon it was billed is not the same job
 * as chasing it a week later.
 */
export const statusLabel = (invoice) => {
  if (!invoice) return { label: 'Draft', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
  const { status, created_at } = invoice;
  // Compared as clinic-local calendar days. Two bare new Date()s here compared
  // the viewer's day against a UTC value read as local time, so an invoice
  // raised in the evening stopped counting as "today" once IST crossed 18:30.
  const raisedToday = !!created_at && clinicDateKey(created_at) === clinicToday();

  switch (status) {
    case 'draft':
      return { label: 'Incomplete', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
    case 'finalized':
      return { label: raisedToday ? 'Unpaid' : 'Pending', tone: 'bg-red-50 text-red-700 border-red-200' };
    case 'partially_paid':
      return { label: 'Partial', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'paid_verified':
    case 'paid_unverified':
      return { label: 'Paid', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'bg-gray-100 text-gray-500 border-gray-200' };
    default:
      return { label: status || 'Draft', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
};

/**
 * How long money has been outstanding, counted from the day the bill was
 * issued.
 *
 * The mockup wanted "Due in 10 days", but invoices carry no due date and the
 * clinic agrees no payment terms, so a countdown would be inventing a deadline
 * nobody set. Age is the fact we actually hold. `overdue` at 30 days matches the
 * aged-30d+ bucket the Payments page already uses, so the same bill is not
 * "fine" on one screen and "overdue" on another.
 */
export const outstandingAge = (invoice) => {
  if (!invoice || Number(invoice.due_amount || 0) <= 0) return null;
  const from = parseServerDate(invoice.finalized_at || invoice.created_at);
  if (!from) return null;

  const days = Math.floor((Date.now() - from.getTime()) / 86400000);
  if (days < 0) return null;
  const text = days === 0 ? 'Raised today' : `Outstanding ${days} day${days === 1 ? '' : 's'}`;
  return { days, text, overdue: days >= 30 };
};

/**
 * The three figures every money surface on this invoice needs, derived once.
 *
 * The legacy correction is the reason this is shared rather than inlined: older
 * bills were marked paid without their paid_amount ever being written, so the
 * stored figure reads 0 against a balance of 0. Status and balance agree, so
 * they win over the blank column. That rule was copied into three components
 * and would have drifted the moment one of them changed.
 */
export const invoiceMoney = (invoice) => {
  const total = Number(invoice?.total || 0);
  const due = Number(invoice?.due_amount ?? Math.max(total - Number(invoice?.paid_amount || 0), 0));
  const settledStatus = ['paid_verified', 'paid_unverified'].includes(invoice?.status);
  const rawPaid = Number(invoice?.paid_amount || 0);
  const paid = (settledStatus && due <= 0 && rawPaid <= 0) ? total : rawPaid;
  return { total, paid, due, settled: due <= 0 && total > 0 };
};
