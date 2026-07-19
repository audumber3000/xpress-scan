import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle } from '../format';
import { COLORS, CHART_HEIGHT, GRID_PROPS, AXIS_PROPS, LEGEND_PROPS, CHART_MARGIN, ChartDefs } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PatientStatsChart = ({ data, loading, delta }) => (
  <ChartCard
    title="New vs Returning Patients"
    description="First-time versus repeat patients over the period"
    loading={loading}
    isEmpty={data.length === 0}
    delta={delta}
    icon={<Icon />}
    emptyTitle="No patient activity in this period"
    emptyHint="New registrations and returning visits will appear here."
  >
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={data} margin={CHART_MARGIN} accessibilityLayer>
        <ChartDefs />
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis
          {...AXIS_PROPS}
          domain={calculateYAxisDomain(data, ['new', 'returning'])}
          tickFormatter={formatToK}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, name === 'new' ? 'New' : 'Returning']} />
        <Legend {...LEGEND_PROPS} formatter={(v) => (v === 'new' ? 'New' : 'Returning')} />
        <Area
          type="monotone" dataKey="new" stackId="p"
          stroke={COLORS.primary} strokeWidth={2} fill="url(#areaPrimary)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone" dataKey="returning" stackId="p"
          stroke={COLORS.primarySoft} strokeWidth={2} fill="url(#areaSoft)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </ChartCard>
);

export default PatientStatsChart;
