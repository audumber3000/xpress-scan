import React from 'react';
import { Search } from 'lucide-react';

/**
 * The bar that sits above a table: search on the left, actions on the right.
 * Same shape as the one on Patients and Payments, so a person moving between
 * screens finds the search box in the place they already looked.
 *
 * Filters and buttons go in as `children` rather than props — every screen has a
 * different set, and a prop for each would turn this into a switchboard.
 *
 *   <TableToolbar search={q} onSearchChange={setQ} placeholder="Search staff...">
 *     <FilterPanel accent="teal" ... />
 *     <button>Add staff</button>
 *   </TableToolbar>
 */
const TableToolbar = ({
  search,
  onSearchChange,
  placeholder = 'Search...',
  accentRing = 'focus:ring-[#29828a]/20 focus:border-[#29828a]',
  children,
  className = '',
}) => (
  <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 ${className}`}>
    <div className="relative w-full md:max-w-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 transition-all ${accentRing}`}
      />
    </div>
    {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
  </div>
);

export default TableToolbar;
