import React from 'react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { formatDate } from '../../../utils/datetime';

/** The last three case papers. A list, not a table: three rows do not need columns. */
const RecentVisitsCard = ({ casePapers = [], onOpen }) => (
  <OverviewCard title="Recent visits" onOpen={onOpen}>
    {casePapers.length === 0 ? (
      <OverviewEmpty>No visits recorded yet.</OverviewEmpty>
    ) : (
      casePapers.slice(0, 3).map((cp, i) => (
        <div
          key={cp.id ?? i}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0"
        >
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold grid place-items-center flex-shrink-0">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{formatDate(cp.date)}</p>
            <p className="text-[11px] text-gray-400 truncate" title={cp.dentist_name || undefined}>{cp.dentist_name || 'No doctor recorded'}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${
            cp.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {cp.status || 'In Progress'}
          </span>
        </div>
      ))
    )}
  </OverviewCard>
);

export default RecentVisitsCard;
