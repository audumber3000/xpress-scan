import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';

/**
 * The lab case list below 768px.
 *
 * The desktop table carries patient, work type, tooth, shade, vendor, due date,
 * cost and a status select — nine columns that cannot honestly shrink to 390px.
 * Each case becomes a stacked card: who and what on top, vendor and due date
 * beneath, cost and status on the right.
 */

const STATUS_STYLES = {
  Draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-50 text-blue-700',
  Received: 'bg-green-50 text-green-700',
  Completed: 'bg-green-50 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

const LabCaseList = ({ orders, onSelect }) => {
  const cur = getCurrencySymbol();
  const now = Date.now();

  return (
    <div className="divide-y divide-gray-100">
      {orders.map((o) => {
        const status = o.status || 'Draft';
        const due = o.due_date ? new Date(o.due_date) : null;
        // Only open work can be late — a delivered case that was late is
        // history, not a task.
        const isOpen = status === 'Draft' || status === 'Sent';
        const lateDays = due && isOpen && due.getTime() < now
          ? Math.floor((now - due.getTime()) / 86400000)
          : 0;

        return (
          <button
            key={o.id}
            onClick={() => onSelect?.(o)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[3.5rem] active:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {o.patient_name || 'Unknown patient'}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[status] || STATUS_STYLES.Draft}`}>
                  {status}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {o.work_type || 'Lab work'}
                {o.tooth_number ? ` · ${o.tooth_number}` : ''}
                {o.vendor_name ? ` · ${o.vendor_name}` : ''}
              </p>
              {due && (
                <p className={`text-[11px] truncate ${lateDays ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {lateDays ? `${lateDays}d overdue` : `Due ${formatDate(o.due_date)}`}
                </p>
              )}
            </div>

            {Number(o.cost) > 0 && (
              <span className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
                {cur}{Number(o.cost).toLocaleString('en-IN')}
              </span>
            )}
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default LabCaseList;
