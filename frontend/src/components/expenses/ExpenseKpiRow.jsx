import React from 'react';
import {
  Wallet, Building2,
  TrendingUp, Scale, Tag, Users,
  Package, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';
import { clinicToday } from '../../utils/datetime';

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
  const agedPct = pct(p.aged || 0, unpaid);

  const lab = p.byKind?.lab || { amount: 0, count: 0 };
  const consultant = p.byKind?.consultant || { amount: 0, count: 0 };
  const bills = p.byKind?.bill || { amount: 0, count: 0 };
  const vendors = p.vendors || [];
  const overdue = p.overdue || 0;

  // Three kinds of payee in one card; they used to be three cards of a single
  // number each.
  const kinds = [
    { label: 'Labs', ...lab, color: '#2a276e' },
    { label: 'Consultants', ...consultant, color: '#9B8CFF' },
    { label: 'Suppliers', ...bills, color: '#c9c3f5' },
  ].filter((k) => k.amount > 0).sort((a, b) => b.amount - a.amount);

  return [
    {
      key: 'owed',
      isMoney: true,
      title: 'Owed right now',
      display: formatCompactMoney(unpaid),
      icon: ico(Wallet),
      invert: true,
      badge: overdue > 0 ? `${formatCompactMoney(overdue)} past due` : null,
      badgeTone: 'bad',
      // How old the debt is, like Outstanding on Payments. It used to be
      // unpaid over (unpaid + paid), which has no meaning of its own.
      variant: unpaid > 0 ? 'meter' : 'plain',
      story: p.unpaidCount > 0
        ? `Across ${formatCount(p.unpaidCount)} ${plural(p.unpaidCount, 'bill', 'bills')} to ${formatCount(vendors.length)} ${plural(vendors.length, 'payee', 'payees')}, for work already done.`
        : 'Nothing outstanding. Every bill recorded here has been settled.',
      storyShort: p.unpaidCount > 0 ? `${formatCount(p.unpaidCount)} unpaid` : 'all settled',
      meterPercent: agedPct,
      meterTone: 'warn',
      meterLeft: unpaid > 0 ? `${agedPct}% older than 30 days` : '',
      meterRight: p.oldestDays > 0 ? `oldest ${p.oldestDays}d` : '',
    },
    {
      key: 'kinds',
      isMoney: true,
      title: 'By kind',
      display: kinds[0]?.label || '—',
      icon: ico(Package),
      variant: kinds.length ? 'breakdown' : 'plain',
      rows: kinds.map((k) => ({
        label: k.label,
        hint: `${formatCount(k.count)} ${plural(k.count, 'bill', 'bills')}`,
        value: formatCompactMoney(k.amount),
        color: k.color,
      })),
      story: kinds.length
        ? `Most of what you owe is to ${kinds[0].label.toLowerCase()}.`
        : 'Lab costs, consultant fees and supplier bills land here until paid.',
      storyShort: kinds.length ? 'largest share' : 'none open',
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
 * Petty cash: the drawer, and whether it still agrees with the record.
 *
 * The balance leads because it is the only reason anyone opens this tab, and
 * the variance card exists because a drawer that is short is the thing a close
 * is FOR. Recording it and not correcting it is the whole design, so it is
 * reported here rather than quietly folded into the balance beside it.
 */
function pettyCashCards(c) {
  const balance = c.balance || 0;
  const toppedUp = c.toppedUp || 0;
  const spent = c.spent || 0;
  const last = c.lastClose || null;
  const variance = last ? last.variance : 0;
  const daysSinceCount = last?.closed_on
    ? Math.max(0, Math.round((new Date(`${clinicToday()}T00:00:00`) - new Date(`${last.closed_on}T00:00:00`)) / 86400000))
    : null;

  return [
    {
      key: 'balance',
      isMoney: true,
      title: 'In the drawer',
      display: formatCompactMoney(balance),
      icon: ico(Wallet),
      // No meter: it was spent over topped-up for an unlabelled 60 days,
      // ignoring the opening balance the headline includes.
      variant: 'plain',
      story: daysSinceCount === null
        ? 'Never counted. Close the day to check the drawer against this figure.'
        : daysSinceCount === 0
          ? 'Counted today.'
          : `Last counted ${daysSinceCount} ${plural(daysSinceCount, 'day', 'days')} ago.`,
      storyShort: daysSinceCount === null ? 'never counted' : `counted ${daysSinceCount}d ago`,
    },
    {
      key: 'spent',
      isMoney: true,
      title: 'Spent, last 60 days',
      display: formatCompactMoney(spent),
      icon: ico(ArrowUpRight),
      variant: 'plain',
      invert: true,
      story: c.spendCount > 0
        ? `Across ${formatCount(c.spendCount)} ${plural(c.spendCount, 'payment', 'payments')} out of the drawer, each one a cash expense in your ledger.`
        : 'Anything paid out of the drawer shows here, and in your ledger as a cash expense.',
      storyShort: c.spendCount > 0 ? `${formatCount(c.spendCount)} out` : 'nothing out',
    },
    {
      key: 'topped',
      isMoney: true,
      title: 'Topped up, last 60 days',
      display: formatCompactMoney(toppedUp),
      icon: ico(ArrowDownLeft),
      variant: 'plain',
      story: 'Money moved from the bank into the drawer. Not an expense, so it is not counted as one.',
      storyShort: toppedUp > 0 ? 'into the drawer' : 'nothing in',
    },
    {
      key: 'close',
      title: last ? 'Last counted' : 'Never counted',
      display: last
        ? (variance === 0 ? 'Balanced' : `${formatCompactMoney(Math.abs(variance))} ${variance < 0 ? 'short' : 'over'}`)
        : '—',
      icon: ico(Scale),
      variant: 'plain',
      badge: last && variance !== 0 ? 'check the drawer' : null,
      badgeTone: 'bad',
      story: last
        ? `Counted on ${last.closed_on} against ${formatCompactMoney(last.expected_amount)} expected. A difference is recorded, never corrected.`
        : 'Close the day to record what was actually in the drawer against what should have been.',
      storyShort: last ? last.closed_on : 'close the day',
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
  const margin = income > 0 ? Math.round((net / income) * 100) : null;
  const weekly = l.weekly || [];

  return [
    {
      key: 'out',
      isMoney: true,
      title: 'Money out',
      display: formatCompactMoney(expenses),
      icon: ico(Wallet),
      // Spend per week. It used to be a meter of out over in, which has no
      // natural 100% and clamped whenever spending ran ahead of collections.
      variant: weekly.some((v) => v > 0) ? 'spark' : 'plain',
      sparkline: weekly,
      sparklineLabels: ['8 weeks ago', 'this week'],
      invert: true,
      story: l.expensesCount > 0
        ? `Across ${formatCount(l.expensesCount)} recorded ${plural(l.expensesCount, 'expense', 'expenses')} in this window.`
        : 'Nothing has gone out in this window.',
      storyShort: l.expensesCount > 0 ? `${formatCount(l.expensesCount)} expenses` : 'nothing out',
    },
    {
      key: 'in',
      isMoney: true,
      title: 'Money in',
      display: formatCompactMoney(income),
      icon: ico(TrendingUp),
      variant: 'plain',
      story: income > 0
        ? 'Everything collected in the same window, to measure spending against.'
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
      // A margin only means something in surplus; "-383% margin" is noise.
      badge: margin !== null && net >= 0 ? `${margin}% margin` : undefined,
      badgeTone: 'good',
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

const ExpenseKpiRow = ({ tab, payables, ledger, vendors, pettyCash, onSelect }) => {
  const cards =
    tab === 'ledger' ? ledgerCards(ledger || {})
      : tab === 'vendors' ? vendorCards(vendors || {})
        : tab === 'petty_cash' ? pettyCashCards(pettyCash || {})
          : payablesCards(payables || {});

  return <KpiRow cards={cards} onSelect={onSelect} />;
};

export default ExpenseKpiRow;
