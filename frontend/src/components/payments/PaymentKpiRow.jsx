import React from 'react';
import { Wallet, Clock, CalendarClock, Banknote, TrendingUp, Receipt, Scale, Tag } from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';

/**
 * The four storytelling KPI cards above the Payments table.
 *
 * Every card is built from the same `/invoices/summary` payload the table's
 * filters produce, so narrowing to one patient or one month moves the cards and
 * the rows together. The narrative sentences are composed here, next to the
 * figures they name, rather than inside MetricCard.
 */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const ico = (Icon) => <Icon size={15} />;

/**
 * Builds the change pill for one card.
 *
 * Worth being precise about what these arrows mean. The headline on each card
 * describes everything the page's filters select, which is all of history until
 * somebody sets a date range. A percentage needs two comparable windows, so the
 * backend measures these separately: this calendar month so far against the
 * same span of last month. The two are deliberately different windows, so the
 * pill carries a label naming both figures rather than leaving a bare
 * percentage to be read against the number beside it.
 *
 * Returns an empty object when there is nothing to compare, which leaves the
 * card with no pill rather than one asserting a flat zero.
 */
const changePill = (metric, cmpLabel, fmt) => {
  if (!metric || metric.change === null || metric.change === undefined) return {};
  const [now, before] = cmpLabel === 'vs last month'
    ? ['this month', 'last month']
    : ['this period', 'the period before'];
  return {
    change: metric.change,
    changeType: metric.change_type,
    changeLabel: `${fmt(metric.current)} ${now} vs ${fmt(metric.previous)} ${before}`,
  };
};

/** All-payments tab: where the money is, and where it's stuck. */
function paymentsCards(s) {
  const billed = s.billed || 0;
  const collected = s.collected || 0;
  const out = s.outstanding || {};
  const plans = s.plans || {};
  const methods = s.methods || {};
  const cmp = s.comparison || {};

  const collectionRate = pct(collected, billed);
  const agedPct = pct(out.aged_amount, out.amount);

  return [
    {
      key: 'collected',
      isMoney: true,
      title: 'Collected',
      display: formatCompactMoney(collected),
      ...changePill(cmp.collected, cmp.label, formatCompactMoney),
      icon: ico(Wallet),
      variant: 'meter',
      story: billed > 0
        ? `Of ${formatMoney(billed)} billed. The rest is either owed or never issued.`
        : 'Nothing has been billed in this selection.',
      storyShort: billed > 0 ? `of ${formatCompactMoney(billed)} billed` : 'Nothing billed',
      meterPercent: collectionRate,
      meterLeft: billed > 0 ? `${collectionRate}% collection rate` : '',
      meterRight: plans.payments_total
        ? `${formatCount(plans.payments_total)} payments`
        : '',
    },
    {
      key: 'outstanding',
      isMoney: true,
      title: 'Outstanding',
      display: formatCompactMoney(out.amount),
      ...changePill(cmp.outstanding, cmp.label, formatCompactMoney),
      // Money owed going up is bad news, so the pill has to invert.
      invert: true,
      icon: ico(Clock),
      variant: 'meter',
      story: out.invoices > 0
        ? `${formatCount(out.patients)} ${out.patients === 1 ? 'patient owes' : 'patients owe'} you. Oldest bill is ${out.oldest_days} days old.`
        : 'Nothing outstanding. Every issued invoice is settled.',
      storyShort: out.invoices > 0 ? `${formatCount(out.patients)} patients` : 'All settled',
      meterPercent: agedPct,
      meterTone: 'warn',
      meterLeft: out.invoices > 0 ? `${agedPct}% aged 30d+` : '',
      meterRight: out.invoices > 0
        ? `${formatCount(out.invoices)} ${out.invoices === 1 ? 'invoice' : 'invoices'}`
        : '',
    },
    {
      key: 'plans',
      title: 'On payment plans',
      display: formatCount(plans.open || 0),
      // More bills going onto instalments is not obviously good or bad, so this
      // one stays uninverted and is read as a fact rather than a score.
      ...changePill(cmp.plans, cmp.label, formatCount),
      icon: ico(CalendarClock),
      variant: 'spark',
      // The sparkline is the distribution of plan lengths, not a time series —
      // tallest bar = the most common number of instalments.
      sparkline: (plans.histogram || []).map((h) => h.invoices),
      // A distribution, not a time series: highlight the most common plan
      // length rather than the rightmost bar, which is the rarest case.
      sparklineHighlight: 'max',
      story: plans.open > 0
        ? `Bills mid-instalment. A typical plan here runs ${plans.median_length} ${plans.median_length === 1 ? 'payment' : 'payments'}.`
        : 'No invoice is part-way through a payment plan.',
      storyShort: plans.open > 0 ? `typically ${plans.median_length} payments` : 'None open',
    },
    {
      key: 'methods',
      isMoney: true,
      title: 'How money arrives',
      display: `${methods.cash_share || 0}%`,
      icon: ico(Banknote),
      variant: 'breakdown',
      story: methods.cash_share >= 70
        ? 'Almost everything is cash. Worth knowing before you reconcile.'
        : methods.cash_share <= 30
          ? 'Mostly digital, so most of it reconciles itself.'
          : 'A roughly even split between cash and digital.',
      storyShort: 'cash share',
      rows: [
        { label: 'Cash', value: formatCompactMoney(methods.cash), color: '#2a276e' },
        { label: 'Digital', value: formatCompactMoney(methods.digital), color: '#9B8CFF' },
      ],
    },
  ];
}

/** Today's collection tab: what came in on the selected day, and how. */
function todayCards(s, prev) {
  const total = s.todayRevenue || 0;
  const cash = s.todayCash || 0;
  const online = s.todayOnline || 0;
  const cashShare = pct(cash, total);

  const delta = (cur, before) => {
    if (!before || before === 0) return { change: 0, changeType: 'up' };
    const c = Math.round(((cur - before) / before) * 1000) / 10;
    return { change: Math.abs(c), changeType: c >= 0 ? 'up' : 'down' };
  };

  return [
    {
      key: 'today_total',
      isMoney: true,
      title: 'Collected',
      display: formatCompactMoney(total),
      ...delta(total, prev?.total),
      icon: ico(TrendingUp),
      variant: 'meter',
      story: total > 0
        ? `${formatMoney(total)} taken across ${formatCount(s.todayCount || 0)} ${s.todayCount === 1 ? 'payment' : 'payments'}.`
        : 'Nothing collected on this day yet.',
      storyShort: total > 0 ? `${formatCount(s.todayCount || 0)} payments` : 'Nothing yet',
      meterPercent: cashShare,
      meterLeft: total > 0 ? `${cashShare}% cash` : '',
      meterRight: prev?.total ? `${formatCompactMoney(prev.total)} last week` : '',
    },
    {
      key: 'today_cash',
      isMoney: true,
      title: 'Cash',
      display: formatCompactMoney(cash),
      ...delta(cash, prev?.cash),
      icon: ico(Banknote),
      variant: 'plain',
      story: cash > 0
        ? `${cashShare}% of the day. This is what should be in the drawer at close.`
        : 'No cash taken on this day.',
      storyShort: cash > 0 ? `${cashShare}% of the day` : 'None',
    },
    {
      key: 'today_online',
      isMoney: true,
      title: 'Digital',
      display: formatCompactMoney(online),
      ...delta(online, prev?.online),
      icon: ico(Receipt),
      variant: 'plain',
      story: online > 0
        ? `${100 - cashShare}% of the day, straight to the bank.`
        : 'Nothing digital on this day.',
      storyShort: online > 0 ? `${100 - cashShare}% of the day` : 'None',
    },
    {
      key: 'today_receipts',
      title: 'Receipts issued',
      display: formatCount(s.todayCount || 0),
      icon: ico(Tag),
      variant: 'breakdown',
      story: 'Each row on the list below is one receipt.',
      storyShort: 'one per row below',
      rows: [
        { label: 'Cash', value: formatCompactMoney(cash), color: '#2a276e' },
        { label: 'Digital', value: formatCompactMoney(online), color: '#9B8CFF' },
      ],
    },
  ];
}

/** Ledger tab: in, out, what's left. */
function ledgerCards(l) {
  const income = l.inflow || 0;
  const expenses = l.outflow || 0;
  const net = l.net || 0;
  const ratio = pct(expenses, income);

  return [
    {
      key: 'ledger_in',
      isMoney: true,
      title: 'Money in',
      display: formatCompactMoney(income),
      icon: ico(TrendingUp),
      variant: 'plain',
      story: income > 0 ? 'Everything received in this window.' : 'No income recorded here.',
      storyShort: income > 0 ? 'received' : 'none',
    },
    {
      key: 'ledger_out',
      isMoney: true,
      title: 'Money out',
      display: formatCompactMoney(expenses),
      invert: true,
      icon: ico(Wallet),
      variant: 'plain',
      story: l.expensesCount > 0
        ? `Across ${formatCount(l.expensesCount)} recorded ${l.expensesCount === 1 ? 'expense' : 'expenses'}.`
        : 'No expenses recorded yet.',
      storyShort: l.expensesCount > 0 ? `${formatCount(l.expensesCount)} expenses` : 'none',
    },
    {
      key: 'ledger_net',
      isMoney: true,
      title: 'Net',
      display: formatCompactMoney(net),
      icon: ico(Scale),
      variant: 'meter',
      story: income > 0
        ? `${ratio}% of what came in went back out.`
        : 'Net is whatever is left after expenses.',
      storyShort: income > 0 ? `${ratio}% spent` : '',
      meterPercent: ratio,
      meterTone: ratio > 70 ? 'warn' : undefined,
      meterLeft: income > 0 ? `${ratio}% spent` : '',
      meterRight: net >= 0 ? 'in surplus' : 'in deficit',
    },
    {
      key: 'ledger_top',
      title: 'Where it went',
      display: l.topCategory || '—',
      icon: ico(Tag),
      variant: 'breakdown',
      story: l.topCategory
        ? 'Your largest expense category in this window.'
        : 'Record expenses to see where the money goes.',
      storyShort: l.topCategory ? 'largest category' : 'nothing yet',
      rows: (l.categories || []).slice(0, 3).map((c, i) => ({
        label: c.category,
        value: formatCompactMoney(c.amount),
        color: ['#2a276e', '#9B8CFF', '#c9c3f5'][i] || '#c9c3f5',
      })),
    },
  ];
}

const PaymentKpiRow = ({ tab, summary, todayPrevious, ledgerStats, onSelect }) => {
  const cards =
    tab === 'today' ? todayCards(summary || {}, todayPrevious)
      : tab === 'ledger' ? ledgerCards(ledgerStats || {})
        : paymentsCards(summary || {});

  return <KpiRow cards={cards} onSelect={onSelect} />;
};

export default PaymentKpiRow;
