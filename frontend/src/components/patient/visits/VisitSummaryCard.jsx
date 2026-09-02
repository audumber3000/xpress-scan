import React, { useMemo } from 'react';
import { formatDate } from '../../../utils/datetime';

/**
 * The five numbers that describe a patient's history at a glance.
 *
 * Visits come from case papers, because that is where a visit is recorded.
 * Cancelled and missed come from appointments instead — a no-show never
 * produced a case paper, so counting it from visits would report zero forever
 * and quietly flatter the clinic.
 */
const OFF = ['cancelled', 'no_show', 'no-show'];

const Line = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-600">{label}</span>
    <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${tone || 'text-gray-900'}`}>
      {value}
    </span>
  </div>
);

const VisitSummaryCard = ({ visits = [], appointments = [] }) => {
  const stats = useMemo(() => {
    const dated = visits
      .map((v) => (v.date ? new Date(v.date) : null))
      .filter((d) => d && !isNaN(d.getTime()))
      .sort((a, b) => a - b);
    return {
      total: visits.length,
      completed: visits.filter((v) => v.status === 'Completed').length,
      missed: appointments.filter((a) => OFF.includes(String(a.status || '').toLowerCase())).length,
      first: dated[0] || null,
      last: dated[dated.length - 1] || null,
    };
  }, [visits, appointments]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Visit summary</h3>
      </div>

      {stats.total === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-gray-500">
          Nothing to summarise yet.
        </p>
      ) : (
        <>
          <Line label="Total visits" value={stats.total} />
          <Line label="Completed" value={stats.completed} tone="text-emerald-600" />
          <Line
            label="Cancelled / missed"
            value={stats.missed}
            tone={stats.missed > 0 ? 'text-red-600' : 'text-gray-900'}
          />
          <Line label="First visit" value={stats.first ? formatDate(stats.first) : '—'} />
          <Line label="Last visit" value={stats.last ? formatDate(stats.last) : '—'} />
        </>
      )}
    </section>
  );
};

export default VisitSummaryCard;
