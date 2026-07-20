import React from 'react';
import { noData } from '../../assets/illustrations';

/**
 * Compact empty state for dashboard widgets — used when a query succeeds but
 * returns no rows (so we never show an endless spinner for "no data"). Uses the
 * shared unDraw illustration so charts match the empty states across the app.
 * Any `icon` prop passed by older callers is simply ignored now.
 */
const EmptyState = ({ title = 'No data yet', hint }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-4">
    <img
      src={noData}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-24 w-auto mb-4 select-none opacity-95"
    />
    <p className="text-sm font-semibold text-gray-500">{title}</p>
    {hint && <p className="text-xs text-gray-400 mt-1 max-w-[220px]">{hint}</p>}
  </div>
);

export default EmptyState;
