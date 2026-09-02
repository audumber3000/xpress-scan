import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * One visit in the timeline.
 *
 * The date is a stacked block on the left with a connector dot, so a run of
 * visits reads as a sequence rather than a table. Everything after it is
 * optional: a case paper often has no linked appointment, so duration and type
 * are simply left out rather than rendered as an em dash nobody can act on.
 */
const STATUS = {
  Completed: 'bg-emerald-50 text-emerald-700',
  'In Progress': 'bg-amber-50 text-amber-700',
};

const VisitRow = ({ visit, latest = false, onOpen }) => {
  const d = visit.date ? new Date(visit.date) : null;
  const valid = d && !isNaN(d.getTime());

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-stretch gap-4 px-4 py-3.5 text-left border-b border-gray-50 last:border-0 transition-colors cursor-pointer group ${
        latest ? 'bg-[#2a276e]/[0.03]' : 'hover:bg-gray-50/70'
      }`}
    >
      <span className="w-12 flex-shrink-0 text-center">
        <span className="block text-base font-bold text-gray-900 leading-none tabular-nums">
          {valid ? String(d.getDate()).padStart(2, '0') : '—'}
        </span>
        <span className="block text-[11px] font-semibold text-gray-500 mt-0.5">
          {valid ? d.toLocaleString('en-IN', { month: 'short' }) : ''}
        </span>
        <span className="block text-[10px] text-gray-400 tabular-nums">
          {valid ? d.getFullYear() : ''}
        </span>
      </span>

      {/* The thread down the left edge. Purely decorative, so it is hidden from
          assistive tech rather than announced as an empty element. */}
      <span aria-hidden="true" className="relative w-px bg-gray-100 flex-shrink-0">
        <span className={`absolute left-1/2 top-3 -translate-x-1/2 w-2 h-2 rounded-full ${
          latest ? 'bg-[#2a276e]' : 'bg-gray-300'
        }`} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate" title={visit.title}>
            {visit.title}
          </span>
          {latest && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#2a276e]/[0.08] text-[#2a276e] whitespace-nowrap">
              Latest visit
            </span>
          )}
        </span>

        <span className="block text-xs text-gray-500 mt-0.5 truncate">
          {[visit.doctor, visit.duration ? `${visit.duration} mins` : null]
            .filter(Boolean).join('  ·  ') || 'No doctor recorded'}
        </span>

        {visit.note && (
          <span className="block text-[11px] text-gray-400 mt-1 truncate" title={visit.note}>
            {visit.note}
          </span>
        )}
      </span>

      <span className="flex items-center gap-2 flex-shrink-0 self-center">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
          STATUS[visit.status] || 'bg-gray-100 text-gray-600'
        }`}>
          {visit.status}
        </span>
        <ChevronRight size={15} className="text-gray-300 group-hover:text-[#2a276e] transition-colors" />
      </span>
    </button>
  );
};

export default VisitRow;
