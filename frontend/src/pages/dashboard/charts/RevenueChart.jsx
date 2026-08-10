import React from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle, formatMoney } from '../format';
import { getCurrencySymbol } from '../../../utils/currency';
import { COLORS, GRID_PROPS, AXIS_PROPS, CHART_MARGIN, ChartDefs, geometryFor, trimBuckets } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RevenueChart = ({ data, loading, delta, breakpoint }) => {
  const cur = getCurrencySymbol();
  const geo = geometryFor(breakpoint);
  const rows = trimBuckets(data, geo.maxBuckets);

  // Name the collection gap in the subtitle — the space between the two series
  // is the whole point of the chart, and it shouldn't need measuring by eye.
  const gap = rows.reduce((sum, r) => sum + (Number(r.billed) || 0) - (Number(r.collected) || 0), 0);

  return (
    <ChartCard
      title="Revenue: billed vs collected"
      description={gap > 0 ? `${formatMoney(gap)} billed but not yet collected` : 'What you invoiced against what came in'}
      loading={loading}
      isEmpty={rows.length === 0}
      delta={delta}
      icon={<Icon />}
      legend={[
        { label: 'Collected', color: COLORS.primary },
        { label: 'Billed', color: COLORS.warning },
      ]}
      emptyTitle="No revenue in this period"
      emptyHint="Invoiced and collected amounts will appear here."
    >
      <ResponsiveContainer width="100%" height={geo.height}>
        <ComposedChart data={rows} margin={CHART_MARGIN} accessibilityLayer>
          <ChartDefs />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(val) => `${cur}${formatToK(val)}`}
            domain={calculateYAxisDomain(rows, ['billed', 'collected'], 0.15)}
            // Wide enough for the longest tick this can produce, "₹276.1k".
            width={58}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [formatMoney(value), name === 'collected' ? 'Collected' : 'Billed']}
          />
          <Area
            type="monotone" dataKey="collected"
            stroke={COLORS.primary} strokeWidth={2.5} fill="url(#areaPrimary)"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone" dataKey="billed"
            stroke={COLORS.warning} strokeWidth={2} strokeDasharray="5 4" dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default RevenueChart;
