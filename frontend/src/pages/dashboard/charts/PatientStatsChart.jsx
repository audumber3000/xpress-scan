import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle } from '../format';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PatientStatsChart = ({ data, loading, delta }) => (
  <ChartCard
    title="New vs Returning Patients"
    loading={loading}
    isEmpty={data.length === 0}
    delta={delta}
    icon={<Icon />}
    emptyTitle="No patient activity in this period"
    emptyHint="New registrations and returning visits will appear here."
  >
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ left: -20 }} accessibilityLayer>
        <defs>
          <linearGradient id="newGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a276e" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#2a276e" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: '#9ca3af' }} interval="preserveStartEnd" />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: '#9ca3af' }}
          domain={calculateYAxisDomain(data, ['new', 'returning'])}
          tickFormatter={formatToK}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: '#f3f4f6', radius: 8 }}
          formatter={(value, name) => [value, name === 'new' ? 'New' : 'Returning']}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingTop: 8 }} formatter={(v) => (v === 'new' ? 'New' : 'Returning')} />
        <Bar dataKey="new" stackId="p" fill="url(#newGradient)" radius={[0, 0, 0, 0]} barSize={30} />
        <Bar dataKey="returning" stackId="p" fill="#9B8CFF" radius={[5, 5, 0, 0]} barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);

export default PatientStatsChart;
