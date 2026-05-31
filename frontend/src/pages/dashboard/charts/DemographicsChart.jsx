import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import ChartCard from '../ChartCard';
import { tooltipStyle } from '../format';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
  </svg>
);

const DemographicsChart = ({ data, loading }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard
      title="Patients by Age"
      loading={loading}
      isEmpty={data.length === 0 || total === 0}
      icon={<Icon />}
      emptyTitle="No age data"
      emptyHint="Add patient ages to see the age breakdown."
    >
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ left: -20, top: 16 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#6b7280' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f3f4f6', radius: 8 }} formatter={(value) => [value, 'Patients']} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.color} />
            ))}
            <LabelList dataKey="value" position="top" formatter={(v) => (v > 0 ? v : '')} style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default DemographicsChart;
