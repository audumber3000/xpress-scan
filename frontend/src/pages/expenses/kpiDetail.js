import { formatMoney, formatCompactMoney, formatCount } from '../../utils/currency';
import { clinicDateKey, clinicToday, formatDate } from '../../utils/datetime';
import { colorOf, groupOf, CATEGORY_GROUPS, CHART_COLORS } from '../../constants/expenseCategories';

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

/**
 * The windows a clinic reads its money in.
 *
 * Not the drawer's default set. "Today" on a profit-and-loss chart is a single
 * column with one day of rent in it and no salary, which is not a small sample
 * of the truth, it is a different and misleading number. Costs land monthly, so
 * the shortest window worth offering is a month.
 */
export const FINANCIAL_PERIODS = [
  { value: 'month', label: 'This month' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const monthsBack = (n) => {
  const today = clinicToday();
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  d.setMonth(d.getMonth() - (n - 1));
  return { from: d.toISOString().slice(0, 10), to: today, days: n * 30 };
};

/** The clinic-calendar window a period button selects. */
function windowFor(period) {
  const today = clinicToday();
  if (period === 'today') return { from: today, to: today, days: 1 };
  if (period === '7days') {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today, days: 7 };
  }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, days: 30 };
  if (period === '3months') return monthsBack(3);
  if (period === '6months') return monthsBack(6);
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today, days: 365 };
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

/**
 * Ordered time series.
 *
 * `splitBy` turns each period into its parts — a function from a row to the
 * series key it belongs to. Without it every column is one number, which is the
 * whole reason a spend trend could not answer "on what".
 */
function timeSeries(rows, dateOf, splitBy = null) {
  const b = bucketByTime(rows, dateOf);
  const periods = new Map();
  rows.forEach((r) => {
    const k = b.of(r);
    if (!k) return;
    const bucket = periods.get(k) || { key: k, label: b.format(k), total: 0 };
    const amt = Number(r.amount) || 0;
    bucket.total += amt;
    if (splitBy) {
      const part = splitBy(r);
      bucket[part] = (bucket[part] || 0) + amt;
    }
    periods.set(k, bucket);
  });
  const series = [...periods.values()]
    .sort((a, b2) => a.key.localeCompare(b2.key))
    .map((p) => {
      const out = { ...p, total: Math.round(p.total) };
      Object.keys(out).forEach((k) => {
        if (k !== 'key' && k !== 'label') out[k] = Math.round(out[k]);
      });
      return out;
    });
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
    periods: FINANCIAL_PERIODS,
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
    periods: FINANCIAL_PERIODS,
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
    periods: FINANCIAL_PERIODS,
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

/**
 * Money out, or money in, as columns cut into their parts.
 *
 * This was a trend line, and a trend line cannot answer the only question the
 * card raises: not "is spending rising" but "on what". A stacked column does
 * both — the height is the period's total, the segments are where it went — so
 * a month that doubled because of one equipment purchase looks nothing like a
 * month that doubled across the board.
 *
 * Money out splits by cost group, money in by how the money arrived, because
 * those are the two compositions a clinic can actually act on.
 */
function flowDetail(items, direction) {
  const out = direction === 'out';
  const rows = items.filter((r) => (out ? r.type === 'expense' : r.type !== 'expense'));

  // Segments come from what is actually present, largest first, so the biggest
  // chunk is the bottom of every column and the eye can compare across periods
  // from a common baseline.
  const totalsByPart = new Map();
  const partOf = (r) => (out ? groupOf(r.category).label : (r.payment_method || 'Unrecorded'));
  rows.forEach((r) => {
    const k = partOf(r);
    totalsByPart.set(k, (totalsByPart.get(k) || 0) + (Number(r.amount) || 0));
  });
  const parts = [...totalsByPart.entries()].sort((a, b) => b[1] - a[1]);

  const colorFor = (label, i) => {
    if (!out) return CHART_COLORS[i % CHART_COLORS.length];
    const g = CATEGORY_GROUPS.find((x) => x.label === label);
    return g ? g.color : CHART_COLORS[i % CHART_COLORS.length];
  };
  const bars = parts.map(([label], i) => ({ key: label, label, color: colorFor(label, i) }));

  const { series, bucketOf, axisLabel } = timeSeries(rows, (r) => r.date, partOf);
  const total = sum(rows);
  const average = series.length ? Math.round(total / series.length) : 0;
  const biggest = [...rows].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
  const top = parts[0];
  const topShare = pct(top?.[1] || 0, total);
  const last = series[series.length - 1]?.total || 0;
  const prev = series[series.length - 2]?.total || 0;
  const worseningOut = out && prev > 0 && last > prev * 1.2;
  const fallingIn = !out && prev > 0 && last < prev * 0.8;

  const narrative = rows.length === 0
    ? (out ? 'Nothing has gone out in this window.' : 'Nothing has come in in this window.')
    : out
      ? `${formatMoney(total)} went out, and ${topShare}% of it is ${top[0].toLowerCase()} at ${formatMoney(top[1])}. ${
        worseningOut
          ? `Spending rose to ${formatMoney(last)} in the latest period from ${formatMoney(prev)}, a ${pct(last - prev, prev)}% jump — the tallest segment in that column is where it came from.`
          : `The tallest segment in any column tells you what moved that period; the largest single entry was ${formatMoney(biggest?.amount || 0)}.`
      }`
      : `${formatMoney(total)} came in, ${topShare}% of it as ${top[0].toLowerCase()}. ${
        fallingIn
          ? `Collections fell to ${formatMoney(last)} from ${formatMoney(prev)}, down ${pct(prev - last, prev)}%. Costs rarely fall as fast as income does, so this is the number to watch.`
          : `Cash is the part that has to be counted and banked by hand, so its share is worth knowing before it becomes a reconciliation problem.`
      }`;

  return {
    chart: 'stacked',
    is_money: true,
    periods: FINANCIAL_PERIODS,
    bars,
    average,
    tone: worseningOut || fallingIn ? 'bad' : undefined,
    x_label: `${axisLabel} · tap a column to filter the list below`,
    narrative,
    insights: [
      { label: 'Total', value: formatCompactMoney(total), tone: out ? 'bad' : 'good' },
      { label: out ? 'Biggest group' : 'Biggest mode', value: top?.[0] || '—' },
      { label: 'Its share', value: total > 0 ? `${topShare}%` : '—', tone: topShare > 50 ? 'warn' : undefined },
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
 * The Net card: revenue against profit, period by period.
 *
 * This is how a P&L is read, and it was a waterfall — one snapshot of where a
 * single lump went, with no way to see whether last month was better than this
 * one. Two bars per period answers both questions at once: how much came in,
 * and how much of it survived. A loss period turns its profit bar red, so the
 * months that hurt are visible without reading a single number.
 *
 * The composition of the spending is still one tap away, in the rows below and
 * in Where it went.
 */
function netDetail(items) {
  const income = sum(items.filter((r) => r.type !== 'expense'));
  const expenses = items.filter((r) => r.type === 'expense');
  const spend = sum(expenses);
  const net = income - spend;

  const { series: buckets, bucketOf } = timeSeries(items, (r) => r.date, (r) => (r.type === 'expense' ? 'spent' : 'revenue'));
  const series = buckets.map((b) => ({
    label: b.label,
    revenue: Math.round(b.revenue || 0),
    profit: Math.round((b.revenue || 0) - (b.spent || 0)),
    spent: Math.round(b.spent || 0),
  }));

  const lossPeriods = series.filter((b) => b.profit < 0);

  // Grouped for the rows, because "where it goes" is still the follow-up
  // question and the four groups are what a clinic budgets by.
  const byGroup = new Map();
  expenses.forEach((r) => {
    const g = groupOf(r.category);
    const e = byGroup.get(g.id) || { label: g.label, total: 0, color: g.color, count: 0 };
    e.total += Number(r.amount) || 0;
    e.count += 1;
    byGroup.set(g.id, e);
  });
  const groups = [...byGroup.values()].sort((a, b) => b.total - a.total);

  const margin = pct(net, income);
  const costRatio = pct(spend, income);
  const top = groups[0];
  const topShare = pct(top?.total || 0, spend);
  const breakEven = income > 0 && Math.abs(net) <= income * 0.02;

  const verdict = income === 0 && spend === 0 ? 'nothing'
    : breakEven ? 'break-even'
      : net > 0 ? 'profit' : 'loss';

  const lossLine = lossPeriods.length > 0 && lossPeriods.length < series.length
    ? ` ${formatCount(lossPeriods.length)} of ${formatCount(series.length)} periods finished under water, the worst being ${lossPeriods.sort((a, b) => a.profit - b.profit)[0].label}.`
    : '';

  const narrative = {
    nothing: 'No money has moved in this window, so there is nothing to weigh up yet.',
    'break-even': `You are breaking even. ${formatMoney(income)} came in and ${formatMoney(spend)} went out, leaving ${formatMoney(Math.abs(net))} either way. At this margin a single quiet month or one equipment repair puts you under, so the thing to move is ${top ? top.label.toLowerCase() : 'your largest cost'}, currently ${topShare}% of everything you spend.${lossLine}`,
    profit: `You are in profit. Of every ₹100 you collect, ₹${costRatio} goes back out and ₹${100 - costRatio} stays.${top ? ` Your largest cost is ${top.label.toLowerCase()} at ${formatMoney(top.total)}, ${topShare}% of all spending — a 10% cut there is worth more than a 10% cut anywhere else.` : ''}${lossLine}`,
    loss: `You are running at a loss of ${formatMoney(Math.abs(net))} in this window: ${formatMoney(spend)} went out against ${formatMoney(income)} collected.${top ? ` ${top.label} is ${topShare}% of the outflow at ${formatMoney(top.total)} — start there.` : ''}${lossLine} Check the collections side too, because unbilled work and uncollected dues show up here as a loss that is really a billing problem.`,
  }[verdict];

  return {
    chart: 'grouped',
    is_money: true,
    periods: FINANCIAL_PERIODS,
    bars: [
      { key: 'revenue', label: 'Revenue', color: '#2a276e' },
      { key: 'profit', label: 'Profit / loss', color: '#16a34a', negativeKey: true },
    ],
    tone: verdict === 'loss' ? 'bad' : verdict === 'break-even' ? 'warn' : verdict === 'profit' ? 'good' : undefined,
    x_label: 'Revenue against what survived it, period by period',
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
    row_label: 'Where the money goes',
    rows: groups.map((g) => ({
      id: g.label,
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
    periods: FINANCIAL_PERIODS,
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
