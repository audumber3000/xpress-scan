import React from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle } from '../format';
import { getCurrencySymbol } from '../../../utils/currency';
import { COLORS, CHART_HEIGHT, GRID_PROPS, AXIS_PROPS, LEGEND_PROPS, CHART_MARGIN, ChartDefs } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RevenueChart = ({ data, loading, delta }) => {
  const cur = getCurrencySymbol();
  return (
    <ChartCard
      title="Revenue: Billed vs Collected"
      loading={loading}
      isEmpty={data.length === 0}
      delta={delta}
      icon={<Icon />}
      emptyTitle="No revenue in this period"
      emptyHint="Invoiced and collected amounts will appear here."
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart data={data} margin={CHART_MARGIN} accessibilityLayer>
          <ChartDefs />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis
            {...AXIS_PROPS}
            tickFormatter={(val) => `${cur}${formatToK(val)}`}
            domain={calculateYAxisDomain(data, ['billed', 'collected'], 0.15)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [`${cur}${formatToK(value)}`, name === 'collected' ? 'Collected' : 'Billed']}
          />
          <Legend {...LEGEND_PROPS} formatter={(v) => (v === 'collected' ? 'Collected' : 'Billed')} />
          <Area
            type="monotone" dataKey="collected"
            stroke={COLORS.primary} strokeWidth={2.5} fill="url(#areaPrimary)"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone" dataKey="billed"
            stroke={COLORS.warning} strokeWidth={2.5} strokeDasharray="5 4" dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default RevenueChart;
