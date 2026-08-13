import { formatMoney, formatCompactMoney, formatCount } from '../../utils/currency';
import { clinicDateKey, clinicToday, formatDate } from '../../utils/datetime';
import { colorOf, groupOf, CHART_COLORS } from '../../constants/expenseCategories';

/**
 * What each Expenses KPI card opens into.
 *
 * Composed here, on the client, from the rows the page already holds. The other
 * drawers in the app fetch a server-composed payload; this one cannot, without
 * introducing a way for the drawer and the card above it to disagree — both are
 * built from the same filtered array, so they move together by construction.
 *
 * Two rules the charts follow:
 *
 *   The shape answers the question. A trend gets an area, a ranking gets
 *   horizontal bars (names read across, not sideways), a part-of-whole gets a
 *   donut, and "where did it all go" gets a waterfall, because only a waterfall
 *   shows each cost taking its bite out of the money that came in.
 *
 *   Every drawer says something a number could not. The chart shows the shape;
 *   the narrative and the three figures above it say whether that shape is a
 *   problem, and which line to look at first.
 */

const sum = (rows, pick = (r) => r.amount) =>
  rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const plural = (n, one, many) => (n === 1 ? one : many);

const daysBetween = (fromKey, toKey) =>
  Math.round((new Date(`${toKey}T00:00:00`) - new Date(`${fromKey}T00:00:00`)) / 86400000);

/** The clinic-calendar window a period button selects. */
function windowFor(period) {
  const today = clinicToday();
  if (period === 'today') return { from: today, to: today, days: 1 };
  if (period === '7days') {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today, days: 7 };
  }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, days: null };
  return { from: null, to: today, days: null };
}

const inWindow = (value, w) => {
  if (!w.from) return true;
  if (!value) return false;
  const key = clinicDateKey(value);
  return key >= w.from && key <= w.to;
};

/**
 * Group by day for short windows and by month for long ones.
 *
 * A year of daily points is 365 unreadable pixels; a week of monthly points is
 * one bar. The switch is at 45 days.
 */
function bucketByTime(rows, dateOf) {
  const keys = rows.map((r) => clinicDateKey(dateOf(r))).filter(Boolean).sort();
  if (!keys.length) return { by: 'day', of: () => '', label: '' };
  const span = daysBetween(keys[0], keys[keys.length - 1]);
  if (span > 45) {
    return {
      by: 'month',
      of: (r) => (clinicDateKey(dateOf(r)) || '').slice(0, 7),
      format: (k) => {
        const [y, m] = k.split('-');
        return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y.slice(2)}`;
      },
      label: 'By month',
    };
  }
  return {
    by: 'day',
    of: (r) => clinicDateKey(dateOf(r)) || '',
    format: (k) => formatDate(`${k}T12:00:00`),
    label: 'By day',
  };
}

/** Ordered time series with empty buckets kept, so a quiet week reads as quiet. */
function timeSeries(rows, dateOf) {
  const b = bucketByTime(rows, dateOf);
  const totals = new Map();
  rows.forEach((r) => {
    const k = b.of(r);
    if (!k) return;
    totals.set(k, (totals.get(k) || 0) + (Number(r.amount) || 0));
  });
  const series = [...totals.entries()]
    .sort((a, b2) => a[0].localeCompare(b2[0]))
    .map(([k, total]) => ({ key: k, label: b.format(k), total: Math.round(total) }));
  return { series, bucketOf: (r) => b.format(b.of(r)), axisLabel: b.label };
}

/**
 * The top N, plus everything else as one entry.
 *
 * Truncating to the top eight and stopping is what made a donut lie: the legend
 * divided each wedge by the sum of the wedges drawn, so the largest category
 * read 34% in the chart and 29% in the sentence above it. A remainder wedge
 * keeps the chart summing to the real total, and it is worth seeing anyway —
 * "and 13 other lines worth 9%" is a fact about how spread out your costs are.
 */
function topWithRest(entries, limit, restLabel, colors) {
  const ranked = [...entries].sort((a, b) => b.total - a.total);
  const head = ranked.slice(0, limit).map((e, i) => ({
    ...e, total: Math.round(e.total), color: colors[i % colors.length],
  }));
  const tail = ranked.slice(limit);
  if (tail.length) {
    head.push({
      label: `${restLabel} (${tail.length})`,
      total: Math.round(tail.reduce((t, e) => t + e.total, 0)),
      color: '#cbd5e1',
      isRest: true,
    });
  }
  return head;
}

// ── Payables ─────────────────────────────────────────────────────────────────

const AGE_BUCKETS = [
  { label: 'Under 30d', max: 30 },
  { label: '30 to 60d', max: 60 },
  { label: '60 to 90d', max: 90 },
  { label: 'Over 90d', max: Infinity },
];

const ageBucket = (createdAt) => {
  const key = clinicDateKey(createdAt);
  if (!key) return AGE_BUCKETS[0].label;
  const age = daysBetween(key, clinicToday());
  return (AGE_BUCKETS.find((b) => age < b.max) || AGE_BUCKETS[3]).label;
};

/**
 * Money owed, by how long it has been owed.
 *
 * Ageing rather than a total, because a bill is not a problem until it is old.
 * Buckets get hotter left to right, which is the one place a colour ramp earns
 * its keep here.
 */
function owedDetail(payables) {
  const unpaid = payables.filter((r) => r.status === 'unpaid');
  const total = sum(unpaid);

  const series = AGE_BUCKETS.map((b) => ({
    label: b.label,
    total: Math.round(sum(unpaid.filter((r) => ageBucket(r.created_at) === b.label))),
  }));

  const ages = unpaid
    .map((r) => (clinicDateKey(r.created_at) ? daysBetween(clinicDateKey(r.created_at), clinicToday()) : 0));
  const oldest = ages.length ? Math.max(...ages) : 0;
  const average = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const stale = series[2].total + series[3].total;

  return {
    chart: 'bar',
    x_is_ageing: true,
    is_money: true,
    x_label: 'Tap a bucket to filter the list below',
    tone: stale > 0 ? 'warn' : undefined,
    narrative: unpaid.length === 0
      ? 'Nothing outstanding. Every bill recorded here has been settled.'
      : stale > 0
        ? `${formatMoney(stale)} of what you owe is more than 60 days old. Labs and consultants remember, and the ones you keep waiting are the ones who deprioritise your cases.`
        : `${formatMoney(total)} owed across ${formatCount(unpaid.length)} ${plural(unpaid.length, 'bill', 'bills')}, none of it older than 60 days. This is a healthy payables position.`,
    insights: [
      { label: 'Oldest bill', value: `${oldest}d`, tone: oldest > 60 ? 'bad' : oldest > 30 ? 'warn' : 'good' },
      { label: 'Average age', value: `${average}d` },
      { label: 'Bills open', value: formatCount(unpaid.length) },
    ],
    series,
    row_label: 'What is owed',
    rows: [...unpaid]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .map((r) => ({
        id: r.id,
        bucket: ageBucket(r.created_at),
        title: r.payee_name || 'Unassigned',
        subtitle: [r.description, r.patient_name, r.created_at ? `raised ${formatDate(r.created_at)}` : null]
          .filter(Boolean).join(' · '),
        amount: r.amount,
      })),
  };
}

/** One kind of payable over time: is this bill getting bigger every month? */
function kindTrendDetail(payables, kind, noun) {
  const rows = payables.filter((r) => r.kind === kind);
  const { series, bucketOf, axisLabel } = timeSeries(rows, (r) => r.created_at);
  const total = sum(rows);
  const unpaid = sum(rows.filter((r) => r.status === 'unpaid'));
  const average = series.length ? Math.round(total / series.length) : 0;
  const last = series[series.length - 1]?.total || 0;
  const prev = series[series.length - 2]?.total || 0;
  const rising = prev > 0 && last > prev * 1.15;

  return {
    chart: 'area',
    is_money: true,
    average,
    tone: rising ? 'warn' : undefined,
    x_label: `${axisLabel} · tap a point to filter the list below`,
    narrative: rows.length === 0
      ? `No ${noun} recorded in this window.`
      : rising
        ? `${noun} jumped to ${formatMoney(last)} in the latest period against ${formatMoney(prev)} before it, ${pct(last - prev, prev)}% up. Worth checking whether the work grew with it or only the bill did.`
        : `${formatMoney(total)} of ${noun} across ${formatCount(rows.length)} ${plural(rows.length, 'bill', 'bills')}, averaging ${formatMoney(average)} a period. ${formatMoney(unpaid)} of it is still unpaid.`,
    insights: [
      { label: 'Total raised', value: formatCompactMoney(total) },
      { label: 'Still owed', value: formatCompactMoney(unpaid), tone: unpaid > 0 ? 'warn' : 'good' },
      { label: 'Per bill', value: formatCompactMoney(rows.length ? total / rows.length : 0) },
    ],
    series,
    row_label: 'Every bill',
    rows: [...rows]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .map((r) => ({
        id: r.id,
        bucket: bucketOf(r),
        title: r.payee_name || 'Unassigned',
        subtitle: [r.description, r.patient_name, r.status === 'paid' ? 'settled' : 'unpaid']
          .filter(Boolean).join(' · '),
        amount: r.amount,
        tag: r.status === 'paid' ? 'PAID' : null,
        tagTone: 'good',
      })),
  };
}

/** Who is owed the most. A ranking, so the bars lie down and the names read. */
function payeeDetail(payables) {
  const unpaid = payables.filter((r) => r.status === 'unpaid');
  const byPayee = new Map();
  unpaid.forEach((r) => {
    const name = r.payee_name || 'Unassigned';
    const e = byPayee.get(name) || { label: name, total: 0, count: 0 };
    e.total += Number(r.amount) || 0;
    e.count += 1;
    byPayee.set(name, e);
  });
  const series = topWithRest([...byPayee.values()], 7, 'Everything else', CHART_COLORS);

  const total = sum(unpaid);
  const top = [...byPayee.values()].sort((a, b) => b.total - a.total)[0];
  const concentration = pct(top?.total || 0, total);

  return {
    chart: 'donut',
    is_money: true,
    donut_label: 'Owed',
    tone: concentration > 60 ? 'warn' : undefined,
    narrative: series.length === 0
      ? 'Nobody is waiting on money from you right now.'
      : concentration > 60
        ? `${top.label} holds ${concentration}% of everything you owe. One payee carrying that much of your outstanding balance is a negotiating position for them, not for you.`
        : `${formatMoney(total)} spread across ${formatCount(series.length)} ${plural(series.length, 'payee', 'payees')}, the largest being ${top.label} at ${concentration}%.`,
    insights: [
      { label: 'Payees', value: formatCount(byPayee.size) },
      { label: 'Largest share', value: `${concentration}%`, tone: concentration > 60 ? 'warn' : undefined },
      { label: 'Per payee', value: formatCompactMoney(byPayee.size ? total / byPayee.size : 0) },
    ],
    series,
    row_label: 'Open bills',
    rows: [...unpaid]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .map((r) => ({
        id: r.id,
        bucket: r.payee_name || 'Unassigned',
        title: r.payee_name || 'Unassigned',
        subtitle: [r.description, r.patient_name].filter(Boolean).join(' · '),
        amount: r.amount,
      })),
  };
}

// ── Ledger ───────────────────────────────────────────────────────────────────

/** Money in or money out, as a trend, with the period average drawn on it. */
function flowDetail(items, direction) {
  const out = direction === 'out';
  const rows = items.filter((r) => (out ? r.type === 'expense' : r.type !== 'expense'));
  const { series, bucketOf, axisLabel } = timeSeries(rows, (r) => r.date);
  const total = sum(rows);
  const average = series.length ? Math.round(total / series.length) : 0;
  const biggest = [...rows].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
  const last = series[series.length - 1]?.total || 0;
  const prev = series[series.length - 2]?.total || 0;
  const worseningOut = out && prev > 0 && last > prev * 1.2;
  const fallingIn = !out && prev > 0 && last < prev * 0.8;

  return {
    chart: 'area',
    is_money: true,
    average,
    tone: worseningOut || fallingIn ? 'bad' : undefined,
    x_label: `${axisLabel} · tap a point to filter the list below`,
    narrative: rows.length === 0
      ? out ? 'Nothing has gone out in this window.' : 'Nothing has come in in this window.'
      : worseningOut
        ? `Spending rose to ${formatMoney(last)} in the latest period from ${formatMoney(prev)}, a ${pct(last - prev, prev)}% jump. The list below is sorted biggest first, and the answer is usually in the top three.`
        : fallingIn
          ? `Collections fell to ${formatMoney(last)} from ${formatMoney(prev)}, down ${pct(prev - last, prev)}%. Costs rarely fall as fast as income does, so this is the number to watch.`
          : `${formatMoney(total)} across ${formatCount(rows.length)} ${plural(rows.length, 'entry', 'entries')}, averaging ${formatMoney(average)} a period. The largest single one was ${formatMoney(biggest?.amount || 0)}.`,
    insights: [
      { label: 'Total', value: formatCompactMoney(total), tone: out ? 'bad' : 'good' },
      { label: 'Per period', value: formatCompactMoney(average) },
      { label: 'Largest', value: formatCompactMoney(biggest?.amount || 0) },
    ],
    series,
    row_label: out ? 'Every expense' : 'Every payment received',
    rows: [...rows]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 60)
      .map((r) => ({
        id: `${r.type}_${r.id}`,
        bucket: bucketOf(r),
        color: out ? colorOf(r.category) : undefined,
        title: r.entity_name || r.category || (out ? 'Expense' : 'Payment'),
        // An expense with no vendor falls back to its category for a title, so
        // repeating the category underneath prints the same word twice.
        subtitle: [r.entity_name ? r.category : null, r.payment_method, r.date ? formatDate(r.date) : null]
          .filter(Boolean).join(' · '),
        amount: r.amount,
      })),
  };
}

/**
 * The Net card: money in, every cost taking a bite, and what is left standing.
 *
 * This is the drawer that has to answer "am I making money, and if not, where
 * is it going" — so it is the one chart in the app that is worth a waterfall.
 * Three numbers cannot show a cost eating into income; a bar that starts where
 * the last one ended can.
 */
function netDetail(items) {
  const income = sum(items.filter((r) => r.type !== 'expense'));
  const expenses = items.filter((r) => r.type === 'expense');
  const spend = sum(expenses);
  const net = income - spend;

  // Costs are stacked by group, not by category: a waterfall with sixteen steps
  // is a barcode. The group each category belongs to is what a clinic actually
  // budgets by anyway — people, premises, clinical, business.
  const byGroup = new Map();
  expenses.forEach((r) => {
    const g = groupOf(r.category);
    const e = byGroup.get(g.id) || { label: g.label, short: g.short, total: 0, color: g.color, count: 0 };
    e.total += Number(r.amount) || 0;
    e.count += 1;
    byGroup.set(g.id, e);
  });
  const groups = [...byGroup.values()].sort((a, b) => b.total - a.total);

  // Each step is a floating range [bottom, top], not a bar on a pedestal.
  // The pedestal version had to clamp at zero, so a clinic already past
  // break-even saw its last two costs sitting flat on the floor instead of
  // marching down through it — which is exactly the moment the chart matters.
  const series = [{
    label: 'Collected', short: 'Collected', range: [0, Math.round(income)],
    total: Math.round(income), kind: 'in',
  }];
  let running = income;
  groups.forEach((g) => {
    const from = running;
    running -= g.total;
    series.push({
      label: g.label,
      short: g.short,
      range: [Math.round(running), Math.round(from)],
      total: Math.round(g.total),
      kind: 'out',
    });
  });
  series.push({
    label: 'Left over',
    short: 'Left over',
    range: net < 0 ? [Math.round(net), 0] : [0, Math.round(net)],
    total: Math.round(Math.abs(net)),
    kind: 'net',
    negative: net < 0,
  });

  const margin = pct(net, income);
  const costRatio = pct(spend, income);
  const top = groups[0];
  const topShare = pct(top?.total || 0, spend);
  const breakEven = income > 0 && Math.abs(net) <= income * 0.02;

  const verdict = income === 0 && spend === 0 ? 'nothing'
    : breakEven ? 'break-even'
      : net > 0 ? 'profit' : 'loss';

  const narrative = {
    nothing: 'No money has moved in this window, so there is nothing to weigh up yet.',
    'break-even': `You are breaking even. ${formatMoney(income)} came in and ${formatMoney(spend)} went out, leaving ${formatMoney(Math.abs(net))} either way. At this margin a single quiet month or one equipment repair puts you under, so the thing to move is ${top ? top.label.toLowerCase() : 'your largest cost'}, currently ${topShare}% of everything you spend.`,
    profit: `You are in profit. Of every ₹100 you collect, ₹${costRatio} goes back out and ₹${100 - costRatio} stays. ${top ? `Your largest cost is ${top.label.toLowerCase()} at ${formatMoney(top.total)}, ${topShare}% of all spending — that is the line worth negotiating first, because a 10% cut there is worth more than a 10% cut anywhere else.` : ''}`,
    loss: `You are running at a loss of ${formatMoney(Math.abs(net))} in this window: ${formatMoney(spend)} went out against ${formatMoney(income)} collected. ${top ? `${top.label} is ${topShare}% of the outflow at ${formatMoney(top.total)} — start there.` : ''} Check the collections side too, because unbilled work and uncollected dues show up here as a loss that is really a billing problem.`,
  }[verdict];

  return {
    chart: 'waterfall',
    is_money: true,
    tone: verdict === 'loss' ? 'bad' : verdict === 'break-even' ? 'warn' : verdict === 'profit' ? 'good' : undefined,
    x_label: 'Each step is a cost coming off what you collected',
    narrative,
    insights: [
      {
        label: 'Margin',
        value: income > 0 ? `${margin}%` : '—',
        tone: margin < 0 ? 'bad' : margin < 10 ? 'warn' : 'good',
      },
      {
        label: 'Cost ratio',
        value: income > 0 ? `${costRatio}%` : '—',
        tone: costRatio > 90 ? 'bad' : costRatio > 70 ? 'warn' : 'good',
      },
      {
        label: 'Verdict',
        value: verdict === 'nothing' ? '—' : verdict === 'break-even' ? 'Break even' : verdict === 'profit' ? 'Profit' : 'Loss',
        tone: verdict === 'loss' ? 'bad' : verdict === 'break-even' ? 'warn' : 'good',
      },
    ],
    series,
    row_label: 'Where it goes',
    rows: groups.map((g) => ({
      id: g.label,
      bucket: g.label,
      color: g.color,
      title: g.label,
      subtitle: `${formatCount(g.count)} ${plural(g.count, 'entry', 'entries')} · ${pct(g.total, spend)}% of everything you spend`,
      amount: g.total,
      progress: pct(g.total, spend),
    })),
  };
}

/**
 * Where the money went, by category.
 *
 * A donut: this is a share of one pot, and the only question is which wedge is
 * bigger than it should be. Wedges take the colour of their group, so people
 * costs stay navy and clinical costs stay teal wherever they appear.
 */
function categoryDetail(items, previousItems) {
  const expenses = items.filter((r) => r.type === 'expense');
  const spend = sum(expenses);

  const byCat = new Map();
  expenses.forEach((r) => {
    const c = r.category || 'Other';
    const e = byCat.get(c) || { label: c, total: 0, count: 0, color: colorOf(c) };
    e.total += Number(r.amount) || 0;
    e.count += 1;
    byCat.set(c, e);
  });
  const ranked = [...byCat.values()].sort((a, b) => b.total - a.total);

  // Wedges within the same group would render as identical hues, so each takes
  // a distinct colour from the ranking palette while the rows below keep the
  // group colour. Chart legibility and category identity, one each.
  const series = topWithRest(ranked, 7, 'Everything else', CHART_COLORS);

  const top = ranked[0];
  const topShare = pct(top?.total || 0, spend);

  // The biggest riser against the previous window of the same length. This is
  // the insight a total cannot carry: not what is large, but what is new.
  let riser = null;
  if (previousItems?.length) {
    const before = new Map();
    previousItems.filter((r) => r.type === 'expense').forEach((r) => {
      const c = r.category || 'Other';
      before.set(c, (before.get(c) || 0) + (Number(r.amount) || 0));
    });
    ranked.forEach((e) => {
      const was = before.get(e.label) || 0;
      const delta = e.total - was;
      if (was > 0 && delta > 0 && (!riser || delta > riser.delta)) {
        riser = { label: e.label, delta, was, now: e.total };
      }
    });
  }

  return {
    chart: 'donut',
    is_money: true,
    donut_label: 'Spent',
    tone: topShare > 50 ? 'warn' : undefined,
    narrative: ranked.length === 0
      ? 'No spending recorded in this window.'
      : riser
        ? `${top.label} is your largest line at ${formatMoney(top.total)}, ${topShare}% of everything you spend. The one that moved most is ${riser.label}: ${formatMoney(riser.was)} last period against ${formatMoney(riser.now)} now.`
        : topShare > 50
          ? `${top.label} alone is ${topShare}% of everything you spend, at ${formatMoney(top.total)}. One category over half your outflow means your costs live or die on a single supplier relationship.`
          : `${formatCount(ranked.length)} ${plural(ranked.length, 'category', 'categories')} make up ${formatMoney(spend)}, led by ${top.label} at ${topShare}%.`,
    insights: [
      { label: 'Categories', value: formatCount(ranked.length) },
      { label: 'Largest share', value: `${topShare}%`, tone: topShare > 50 ? 'warn' : undefined },
      { label: 'Entries', value: formatCount(expenses.length) },
    ],
    series,
    row_label: 'Every category',
    rows: ranked.map((e) => ({
      id: e.label,
      bucket: e.label,
      color: e.color,
      title: e.label,
      subtitle: `${formatCount(e.count)} ${plural(e.count, 'entry', 'entries')} · ${groupOf(e.label).label} · ${pct(e.total, spend)}% of spending`,
      amount: e.total,
      progress: pct(e.total, spend),
    })),
  };
}

// ── Vendors ──────────────────────────────────────────────────────────────────

/** Active against dormant, and which ones have gone quiet. */
function vendorStatusDetail(vendors, owedBy) {
  const active = vendors.filter((v) => v.is_active);
  const dormant = vendors.filter((v) => !v.is_active);

  return {
    chart: 'donut',
    periods: false,
    is_money: false,
    donut_label: 'Vendors',
    narrative: vendors.length === 0
      ? 'No vendors yet. Add the labs, suppliers and consultants you pay, and their bills can be tracked against them.'
      : dormant.length > 0
        ? `${formatCount(active.length)} of ${formatCount(vendors.length)} are active. The dormant ones stay on the list so their history and their old bills survive, but they no longer appear when you record an expense.`
        : `All ${formatCount(vendors.length)} of your vendors are active. Mark one inactive when you stop using them and it drops out of the pickers without taking its history with it.`,
    insights: [
      { label: 'Active', value: formatCount(active.length), tone: 'good' },
      { label: 'Dormant', value: formatCount(dormant.length) },
      { label: 'With a balance', value: formatCount(Object.values(owedBy).filter((n) => Number(n) > 0).length) },
    ],
    series: [
      { label: 'Active', total: active.length, color: '#2a276e' },
      { label: 'Dormant', total: dormant.length, color: '#c9c3f5' },
    ].filter((s) => s.total > 0),
    row_label: 'Every vendor',
    rows: [...vendors]
      .sort((a, b) => (owedBy[b.id] || 0) - (owedBy[a.id] || 0))
      .map((v) => ({
        id: v.id,
        bucket: v.is_active ? 'Active' : 'Dormant',
        title: v.name,
        subtitle: [v.category || 'General', v.contact_name, v.phone].filter(Boolean).join(' · '),
        display: owedBy[v.id] > 0 ? formatMoney(owedBy[v.id]) : 'Settled',
      })),
  };
}

/** Who is holding your money, ranked. */
function vendorOwedDetail(vendors, owedBy, payables) {
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const ranked = Object.entries(owedBy)
    .map(([id, amount]) => ({
      id: Number(id),
      label: byId.get(Number(id))?.name || 'Unassigned',
      total: Math.round(Number(amount) || 0),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  const total = ranked.reduce((s, e) => s + e.total, 0);
  const top = ranked[0];

  return {
    chart: 'hbar',
    periods: false,
    is_money: true,
    x_label: 'Tap a bar to filter the list below',
    narrative: ranked.length === 0
      ? 'Nothing outstanding with any vendor right now.'
      : `${formatMoney(total)} is sitting with ${formatCount(ranked.length)} ${plural(ranked.length, 'vendor', 'vendors')}. ${top.label} is owed the most at ${formatMoney(top.total)}, ${pct(top.total, total)}% of the whole. Settling from the Payables tab writes each one into the ledger as an expense.`,
    insights: [
      { label: 'Owed', value: formatCompactMoney(total), tone: total > 0 ? 'warn' : 'good' },
      { label: 'Vendors', value: formatCount(ranked.length) },
      { label: 'Largest', value: formatCompactMoney(top?.total || 0) },
    ],
    series: topWithRest(ranked, 7, 'Everything else', CHART_COLORS),
    row_label: 'Open bills',
    rows: payables
      .filter((r) => r.status === 'unpaid')
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .map((r) => ({
        id: r.id,
        bucket: r.payee_name || 'Unassigned',
        title: r.payee_name || 'Unassigned',
        subtitle: [r.description, r.patient_name].filter(Boolean).join(' · '),
        amount: r.amount,
      })),
  };
}

/** What the supplier base is made of. */
function vendorCategoryDetail(vendors, owedBy) {
  const byCat = new Map();
  vendors.forEach((v) => {
    const c = v.category || 'General';
    const e = byCat.get(c) || { label: c, total: 0 };
    e.total += 1;
    byCat.set(c, e);
  });
  const ranked = [...byCat.values()].sort((a, b) => b.total - a.total);
  const top = ranked[0];

  return {
    chart: 'donut',
    periods: false,
    is_money: false,
    donut_label: 'Vendors',
    narrative: ranked.length === 0
      ? 'No vendors to break down yet.'
      : `Most of your suppliers are ${top.label.toLowerCase()} (${formatCount(top.total)} of ${formatCount(vendors.length)}). Categories are what let a bill be filed correctly the moment it is raised, so a vendor left on General ends up in whichever pile you remember at the time.`,
    insights: [
      { label: 'Categories', value: formatCount(ranked.length) },
      { label: 'Largest', value: top?.label || '—' },
      {
        label: 'Uncategorised',
        value: formatCount(vendors.filter((v) => !v.category || v.category === 'General').length),
        tone: vendors.some((v) => !v.category) ? 'warn' : undefined,
      },
    ],
    series: ranked.map((e, i) => ({ ...e, color: CHART_COLORS[i % CHART_COLORS.length] })),
    row_label: 'Every vendor',
    rows: [...vendors]
      .sort((a, b) => (owedBy[b.id] || 0) - (owedBy[a.id] || 0))
      .map((v) => ({
        id: v.id,
        bucket: v.category || 'General',
        title: v.name,
        subtitle: [v.category || 'General', v.contact_name].filter(Boolean).join(' · '),
        display: owedBy[v.id] > 0 ? formatMoney(owedBy[v.id]) : 'Settled',
      })),
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * The payload for one card, in one period.
 *
 * `period` narrows the chart's x-axis only; the arrays handed in have already
 * been narrowed by the page's own filters, which is what keeps this drawer
 * describing exactly the population its card described.
 */
export function buildExpenseKpiDetail({
  metric, period = 'all', payables = [], ledgerItems = [], vendors = [], vendorOwed = {},
}) {
  const w = windowFor(period);
  const scopedPayables = payables.filter((r) => inWindow(r.created_at, w));
  const scopedLedger = ledgerItems.filter((r) => inWindow(r.date, w));

  // The equivalent window immediately before this one, for "what moved".
  let previousLedger = [];
  if (w.from && w.days) {
    const start = new Date(`${w.from}T00:00:00`);
    const prevTo = new Date(start);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (w.days - 1));
    const pw = { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
    previousLedger = ledgerItems.filter((r) => inWindow(r.date, pw));
  }

  switch (metric) {
    // Payables
    case 'owed': return owedDetail(scopedPayables);
    case 'lab': return kindTrendDetail(scopedPayables, 'lab', 'lab bills');
    case 'consultant': return kindTrendDetail(scopedPayables, 'consultant', 'consultant fees');
    case 'payees': return payeeDetail(scopedPayables);

    // Ledger
    case 'out': return flowDetail(scopedLedger, 'out');
    case 'in': return flowDetail(scopedLedger, 'in');
    case 'net': return netDetail(scopedLedger);
    case 'where': return categoryDetail(scopedLedger, previousLedger);

    // Vendors
    case 'vendors': return vendorStatusDetail(vendors, vendorOwed);
    case 'vendor_owed': return vendorOwedDetail(vendors, vendorOwed, payables);
    case 'vendor_kinds': return vendorCategoryDetail(vendors, vendorOwed);

    default: return null;
  }
}

export default buildExpenseKpiDetail;
