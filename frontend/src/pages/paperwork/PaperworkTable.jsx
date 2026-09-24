import React from 'react';

/**
 * The one table shape every Paperwork tab uses.
 *
 * Consent forms and the medical form used to be built two different ways, a
 * table beside a card stack with different type sizes, so the section looked
 * like two products. Both now render through these pieces, which is what
 * stops them drifting apart again.
 *
 * Flat: a 1px border and an 8px corner, no shadow.
 */
export const PaperworkTable = ({ children, footer, className = '' }) => (
  <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0 ${className}`}>
    <div className="flex-1 overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[640px] divide-y divide-gray-200">{children}</table>
    </div>
    {footer}
  </div>
);

export const Th = ({ children, align = 'left', className = '' }) => (
  <th
    className={`px-5 py-3 text-${align} text-xs font-semibold text-gray-500 uppercase tracking-wider bg-[#f8fafc] ${className}`}
  >
    {children}
  </th>
);

export const Thead = ({ children }) => (
  <thead className="sticky top-0 z-10">
    <tr>{children}</tr>
  </thead>
);

export const Tbody = ({ children }) => (
  <tbody className="bg-white divide-y divide-gray-100">{children}</tbody>
);

export const Tr = ({ children, className = '' }) => (
  <tr className={`hover:bg-indigo-50/30 transition-colors duration-150 ${className}`}>{children}</tr>
);

export const Td = ({ children, align = 'left', className = '' }) => (
  <td className={`px-5 py-3.5 text-sm text-gray-600 text-${align} ${className}`}>{children}</td>
);

/** Row title plus a quiet second line, the first cell of every row. */
export const NameCell = ({ title, sub, children }) => (
  <Td>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      {children}
    </div>
  </Td>
);

/** A whole-row message: loading, empty, or nothing matched. */
export const FullRow = ({ cols, children }) => (
  <tr>
    <td colSpan={cols} className="px-5 py-10">{children}</td>
  </tr>
);

export const StatusPill = ({ active, activeLabel = 'Active', inactiveLabel = 'Draft' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
    {active ? activeLabel : inactiveLabel}
  </span>
);

export const RowButton = ({ children, onClick, tone = 'neutral', disabled, title, ...rest }) => {
  const tones = {
    neutral: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
    brand: 'text-[#2a276e] bg-[#2a276e]/5 hover:bg-[#2a276e]/10',
    danger: 'text-red-600 bg-red-50 hover:bg-red-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 ${tones[tone]}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export const IconButton = ({ children, onClick, label, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="p-1.5 rounded-lg text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 transition-colors disabled:opacity-50"
  >
    {children}
  </button>
);

export const HeaderButton = ({ children, onClick, primary = false, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={
      primary
        ? 'bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors flex items-center gap-2 disabled:opacity-60'
        : 'px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-60'
    }
  >
    {children}
  </button>
);
