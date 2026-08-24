import React from 'react';

/**
 * A Control Center section's title, and whatever action sits beside it.
 *
 * The four sections each wrote this as `flex items-center justify-between`,
 * which on a phone squeezed the heading and its Refresh/Save button into the
 * same row until both wrapped mid-word. Wrapping the whole action below the
 * title is the readable failure mode, so this wraps rather than compresses.
 */
const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-5">
    <div className="min-w-[12rem] flex-1">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default SectionHeader;
