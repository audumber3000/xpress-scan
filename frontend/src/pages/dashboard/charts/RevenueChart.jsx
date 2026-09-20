import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle, formatMoney } from '../format';
import { getCurrencySymbol } from '../../../utils/currency';
import {
  SERIES, GRID_PROPS, AXIS_PROPS, CHART_MARGIN, BAR_MAX, BAR_RADIUS,
  stackGap, geometryFor, trimBuckets,
} from '../chartTheme';

/**
 * What you billed against what actually came in.
 *
 * ─── Why this is columns and not the line it was ──────────────────────────
 *
 * This chart used to be an Area + Line pair with type="monotone". A monotone
 * spline through sparse daily data overshoots between points: on a clinic with
 * billing on Monday and Friday and nothing between, the curve rose to a smooth
 * crest in the middle of the week and drew several thousand rupees of revenue
 * on days that had none. Not a styling problem — the chart was asserting money
 * that did not exist. No interpolation of any kind is safe here, because the
 * gaps between buckets are real zeroes, not missing samples.
 *
 * ─── Why one stacked column instead of two series ─────────────────────────
 *
 * The question is "of what I billed, how much came in", which is part-to-whole,
 * so the two parts belong in one column: the collected portion solid from the
 * baseline, the shortfall as a pale cap on top. The height of the pale cap IS
 * the receivable, which is the number the card exists to show, and you read it
 * without measuring the distance between two lines by eye.
 *
 * A bucket can collect more than it billed — a patient settling an old bill —
 * and then the column is all solid and stands taller than that day's billing.
 * That is the honest picture, so `owed` floors at zero rather than going
 * negative and eating the column below it.
 */
const RevenueChart = ({ data, loading, refreshing, delta, breakpoint }) => {
  const cur = getCurrencySymbol();
  const geo = geometryFor(breakpoint);

  const rows = trimBuckets(data, geo.maxBuckets).map((r) => {
    const billed = Number(r.billed) || 0;
    const collected = Number(r.collected) || 0;
    return { ...r, billed, collected, owed: Math.max(0, billed - collected) };
  });

  const totals = rows.reduce(
    (acc, r) => ({ billed: acc.billed + r.billed, collected: acc.collected + r.collected }),
    { billed: 0, collected: 0 }
  );
  const gap = Math.max(0, totals.billed - totals.collected);
  const collectedPct = totals.billed > 0 ? Math.round((totals.collected / totals.billed) * 100) : 0;

  const takeaway = totals.billed > 0
    ? gap > 0
      ? `You collected ${formatMoney(totals.collected)} of ${formatMoney(totals.billed)} billed, ${collectedPct}%. ${formatMoney(gap)} has not come in yet.`
      : `Everything billed in this period has been collected, ${formatMoney(totals.collected)}.`
    : totals.collected > 0
      ? `${formatMoney(totals.collected)} came in against bills raised earlier.`
      : null;

  return (
    <ChartCard
      title="Money in"
      description="What you billed against what reached the clinic"
      loading={loading}
      refreshing={refreshing}
      isEmpty={rows.length === 0 || (totals.billed === 0 && totals.collected === 0)}
      delta={delta}
      legend={[
        { label: 'Collected', color: SERIES.strong },
        { label: 'Still owed', color: SERIES.soft, soft: true },
      ]}
      takeaway={takeaway}
      emptyTitle="No money moved in this period"
      emptyHint="Bills you raise and payments you take will show up here."
      table={{
        height: geo.height,
        columns: [
          { key: 'label', label: 'Period' },
          { key: 'billed', label: 'Billed', align: 'right', format: formatMoney },
          { key: 'collected', label: 'Collected', align: 'right', format: formatMoney },
          { key: 'owed', label: 'Still owed', align: 'right', format: (v) => (v > 0 ? formatMoney(v) : '—') },
        ],
        rows,
      }}
    >
      <ResponsiveContainer width="100%" height={geo.height}>
        <BarChart data={rows} margin={CHART_MARGIN} accessibilityLayer>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(val) => `${cur}${formatToK(val)}`}
            // The stack's height is collected + owed, which is max(billed,
            // collected). Measuring the domain against 'billed' alone would
            // clip any column where an old bill was settled.
            domain={calculateYAxisDomain(rows.map((r) => ({ top: r.collected + r.owed })), ['top'])}
            // Wide enough for the longest tick this can produce, "₹276.1k".
            width={58}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: '#f6f6fa' }}
            formatter={(value, name) => [
              formatMoney(value),
              name === 'collected' ? 'Collected' : 'Still owed',
            ]}
          />
          <Bar
            dataKey="collected" stackId="money" fill={SERIES.strong}
            maxBarSize={BAR_MAX} radius={BAR_RADIUS} {...stackGap}
          />
          <Bar
            dataKey="owed" stackId="money" fill={SERIES.soft}
            maxBarSize={BAR_MAX} radius={BAR_RADIUS} {...stackGap}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default RevenueChart;
