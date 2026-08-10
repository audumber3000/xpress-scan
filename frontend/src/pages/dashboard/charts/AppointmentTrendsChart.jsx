import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { calculateYAxisDomain, tooltipStyle } from '../format';
import { COLORS, GRID_PROPS, AXIS_PROPS, CHART_MARGIN, geometryFor, trimBuckets } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LABELS = { completed: 'Completed', missed: 'No-show / cancelled', scheduled: 'Scheduled' };

const AppointmentTrendsChart = ({ data, loading, delta, breakpoint }) => {
  const geo = geometryFor(breakpoint);
  const rows = trimBuckets(data, geo.maxBuckets);

  const totals = rows.reduce(
    (acc, r) => ({
      completed: acc.completed + (r.completed || 0),
      missed: acc.missed + (r.missed || 0),
      all: acc.all + (r.bookings || 0),
    }),
    { completed: 0, missed: 0, all: 0 }
  );
  const missRate = totals.all ? Math.round((totals.missed / totals.all) * 100) : 0;

  return (
    <ChartCard
      title="Appointment outcomes"
      description={totals.all ? `${missRate}% of bookings were missed or cancelled` : 'Completed, cancelled and no-show visits'}
      loading={loading}
      isEmpty={rows.length === 0}
      delta={delta}
      icon={<Icon />}
      legend={[
        { label: 'Completed', color: COLORS.positive },
        { label: 'Scheduled', color: COLORS.primarySoft },
        { label: 'Missed', color: COLORS.danger },
      ]}
      emptyTitle="No appointments in this period"
      emptyHint="Booked, completed and missed visits will appear here."
    >
      <ResponsiveContainer width="100%" height={geo.height}>
        <BarChart data={rows} margin={CHART_MARGIN} accessibilityLayer>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis {...AXIS_PROPS} domain={calculateYAxisDomain(rows, ['bookings'], 0.1)} allowDecimals={false} width={30} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: COLORS.grid, radius: 6 }}
            formatter={(value, name) => [value, LABELS[name] || name]}
          />
          <Bar dataKey="completed" stackId="a" fill={COLORS.positive} barSize={geo.barSize} />
          <Bar dataKey="scheduled" stackId="a" fill={COLORS.primarySoft} barSize={geo.barSize} />
          <Bar dataKey="missed" stackId="a" fill={COLORS.danger} radius={[4, 4, 0, 0]} barSize={geo.barSize} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default AppointmentTrendsChart;
