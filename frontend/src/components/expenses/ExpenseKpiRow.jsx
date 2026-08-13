import React from 'react';
import {
  Wallet, FlaskConical, Stethoscope, Building2,
  TrendingUp, Scale, Tag, Users,
} from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';

/**
 * The storytelling KPI cards above the Expenses table.
 *
 * Deliberately the same shape as PaymentKpiRow: same MetricCard variants, same
 * one-sentence story under every figure, same KpiRow grid. Money out is read
 * against money in or it means nothing, so the two screens have to be legible
 * as one pair rather than as two different products.
 *
 * Every card is built from the payload the table's own filters produced, so
 * narrowing to one month or one kind moves the cards and the rows together.
 */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const ico = (Icon) => <Icon size={15} />;

const plural = (n, one, many) => (n === 1 ? one : many);

/** Payables tab: what is owed, to whom, for work already done. */
function payablesCards(p) {
  const unpaid = p.unpaid || 0;
  const paid = p.paid || 0;
  const total = unpaid + paid;
  const owedPct = pct(unpaid, total);

  const lab = p.byKind?.lab || { amount: 0, count: 0 };
  const consultant = p.byKind?.consultant || { amount: 0, count: 0 };
  const vendors = p.vendors || [];

  return [
    {
      key: 'owed',
      isMoney: true,
      title: 'Owed right now',
      display: formatCompactMoney(unpaid),
      icon: ico(Wallet),
      variant: 'meter',
      // Invert: a rise in what you owe is not good news, and the shared
      // delta colouring would otherwise render it in confident green.
      invert: true,
      story: p.unpaidCount > 0
        ? `Across ${formatCount(p.unpaidCount)} ${plural(p.unpaidCount, 'bill', 'bills')} to ${formatCount(vendors.length)} ${plural(vendors.length, 'payee', 'payees')}, for work already done.`
        : 'Nothing outstanding. Every bill recorded here has been settled.',
      storyShort: p.unpaidCount > 0 ? `${formatCount(p.unpaidCount)} unpaid` : 'all settled',
      meterPercent: owedPct,
      meterTone: owedPct > 70 ? 'warn' : undefined,
      meterLeft: total > 0 ? `${owedPct}% still owed` : '',
      meterRight: paid > 0 ? `${formatCompactMoney(paid)} settled` : '',
    },
    {
      key: 'lab',
      isMoney: true,
      title: 'Lab bills',
      display: formatCompactMoney(lab.amount),
      icon: ico(FlaskConical),
      variant: 'plain',
      invert: true,
      story: lab.count > 0
        ? `${formatCount(lab.count)} unpaid lab ${plural(lab.count, 'bill', 'bills')}. Putting a cost on a lab order raises one.`
        : 'A cost on a lab order raises a payable here automatically.',
      storyShort: lab.count > 0 ? `${formatCount(lab.count)} unpaid` : 'none open',
    },
    {
      key: 'consultant',
      isMoney: true,
      title: 'Consultant fees',
      display: formatCompactMoney(consultant.amount),
      icon: ico(Stethoscope),
      variant: 'plain',
      invert: true,
      story: consultant.count > 0
        ? `Owed on ${formatCount(consultant.count)} ${plural(consultant.count, 'case', 'cases')} to visiting doctors.`
        : 'Fees added from a case paper land here before they are paid.',
      storyShort: consultant.count > 0 ? `${formatCount(consultant.count)} cases` : 'none open',
    },
    {
      key: 'payees',
      title: 'Who you owe',
      display: vendors[0]?.name || '—',
      icon: ico(Building2),
      variant: 'breakdown',
      story: vendors.length > 0
        ? `Your largest outstanding balance, of ${formatCount(vendors.length)} ${plural(vendors.length, 'payee', 'payees')}.`
        : 'Labs and consultants you owe money to are listed here.',
      storyShort: vendors.length > 0 ? 'largest balance' : 'nobody yet',
      rows: vendors.slice(0, 3).map((v, i) => ({
        label: v.name,
        value: formatCompactMoney(v.amount),
        color: ['#2a276e', '#9B8CFF', '#c9c3f5'][i] || '#c9c3f5',
      })),
    },
  ];
}

/**
 * Ledger tab: everything in and everything out.
 *
 * Money out leads here where money in leads on Payments. Same four figures,
 * ordered by which screen you are standing on.
 */
function ledgerCards(l) {
  const income = l.inflow || 0;
  const expenses = l.outflow || 0;
  const net = income - expenses;
  const ratio = pct(expenses, income);

  return [
    {
      key: 'out',
      isMoney: true,
      title: 'Money out',
      display: formatCompactMoney(expenses),
      icon: ico(Wallet),
      variant: 'meter',
      invert: true,
      story: l.expensesCount > 0
        ? `Across ${formatCount(l.expensesCount)} recorded ${plural(l.expensesCount, 'expense', 'expenses')} in this window.`
        : 'Nothing has gone out in this window.',
      storyShort: l.expensesCount > 0 ? `${formatCount(l.expensesCount)} expenses` : 'nothing out',
      meterPercent: ratio,
      meterTone: ratio > 70 ? 'warn' : undefined,
      meterLeft: income > 0 ? `${ratio}% of what came in` : '',
      meterRight: income > 0 ? `of ${formatCompactMoney(income)}` : '',
    },
    {
      key: 'in',
      isMoney: true,
      title: 'Money in',
      display: formatCompactMoney(income),
      icon: ico(TrendingUp),
      variant: 'plain',
      // Here so the number above it means something. Collections themselves
      // are Payments' subject, and this card links across to it.
      story: income > 0
        ? 'Everything collected in the same window, so the figure above has something to be measured against.'
        : 'No collections in this window to measure spending against.',
      storyShort: income > 0 ? 'collected' : 'nothing in',
    },
    {
      key: 'net',
      isMoney: true,
      title: 'Net',
      display: formatCompactMoney(net),
      icon: ico(Scale),
      variant: 'plain',
      badge: income > 0 || expenses > 0 ? (net >= 0 ? 'in surplus' : 'in deficit') : undefined,
      badgeTone: net >= 0 ? 'good' : 'bad',
      story: income > 0
        ? `What is left after ${formatMoney(expenses)} of spending.`
        : 'Net is whatever is left once expenses come off collections.',
      storyShort: income > 0 ? 'after spending' : '',
    },
    {
      key: 'where',
      title: 'Where it went',
      display: l.topCategory || '—',
      icon: ico(Tag),
      variant: 'breakdown',
      story: l.topCategory
        ? 'Your largest spending category in this window.'
        : 'Record an expense to see where the money goes.',
      storyShort: l.topCategory ? 'largest category' : 'nothing yet',
      rows: (l.categories || []).slice(0, 3).map((c, i) => ({
        label: c.category,
        value: formatCompactMoney(c.amount),
        color: ['#2a276e', '#9B8CFF', '#c9c3f5'][i] || '#c9c3f5',
      })),
    },
  ];
}

/** Vendors tab: who you buy from, and what is open with them. */
function vendorCards(v) {
  const total = v.total || 0;
  const active = v.active || 0;
  const activePct = pct(active, total);

  return [
    {
      key: 'vendors',
      title: 'Vendors',
      display: formatCount(total),
      icon: ico(Building2),
      variant: 'meter',
      story: total > 0
        ? `${formatCount(active)} still active. Inactive ones stay on the list so their history survives.`
        : 'Labs, suppliers and consultants you pay are added here.',
      storyShort: total > 0 ? `${formatCount(active)} active` : 'none yet',
      meterPercent: activePct,
      meterLeft: total > 0 ? `${activePct}% active` : '',
      meterRight: total > active ? `${formatCount(total - active)} dormant` : '',
    },
    {
      key: 'vendor_owed',
      isMoney: true,
      title: 'Owed to vendors',
      display: formatCompactMoney(v.owed || 0),
      icon: ico(Wallet),
      variant: 'plain',
      invert: true,
      story: v.owedCount > 0
        ? `Open across ${formatCount(v.owedCount)} ${plural(v.owedCount, 'payee', 'payees')}. Settle them on the Payables tab.`
        : 'Nothing outstanding with any vendor right now.',
      storyShort: v.owedCount > 0 ? `${formatCount(v.owedCount)} payees` : 'all clear',
    },
    {
      key: 'vendor_kinds',
      title: 'What they supply',
      display: v.categories?.[0]?.category || '—',
      icon: ico(Users),
      variant: 'breakdown',
      story: v.categories?.length
        ? 'Your most common vendor category.'
        : 'Give a vendor a category and this splits itself out.',
      storyShort: v.categories?.length ? 'most common' : 'uncategorised',
      rows: (v.categories || []).slice(0, 3).map((c, i) => ({
        label: c.category,
        value: formatCount(c.count),
        color: ['#2a276e', '#9B8CFF', '#c9c3f5'][i] || '#c9c3f5',
      })),
    },
  ];
}

const ExpenseKpiRow = ({ tab, payables, ledger, vendors, onSelect }) => {
  const cards =
    tab === 'ledger' ? ledgerCards(ledger || {})
      : tab === 'vendors' ? vendorCards(vendors || {})
        : payablesCards(payables || {});

  return <KpiRow cards={cards} onSelect={onSelect} />;
};

export default ExpenseKpiRow;
