import React from 'react';

/**
 * Seven-day shape for a KPI card. Deliberately not a chart: no axes, no grid,
 * no tooltip. Nobody reads values off a 26px-tall graphic, so it only has to
 * answer "rising, falling or flat" at a glance.
 *
 * Plain divs rather than recharts — a ResponsiveContainer per KPI card costs a
 * ResizeObserver and a re-render on every viewport change, four times over, for
 * seven bars.
 */
/**
 * `highlight` picks which bar gets the solid navy:
 *   last — a time series, where "now" is the point of interest (the default)
 *   max  — a distribution, where the tallest bar is the mode and the last bar
 *          is just the rarest case; emphasising it there would be misleading
 *   none — no emphasis
 */
const KpiSparkline = ({ data = [], className = '', highlight = 'last' }) => {
  const points = Array.isArray(data) ? data : [];
  if (points.length === 0) return null;

  const max = Math.max(...points, 1);
  const highlightIndex =
    highlight === 'last' ? points.length - 1
      : highlight === 'max' ? points.indexOf(max)
        : -1;

  return (
    <div className={`flex items-end gap-[3px] h-7 ${className}`} aria-hidden="true">
      {points.map((v, i) => {
        const isLast = i === highlightIndex;
        // Floor at 8% so an empty day still reads as a bar rather than a gap —
        // otherwise a run of zeros looks like missing data instead of no data.
        const height = `${Math.max(8, (v / max) * 100)}%`;
        return (
          <div
            key={i}
            style={{ height }}
            className={`flex-1 rounded-t-[2px] transition-all ${
              isLast ? 'bg-[#2a276e]' : 'bg-[#9B8CFF]/55'
            }`}
          />
        );
      })}
    </div>
  );
};

export default KpiSparkline;
