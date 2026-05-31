import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle } from '../format';
import { getCurrencySymbol } from '../../../utils/currency';

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
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ left: -20, right: 4, top: 8, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }} interval="preserveStartEnd" />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
            tickFormatter={(val) => `${cur}${formatToK(val)}`}
            domain={calculateYAxisDomain(data, ['billed', 'collected'], 0.15)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [`${cur}${formatToK(value)}`, name === 'collected' ? 'Collected' : 'Billed']}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingTop: 8 }}
            formatter={(v) => (v === 'collected' ? 'Collected' : 'Billed')}
          />
          <Bar dataKey="collected" fill="#2a276e" radius={[5, 5, 0, 0]} barSize={26} />
          <Line type="monotone" dataKey="billed" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default RevenueChart;
