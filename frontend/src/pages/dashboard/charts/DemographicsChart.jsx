import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import ChartCard from '../ChartCard';
import { tooltipStyle } from '../format';
import { COLORS, RAMP, CHART_HEIGHT, BAR_SIZE, BAR_RADIUS, GRID_PROPS, AXIS_PROPS, CHART_MARGIN } from '../chartTheme';

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
      description="How your patient base breaks down by age"
      loading={loading}
      isEmpty={data.length === 0 || total === 0}
      icon={<Icon />}
      emptyTitle="No age data"
      emptyHint="Add patient ages to see the age breakdown."
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ ...CHART_MARGIN, top: 16 }} accessibilityLayer>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="name" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: COLORS.grid, radius: 8 }} formatter={(value) => [value, 'Patients']} />
          {/* Single-hue ramp (darkest = youngest) keeps it on-brand instead of a rainbow. */}
          <Bar dataKey="value" radius={BAR_RADIUS} barSize={BAR_SIZE + 8}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={RAMP[idx % RAMP.length]} />
            ))}
            <LabelList dataKey="value" position="top" formatter={(v) => (v > 0 ? v : '')} style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default DemographicsChart;
