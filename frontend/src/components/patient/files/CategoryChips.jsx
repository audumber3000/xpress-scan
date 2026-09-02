import React from 'react';

/**
 * The type filter along the top of Imaging and Documents.
 *
 * Compact pills with the count inline — `IOPA (7)` — not two-line counter
 * cards. The card version turned six filters into a wall of boxes that outsized
 * the list they filter, and read as statistics rather than as a control.
 *
 * One row, wrapping, active pill filled in the brand navy. Same shape as the
 * filter controls beside it, so the whole bar reads as one thing.
 *
 * Zeroes stay visible: "CBCT (0)" answers "none of those", which is worth more
 * than a missing pill leaving the reader unsure the app tracks them at all.
 */
const CategoryChips = ({ items, value, onChange, className = '' }) => (
  <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Filter by type">
    {items.map((item) => {
      const active = value === item.key;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          aria-pressed={active}
          className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e] ${
            active
              ? 'bg-[#2a276e] border-[#2a276e] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          {item.label}
          <span className={`tabular-nums font-bold ${active ? 'text-white/70' : 'text-gray-400'}`}>
            ({item.count})
          </span>
        </button>
      );
    })}
  </div>
);

export default CategoryChips;
