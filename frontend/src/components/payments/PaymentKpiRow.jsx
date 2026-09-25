import React from 'react';
import { Wallet, Clock, CalendarClock, Banknote, TrendingUp, Receipt, Scale, Tag } from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';
import { clinicInputParts } from '../../utils/datetime';

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
    // With the base, a move from nothing reads "+₹600" rather than "100%".
    previous: metric.previous,
    value: metric.current,
    changeLabel: `${fmt(metric.current)} ${now} vs ${fmt(metric.previous)} ${before}`,
  };
};

/** All-payments tab: where the money is, and where it's stuck. */
function paymentsCards(s) {
  const billed = s.billed || 0;
  // Collected over the same invoices `billed` counts; older backends lack it.
  const collected = s.collected_issued ?? s.collected ?? 0;
  const out = s.outstanding || {};
  const plans = s.plans || {};
  const methods = s.methods || {};
  const cmp = s.comparison || {};

  const collectionRate = pct(collected, billed);
  const agedPct = pct(out.aged_amount, out.amount);
  const toCollect = Math.max(0, billed - collected);

  const planTotal = (plans.paid_total || 0) + (plans.due_total || 0);
  const planPaidPct = pct(plans.paid_total || 0, planTotal);

  const methodRows = (methods.breakdown || []).filter((m) => m.amount > 0);
  const viaMethods = methodRows.reduce((t, m) => t + m.amount, 0);
  const top = methodRows[0];
  const topShare = top ? pct(top.amount, viaMethods) : 0;
  const METHOD_COLORS = ['#2a276e', '#9B8CFF', '#c9c3f5'];

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
        ? `Of ${formatMoney(billed)} billed.`
        : 'Nothing has been billed in this selection.',
      storyShort: billed > 0 ? `of ${formatCompactMoney(billed)} billed` : 'Nothing billed',
      meterPercent: collectionRate,
      meterLeft: billed > 0 ? `${collectionRate}% collected` : '',
      meterRight: toCollect > 0 ? `${formatCompactMoney(toCollect)} still to collect` : '',
    },
    {
      key: 'outstanding',
      isMoney: true,
      title: 'Outstanding',
      display: formatCompactMoney(out.amount),
      // No trend pill: the old one compared unpaid on invoices *created* this
      // month with last month's, which is not a change in what is owed.
      invert: true,
      badge: out.over_90_count > 0 ? `${formatCount(out.over_90_count)} over 90 days` : null,
      badgeTone: 'bad',
      icon: ico(Clock),
      variant: 'meter',
      story: out.invoices > 0
        ? `${formatCount(out.patients)} ${out.patients === 1 ? 'patient owes' : 'patients owe'} you, on ${formatCount(out.invoices)} ${out.invoices === 1 ? 'bill' : 'bills'}.`
        : 'Nothing outstanding. Every issued invoice is settled.',
      storyShort: out.invoices > 0 ? `${formatCount(out.patients)} patients` : 'All settled',
      meterPercent: agedPct,
      meterTone: 'warn',
      meterLeft: out.invoices > 0 ? `${agedPct}% older than 30 days` : '',
      meterRight: out.oldest_days > 0 ? `oldest ${out.oldest_days}d` : '',
    },
    {
      key: 'plans',
      title: 'On payment plans',
      display: formatCount(plans.open || 0),
      ...changePill(cmp.plans, cmp.label, formatCount),
      icon: ico(CalendarClock),
      // How far through their bills the open plans are, in money. It used to
      // be bars of how many payments *every* paid invoice took, where "paid in
      // one go" dwarfed the actual plans.
      variant: plans.open > 0 && planTotal > 0 ? 'meter' : 'plain',
      meterPercent: planPaidPct,
      meterLeft: planTotal > 0 ? `${planPaidPct}% paid so far` : '',
      meterRight: plans.due_total > 0 ? `${formatCompactMoney(plans.due_total)} left` : '',
      story: plans.open > 0
        ? `${formatCount(plans.patients || plans.open)} ${(plans.patients || plans.open) === 1 ? 'patient is' : 'patients are'} paying in parts${plans.plan_median >= 2 ? `, usually over ${plans.plan_median} payments` : ''}.`
        : 'No invoice is part-way through a payment plan.',
      storyShort: plans.open > 0 ? `${formatCompactMoney(plans.due_total || 0)} left` : 'None open',
    },
    {
      key: 'methods',
      title: 'How money arrives',
      // The top method and its share, e.g. "UPI 62%". It used to be the cash
      // share with rows that restated cash vs digital.
      display: top ? `${top.method} ${topShare}%` : '—',
      icon: ico(Banknote),
      variant: methodRows.length > 0 ? 'breakdown' : 'plain',
      rows: methodRows.slice(0, 3).map((m, i) => ({
        label: m.method,
        hint: `${formatCount(m.count)}×`,
        value: formatCompactMoney(m.amount),
        color: METHOD_COLORS[i],
      })),
      story: methodRows.length === 0
        ? 'No payments recorded in this selection.'
        : methods.cash_share >= 70
          ? 'Mostly cash. Worth knowing before you reconcile.'
          : methods.cash_share <= 30
            ? 'Mostly digital, so most of it reconciles itself.'
            : 'A mix of cash and digital.',
      storyShort: top ? `${formatCompactMoney(top.amount)} by ${top.method}` : 'No payments',
    },
  ];
}

/** Payments per clinic-local hour, for the Today bars. */
const hourly = (entries) => {
  const hours = (entries || [])
    .map((e) => {
      const t = clinicInputParts(e.created_at).time;
      return t ? { h: Number(t.slice(0, 2)), amount: Number(e.amount) || 0 } : null;
    })
    .filter(Boolean);
  if (hours.length === 0) return null;
  // Clinic hours by default, stretched to fit anything outside them.
  const from = Math.min(9, ...hours.map((x) => x.h));
  const to = Math.max(20, ...hours.map((x) => x.h));
  const series = Array.from({ length: to - from + 1 }, () => 0);
  hours.forEach(({ h, amount }) => { series[h - from] += amount; });
  const fmt = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  const peak = series.indexOf(Math.max(...series));
  return { series, labels: [fmt(from), fmt(to)], peak: fmt(from + peak) };
};

/** Today's collection tab: what came in on the selected day, and how. */
function todayCards(s, prev, entries) {
  const total = s.todayRevenue || 0;
  const cash = s.todayCash || 0;
  const online = s.todayOnline || 0;
  const count = s.todayCount || 0;
  const cashShare = pct(cash, total);
  const hours = hourly(entries);

  // Against the same weekday last week. When last week was nothing there is
  // no percentage to give, and "no change" would be wrong: say it is new.
  const delta = (cur, before) => {
    if (before === undefined || before === null) return {};
    if (!before) return cur > 0 ? { badge: 'new vs last week', badgeTone: 'good' } : {};
    const c = Math.round(((cur - before) / before) * 1000) / 10;
    return { change: Math.abs(c), changeType: c >= 0 ? 'up' : 'down', changeLabel: `${formatCompactMoney(cur)} vs ${formatCompactMoney(before)} same day last week` };
  };

  // Digital by rail (UPI, Card, ...), from the day's own entries.
  const rails = {};
  (entries || []).forEach((e) => {
    const m = (e.method || 'Other').trim();
    if (m.toLowerCase() === 'cash') return;
    rails[m] = (rails[m] || 0) + (Number(e.amount) || 0);
  });
  const railRows = Object.entries(rails).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return [
    {
      key: 'today_total',
      isMoney: true,
      title: 'Collected',
      display: formatCompactMoney(total),
      ...delta(total, prev?.total),
      icon: ico(TrendingUp),
      // When in the day the money came in.
      variant: hours ? 'spark' : 'plain',
      sparkline: hours?.series,
      sparklineLabels: hours?.labels,
      story: total > 0
        ? `Busiest around ${hours?.peak || 'midday'}.`
        : 'Nothing collected on this day yet.',
      storyShort: total > 0 && hours ? `peak ${hours.peak}` : 'Nothing yet',
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
        ? `${cashShare}% of the day. What should be in the drawer at close.`
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
      variant: railRows.length > 1 ? 'breakdown' : 'plain',
      rows: railRows.map(([m, amt], i) => ({ label: m, value: formatCompactMoney(amt), color: ['#2a276e', '#9B8CFF', '#c9c3f5'][i] })),
      story: online > 0
        ? railRows.length === 1 ? `All by ${railRows[0][0]}, straight to the bank.` : 'Straight to the bank.'
        : 'Nothing digital on this day.',
      storyShort: online > 0 ? `${100 - cashShare}% of the day` : 'None',
    },
    {
      key: 'today_receipts',
      title: 'Receipts issued',
      display: formatCount(count),
      icon: ico(Tag),
      variant: 'plain',
      story: count > 0
        ? `About ${formatMoney(Math.round(total / count))} per receipt.`
        : 'No receipts on this day yet.',
      storyShort: count > 0 ? `~${formatCompactMoney(total / count)} each` : 'None',
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

const PaymentKpiRow = ({ tab, summary, todayPrevious, todayEntries, ledgerStats, onSelect }) => {
  const cards =
    tab === 'today' ? todayCards(summary || {}, todayPrevious, todayEntries)
      : tab === 'ledger' ? ledgerCards(ledgerStats || {})
        : paymentsCards(summary || {});

  return <KpiRow cards={cards} onSelect={onSelect} />;
};

export default PaymentKpiRow;
