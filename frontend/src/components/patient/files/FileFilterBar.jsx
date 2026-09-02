import React from 'react';
import { Search, LayoutGrid, List } from 'lucide-react';

/**
 * Search, two selects, a sort and a view switch.
 *
 * Shared by Imaging and Documents because the two rows are the same control in
 * two vocabularies, and a filter bar that drifts between sibling tabs is the
 * kind of difference nobody decides on — it just happens.
 */
const select = 'h-9 px-3 pr-8 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]';

const FileFilterBar = ({
  query, onQuery, placeholder = 'Search…',
  filters = [], sort, onSort, sortOptions = [],
  view, onView,
}) => (
  <div className="flex flex-wrap items-center gap-2.5 mb-4">
    <div className="relative flex-1 min-w-[12rem] max-w-xs">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-9 pl-9 pr-3 bg-white border border-gray-200 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]"
      />
    </div>

    {filters.map((f) => (
      <select key={f.key} value={f.value} onChange={(e) => f.onChange(e.target.value)} aria-label={f.label} className={select}>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ))}

    {sortOptions.length > 0 && (
      <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort" className={select}>
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )}

    {onView && (
      <div className="ml-auto inline-flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="View mode">
        {[['grid', LayoutGrid, 'Grid view'], ['list', List, 'List view']].map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onView(mode)}
            aria-label={label}
            aria-pressed={view === mode}
            className={`w-9 h-9 grid place-items-center transition-colors cursor-pointer ${
              view === mode ? 'bg-[#2a276e] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    )}
  </div>
);

export default FileFilterBar;
