import React from 'react';
import EmptyState from './EmptyState';
import ChartSkeleton from './ChartSkeleton';

// Small "▲ 12% vs last period" caption, color-coded; "—" when flat/unknown.
const DeltaCaption = ({ delta }) => {
  if (!delta) return null;
  const { change, changeType } = delta;
  const flat = !change || Math.abs(change) === 0;
  return (
    <span className={`text-xs font-semibold ${flat ? 'text-gray-400' : changeType === 'up' ? 'text-green-600' : 'text-red-500'}`}>
      {flat ? '—' : `${changeType === 'up' ? '▲' : '▼'} ${Math.abs(change)}%`}
      <span className="text-gray-400 font-medium"> vs last period</span>
    </span>
  );
};

/**
 * Standardized white card wrapper for a dashboard chart. Shows a skeleton while
 * fetching, a proper empty state when there's no data, then the chart.
 */
const ChartCard = ({ title, icon, children, loading, isEmpty, delta, emptyTitle, emptyHint, emptyIcon }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 flex flex-col w-full h-full shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-3 mb-5 md:mb-6">
      <div className="p-2.5 bg-[#f0f0fd] rounded-xl text-[#2a276e] border border-[#c5c2f0]/30 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-gray-800 tracking-tight text-base md:text-lg leading-tight">{title}</h3>
        {!loading && !isEmpty && <DeltaCaption delta={delta} />}
      </div>
    </div>

    <div className="flex-1 relative min-h-[220px]">
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
