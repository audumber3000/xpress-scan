import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '../ChartCard';
import { tooltipStyle, formatCount } from '../format';
import { DONUT, geometryFor } from '../chartTheme';

const Icon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9A9.004 9.004 0 0015 3.512V9h5.488z" />
  </svg>
);

/**
 * Gender split across the whole patient base.
 *
 * `gender` is a free-text nullable column, so the backend folds everything it
 * can't read into "Not recorded" rather than dropping it. That slice is shown
 * in grey and counted honestly — on most existing clinics it will be large, and
 * hiding it would make the other two slices look like percentages of the roster
 * when they are percentages of the recorded subset.
 */
const DemographicsChart = ({ data, loading, breakpoint }) => {
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((sum, d) => sum + (d.value || 0), 0);
  const small = breakpoint === 'mobile';
  const geo = geometryFor(breakpoint);

  // Empty slices stay out of the pie (recharts renders a zero-width wedge that
  // still catches the tooltip) but stay in the legend so the layout is stable.
  const slices = rows.filter((d) => d.value > 0);

  return (
    <ChartCard
      title="Patients by gender"
      description="Across your whole patient base"
      loading={loading}
      isEmpty={total === 0}
      icon={<Icon />}
      emptyTitle="No patients yet"
      emptyHint="The gender breakdown appears once you have patients on file."
    >
      <div className={`flex items-center gap-4 ${small ? 'flex-col' : 'flex-row'}`} style={{ minHeight: geo.height - 40 }}>
        <div className="relative flex-shrink-0" style={{ width: small ? 150 : 170, height: small ? 150 : 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={small ? DONUT.innerSm : DONUT.inner}
                outerRadius={small ? DONUT.outerSm : DONUT.outer}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  `${formatCount(value)} (${total ? Math.round((value / total) * 100) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre total. pointer-events-none so it never eats a hover meant
              for the wedge underneath. */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center leading-tight">
              <div className="text-xl font-extrabold text-gray-900 tracking-tight tabular-nums">
                {formatCount(total)}
              </div>
              <div className="text-[10px] text-gray-400 font-medium">patients</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 w-full min-w-0">
          {rows.map(({ name, value, color }) => (
            <div key={name} className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-gray-500 flex-1 truncate">{name}</span>
              <span className="font-bold text-gray-800 tabular-nums flex-shrink-0">
                {formatCount(value)}
                <span className="text-gray-400 font-medium ml-1.5">
                  {total ? Math.round((value / total) * 100) : 0}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
};

export default DemographicsChart;
