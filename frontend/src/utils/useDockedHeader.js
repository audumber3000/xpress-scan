import { useLayoutEffect, useState } from "react";

/**
 * The docked section header shared by the list pages (Payments, Expenses,
 * Inventory, Lab).
 *
 * Those pages used to pin themselves to the viewport and hand the table an
 * inner scrollbar, so the summary cards held their height forever and the table
 * was left a short window onto six or seven rows. Instead the page scrolls as
 * one: the cards ride up and out, the tab strip stops at the top and the filter
 * bar docks directly under it. From there the table owns everything from below
 * the filter bar down to the bottom of the window.
 *
 * That needs two offsets and they have to be measured, not guessed. The filter
 * row wraps to a second line on a narrow window, and some tabs have no filter
 * row at all, so a hardcoded number leaves the column headers floating above
 * the bar or hidden behind it.
 *
 * Attach the two refs, then:
 *   tab strip   sticky top-0 z-30                  + an opaque background
 *   filter bar  sticky z-20 top={offsets.filters}  + an opaque background
 *   <thead>     sticky z-10 top={offsets.thead}
 *
 * Two rules come with it. The docked bars need an opaque background or rows
 * show through them, and no ancestor between the page and a sticky element may
 * set `overflow` -- that makes it stick to that box instead of the window,
 * which is what an `overflow-hidden` card or an `overflow-auto` scroll wrapper
 * quietly does.
 */
export default function useDockedHeader(enabled = true) {
  // Callback refs rather than useRef: the filter bar is conditional on a few of
  // these pages, and this way mounting or unmounting it re-runs the measure.
  const [tabsEl, setTabsEl] = useState(null);
  const [filtersEl, setFiltersEl] = useState(null);
  const [offsets, setOffsets] = useState({ filters: 0, thead: 0 });

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const measure = () => {
      const filters = tabsEl?.offsetHeight || 0;
      const thead = filters + (filtersEl?.offsetHeight || 0);
      setOffsets((prev) => (
        prev.filters === filters && prev.thead === thead ? prev : { filters, thead }
      ));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [tabsEl, filtersEl].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [enabled, tabsEl, filtersEl]);

  return { tabsRef: setTabsEl, filtersRef: setFiltersEl, offsets };
}
