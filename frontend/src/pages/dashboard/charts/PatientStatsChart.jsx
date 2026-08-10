import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import ChartCard from '../ChartCard';
import { formatToK, calculateYAxisDomain, tooltipStyle } from '../format';
import { COLORS, GRID_PROPS, AXIS_PROPS, CHART_MARGIN, geometryFor, trimBuckets } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
  </svg>
);

const LABELS = { new: 'New', returning: 'Returning' };

/**
 * New against returning patients, as side-by-side bars.
 *
 * Was a stacked area chart, which made "returning" unreadable on its own — a
 * stacked band's height is the sum, so you were eyeballing the difference
 * between two curves. These are discrete counts per bucket, and the question is
 * "how do the two compare", which is exactly what paired bars answer.
 *
 * Bucket granularity comes from the header's period filter: hours for a single
 * day, days for a week or month, months for all-time.
 */
const PatientStatsChart = ({ data, loading, delta, breakpoint }) => {
  const geo = geometryFor(breakpoint);
  const rows = trimBuckets(data, geo.maxBuckets);
  const trimmed = (data?.length || 0) > rows.length;

  return (
    <ChartCard
      title="New vs returning patients"
      description={trimmed ? `Most recent ${rows.length} periods` : 'First-time against repeat visits'}
      loading={loading}
      isEmpty={rows.length === 0}
      delta={delta}
      icon={<Icon />}
      legend={[
        { label: 'New', color: COLORS.primary },
        { label: 'Returning', color: COLORS.primarySoft },
      ]}
      emptyTitle="No patient activity in this period"
      emptyHint="New registrations and returning visits will appear here."
    >
      <ResponsiveContainer width="100%" height={geo.height}>
        <BarChart data={rows} margin={{ ...CHART_MARGIN, top: geo.labels ? 18 : 8 }} barGap={geo.groupGap} accessibilityLayer>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
          <YAxis
            {...AXIS_PROPS}
            domain={calculateYAxisDomain(rows, ['new', 'returning'])}
            tickFormatter={formatToK}
            allowDecimals={false}
            width={34}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: COLORS.grid, radius: 6 }}
            formatter={(value, name) => [value, LABELS[name] || name]}
          />
          <Bar dataKey="new" fill={COLORS.primary} barSize={geo.barSize} radius={[4, 4, 0, 0]}>
            {geo.labels && (
              <LabelList
                dataKey="new"
                position="top"
                formatter={(v) => (v > 0 ? v : '')}
                style={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
              />
            )}
          </Bar>
          <Bar dataKey="returning" fill={COLORS.primarySoft} barSize={geo.barSize} radius={[4, 4, 0, 0]}>
            {geo.labels && (
              <LabelList
                dataKey="returning"
                position="top"
                formatter={(v) => (v > 0 ? v : '')}
                style={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default PatientStatsChart;
