import React from 'react';

// Pulsing bar-chart placeholder shown while a widget loads — feels faster than
// a spinner because it previews the chart's shape.
const HEIGHTS = ['45%', '70%', '35%', '85%', '55%', '75%', '40%', '60%'];

const ChartSkeleton = () => (
  <div className="absolute inset-0 flex items-end justify-between gap-2 px-1 pb-6 animate-pulse">
    {HEIGHTS.map((h, i) => (
      <div key={i} className="flex-1 bg-gray-100 rounded-md" style={{ height: h }} />
    ))}
  </div>
);

export default ChartSkeleton;
