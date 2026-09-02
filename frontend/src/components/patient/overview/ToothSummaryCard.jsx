import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TOOTH_NAMES } from '../dentalConstants';
import { formatDate } from '../../../utils/datetime';

/**
 * The tooth the chart above is currently telling you about.
 *
 * Picks the plan item still open on the lowest-numbered marked tooth, so the
 * card has something to say the moment a chart has anything on it, rather than
 * waiting for a selection the Overview cannot make (the chart here is
 * read-only).
 *
 * Renders nothing when the chart is blank — an empty detail card under an empty
 * chart is two ways of saying the same nothing.
 */
const STATUS = {
  planned: { label: 'Planned', dot: 'bg-[#2a276e]', text: 'text-[#2a276e]' },
  'in-progress': { label: 'In Progress', dot: 'bg-amber-500', text: 'text-amber-600' },
  in_progress: { label: 'In Progress', dot: 'bg-amber-500', text: 'text-amber-600' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-600' },
};

const ToothSummaryCard = ({ plan = [], onOpen }) => {
  const items = Array.isArray(plan) ? plan : [];
  const focus =
    items.find((i) => String(i.status || '').toLowerCase().replace('_', '-') === 'in-progress')
    || items.find((i) => String(i.status || 'planned').toLowerCase() !== 'completed')
    || items[0];

  if (!focus) return null;

  const s = STATUS[String(focus.status || 'planned').toLowerCase()] || STATUS.planned;
  const toothName = focus.tooth ? TOOTH_NAMES?.[focus.tooth] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e] grid place-items-center flex-shrink-0 text-sm font-bold">
            {focus.tooth || '—'}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 leading-none">{focus.tooth || 'General'}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">{toothName || 'Whole mouth'}</p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-[11px] font-semibold text-gray-500">Status</p>
          <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold text-gray-500">Treatment</dt>
          <dd className="text-xs text-gray-800 truncate" title={focus.procedure}>{focus.procedure || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold text-gray-500">Diagnosis</dt>
          <dd className="text-xs text-gray-800 truncate" title={focus.diagnosis}>{focus.diagnosis || '—'}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold text-[#2a276e] hover:underline cursor-pointer"
      >
        View tooth history <ArrowRight size={12} />
      </button>
    </div>
  );
};

export default ToothSummaryCard;
