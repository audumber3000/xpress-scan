import React from 'react';
import { CalendarPlus, FileText, ClipboardList, Upload, Camera, Printer } from 'lucide-react';
import OverviewCard from './OverviewCard';

/**
 * Six tiles, three across, as in the reference.
 *
 * Every one goes somewhere real: the first three open the tab that owns the
 * work, the last three fire an actual handler. A tile that leads nowhere is
 * worse than a gap in the grid, so nothing here is a placeholder.
 */
const ACTIONS = [
  { key: 'visit', label: 'New Visit', icon: CalendarPlus },
  { key: 'prescription', label: 'Prescription', icon: FileText },
  { key: 'plan', label: 'Treatment Plan', icon: ClipboardList },
  { key: 'document', label: 'Upload Document', icon: Upload },
  { key: 'photo', label: 'Clinical Photo', icon: Camera },
  { key: 'print', label: 'Print Summary', icon: Printer },
];

const QuickActionsCard = ({ onAction }) => (
  <OverviewCard title="Quick Actions">
    <div className="grid grid-cols-3 gap-2.5 p-3">
      {ACTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onAction?.(key)}
          className="flex flex-col items-center justify-center gap-2 px-1 py-4 rounded-lg border border-gray-200 hover:border-[#2a276e]/35 hover:bg-[#2a276e]/[0.03] transition-colors cursor-pointer"
        >
          <Icon size={18} className="text-[#2a276e]" />
          <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  </OverviewCard>
);

export default QuickActionsCard;
