import React from 'react';
import { Plus, FileText, Download } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { formatDate } from '../../../utils/datetime';

/**
 * Prescriptions, on the Overview, where you can also write one.
 *
 * This card used to be a tile that dumped you on another tab. Reading the last
 * few and writing the next one are the same thirty seconds of work, so both
 * happen here: the list is real data and the button opens the same
 * PrescriptionDrawer the Prescriptions tab uses. One drawer, one code path.
 */
const PrescriptionsCard = ({ prescriptions = [], onNew, onOpen, onDownload, className = '' }) => {
  const recent = [...prescriptions]
    .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
    .slice(0, 3);

  return (
    <OverviewCard title="Prescriptions" action="New prescription" onOpen={onNew} className={className}>
      {recent.length === 0 ? (
        <OverviewEmpty action="Write a prescription" onAction={onNew}>
          Nothing prescribed to this patient yet.
        </OverviewEmpty>
      ) : (
        recent.map((rx, i) => {
          const items = Array.isArray(rx.items) ? rx.items : [];
          const summary = items.map((m) => m.name || m.medicine).filter(Boolean).join(', ');
          return (
            <div
              key={rx.id ?? i}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0"
            >
              <span className="w-8 h-8 rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e] grid place-items-center flex-shrink-0">
                <FileText size={14} />
              </span>
              <button
                type="button"
                onClick={() => onOpen?.(rx)}
                className="min-w-0 flex-1 text-left cursor-pointer group"
              >
                <p className="text-xs font-semibold text-gray-900 group-hover:text-[#2a276e] transition-colors">
                  {formatDate(rx.created_at || rx.date)}
                </p>
                <p className="text-[11px] text-gray-400 truncate" title={summary}>
                  {summary || `${items.length || 0} item${items.length === 1 ? '' : 's'}`}
                </p>
              </button>
              {rx.pdf_url && (
                <a
                  href={rx.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the PDF"
                  aria-label={`Open the prescription PDF from ${formatDate(rx.created_at || rx.date)}`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <Download size={14} />
                </a>
              )}
            </div>
          );
        })
      )}

      <div className="p-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onNew}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-[#2a276e]/35 transition-colors cursor-pointer"
        >
          <Plus size={15} className="text-[#2a276e]" /> New prescription
        </button>
      </div>
    </OverviewCard>
  );
};

export default PrescriptionsCard;
