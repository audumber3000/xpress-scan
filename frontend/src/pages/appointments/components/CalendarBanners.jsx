import React from "react";

/**
 * The one thing the calendar still has to say out loud.
 *
 * A filter hiding every appointment looks identical to a broken page, so this
 * says which it is and offers the way out.
 *
 * The "past appointments still open" banner that used to live here has moved
 * into the day rail behind a warning badge. It was correct but expensive: a
 * full-width block above the grid, pushing the day down the page every morning
 * for something nobody needed to act on immediately.
 */
const CalendarBanners = ({ totalCount, visibleCount, onShowEveryone }) => (
  <>
    {/* A filter is on and it is hiding everything. An empty grid looks
        identical to a broken one, so say which it is and offer the way out. */}
    {totalCount > 0 && visibleCount === 0 && (
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-blue-900">
          <strong>{totalCount}</strong> appointment{totalCount === 1 ? ' is' : 's are'} hidden by the filters on this page.
        </p>
        <button
          onClick={onShowEveryone}
          className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-xs font-bold text-blue-900 hover:bg-blue-100"
        >
          Show everyone
        </button>
      </div>
    )}

    </>
);

export default CalendarBanners;
