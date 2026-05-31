import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Compact empty state for dashboard widgets — used when a query succeeds but
 * returns no rows (so we never show an endless spinner for "no data").
 */
const EmptyState = ({ icon: Icon = Inbox, title = 'No data yet', hint }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-4">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <Icon size={22} className="text-gray-300" />
    </div>
    <p className="text-sm font-semibold text-gray-500">{title}</p>
    {hint && <p className="text-xs text-gray-400 mt-1 max-w-[220px]">{hint}</p>}
  </div>
);

export default EmptyState;
