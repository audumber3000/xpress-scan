import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { calculateYAxisDomain, tooltipStyle } from '../format';
import { COLORS, CHART_HEIGHT, BAR_SIZE, BAR_RADIUS, GRID_PROPS, AXIS_PROPS, LEGEND_PROPS, CHART_MARGIN } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const LABELS = { completed: 'Completed', missed: 'No-show / Cancelled', scheduled: 'Scheduled' };

const AppointmentTrendsChart = ({ data, loading, delta }) => (
  <ChartCard
    title="Appointment Outcomes"
    description="Completed, cancelled and no-show visits"
    loading={loading}
    isEmpty={data.length === 0}
    delta={delta}
    icon={<Icon />}
    emptyTitle="No appointments in this period"
    emptyHint="Booked, completed and missed visits will appear here."
  >
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={CHART_MARGIN} accessibilityLayer>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="time" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} domain={calculateYAxisDomain(data, ['bookings'], 0.1)} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: COLORS.grid, radius: 8 }} formatter={(value, name) => [value, LABELS[name] || name]} />
        <Legend {...LEGEND_PROPS} formatter={(v) => LABELS[v] || v} />
        <Bar dataKey="completed" stackId="a" fill={COLORS.positive} barSize={BAR_SIZE} />
        <Bar dataKey="scheduled" stackId="a" fill={COLORS.primarySoft} barSize={BAR_SIZE} />
        <Bar dataKey="missed" stackId="a" fill={COLORS.danger} radius={BAR_RADIUS} barSize={BAR_SIZE} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);

export default AppointmentTrendsChart;
