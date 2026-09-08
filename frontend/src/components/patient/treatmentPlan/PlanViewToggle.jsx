import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

/**
 * Board or table.
 *
 * Modelled on the view switch in files/FileFilterBar — same bordered group,
 * same aria-pressed treatment — but carrying labels, because "board" and
 * "table" are not conveyed by their icons the way grid and list are.
 *
 * No animation on the swap itself. This is a control a doctor may flip several
 * times while reading a plan, and anything that has to finish before the next
 * click lands makes the interface feel slower than it is.
 */
const VIEWS = [
  { id: 'board', label: 'Board', Icon: LayoutGrid },
  { id: 'table', label: 'Table', Icon: List },
];

const PlanViewToggle = ({ view, onChange }) => (
  <div
    role="group"
    aria-label="Treatment plan view"
    className="inline-flex rounded-lg border border-gray-200 overflow-hidden"
  >
    {VIEWS.map(({ id, label, Icon }) => {
      const active = view === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active}
          className={`inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-semibold cursor-pointer transition-[background-color,color] duration-150 ease-out ${
            active
              ? 'bg-[#2a276e] text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Icon size={15} />
          {label}
        </button>
      );
    })}
  </div>
);

export default PlanViewToggle;
