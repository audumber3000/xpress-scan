import React from 'react';
import EmptyState from './EmptyState';
import ChartSkeleton from './ChartSkeleton';

// Small "▲ 12% vs last period" caption, color-coded; "—" when flat/unknown.
const DeltaCaption = ({ delta }) => {
  if (!delta) return null;
  const { change, changeType } = delta;
  const flat = !change || Math.abs(change) === 0;
  return (
    <span className={`text-[11px] font-semibold ${flat ? 'text-gray-400' : changeType === 'up' ? 'text-green-600' : 'text-red-500'}`}>
      {flat ? '—' : `${changeType === 'up' ? '▲' : '▼'} ${Math.abs(change)}%`}
      <span className="text-gray-400 font-medium"> vs last</span>
    </span>
  );
};

/**
 * White card wrapper for a dashboard chart: skeleton while fetching, empty state
 * when there's nothing, then the chart.
 *
 * The legend lives up here in the header rather than inside the chart. Recharts'
 * own <Legend> eats vertical space from the plot area and re-flows the chart on
 * every resize; as header text it costs nothing and stays put.
 */
const ChartCard = ({
  title, icon, children, loading, isEmpty, delta, description,
  legend, emptyTitle, emptyHint, emptyIcon, action,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-3.5 md:p-5 flex flex-col w-full h-full">
    {/* flex-wrap, not truncate: a narrow card (the 1/3 column) has to give the
        title its full text and let the legend drop to the next line, otherwise
        "Appointment outcomes" renders as "Appoint…" next to a legend that had
        room to move. */}
    <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap mb-3.5">
      {/* min-w forces the legend to wrap to its own full line rather than
          squeezing into a 60px gutter beside a two-line title. */}
      <div className="flex items-center gap-2.5 min-w-[13rem] flex-1">
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-[#f0f0fd] text-[#2a276e] flex-shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-800 tracking-tight text-sm md:text-[15px] leading-tight">
            {title}
          </h3>
          {description && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap">
        {!loading && !isEmpty && legend?.length > 0 &&
          legend.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap">
              <i className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              {label}
            </span>
          ))}
        {!loading && !isEmpty && delta && <DeltaCaption delta={delta} />}
        {action}
      </div>
    </div>

    <div className="flex-1 relative min-h-[170px]">
      {loading ? (
        <ChartSkeleton />
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />
      ) : (
        children
      )}
    </div>
  </div>
);

export default ChartCard;
