import React from 'react';

/**
 * The Control Center's tab strip.
 *
 * This markup was copy-pasted identically into four sections (Notifications,
 * Medications, Access & Activity, Integrations). Every copy was a plain `flex`,
 * so on a narrow screen the tabs had nowhere to go: they shrank until the
 * labels wrapped onto two lines ("Message Logs") or the last tab was simply cut
 * off the right edge ("Consent Forms"), with nothing to indicate more existed.
 *
 * A tab strip should scroll, not compress. `shrink-0` and `whitespace-nowrap`
 * keep each tab its natural size, and the row scrolls sideways instead. The
 * scrollbar is hidden the same way the patient file's tab strip hides it, so
 * the two read as one app.
 *
 * @param {Array}  tabs      [{ id, label, icon }]
 * @param {string} active    id of the current tab
 * @param {func}   onChange  called with the tab id
 */
const SectionTabs = ({ tabs, active, onChange }) => (
  <div className="border-b border-gray-200">
    <div
      className="flex gap-1 -mb-px overflow-x-auto [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
              isActive
                ? 'border-[#29828a] text-[#29828a] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {Icon && <Icon size={14} className="shrink-0" />}
            {label}
          </button>
        );
      })}
    </div>
  </div>
);

export default SectionTabs;
