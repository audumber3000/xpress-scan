import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * Keep a fixed-position panel glued beside the element it belongs to.
 *
 * Modelled on components/FilterPanel.jsx, the one place in this app that
 * already does this correctly. The detail that makes it work is the
 * capture-phase scroll listener: the calendar has three nested scroll
 * containers and none of them fire a scroll event that reaches `window`.
 * Without capture the panel silently drifts away from its appointment.
 *
 * The anchor is re-queried by selector on every reposition rather than held as
 * a rect or a ref, because React replaces the card's DOM node whenever the
 * appointment changes status. A held reference would be stale the moment
 * somebody checked a patient in.
 */

const GUTTER = 8;
// The grid's column header is `sticky top-0 z-20`, so a panel anchored to a
// card near the top would otherwise sit underneath it.
const HEADER_SAFE = 56;

export default function useAnchoredPosition(anchorSelector, {
  width = 380,
  open = true,
  panelRef,          // measured, so a card low on the grid can grow upward
} = {}) {
  const [pos, setPos] = useState(null);
  const [lost, setLost] = useState(false);

  const place = useCallback(() => {
    if (!anchorSelector) { setPos({ centred: true }); return; }
    const el = document.querySelector(anchorSelector);
    if (!el) { setLost(true); return; }

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.bottom < HEADER_SAFE || rect.top > vh || rect.right < 0 || rect.left > vw) {
      setLost(true);
      return;
    }

    const w = Math.min(width, vw - GUTTER * 2);

    // ── Sideways: beside the card if either flank has room ────────────────
    let left;
    if (vw - rect.right - GUTTER >= w) left = rect.right + GUTTER;
    else if (rect.left - GUTTER >= w) left = rect.left - GUTTER - w;
    else left = Math.max(GUTTER, Math.min(rect.left, vw - GUTTER - w));

    // ── Vertically: never clipped, never hidden ───────────────────────────
    //
    // The panel's real height, measured. Guessing it was the bug: a card near
    // the bottom of the grid got squashed against the viewport floor, or
    // dropped out of sight entirely.
    //
    // Google's behaviour, and the right one: start level with the card, and if
    // that would run past the bottom, hang the panel's BOTTOM edge near the
    // card instead so it grows upward. The card stays whole either way.
    const h = panelRef?.current?.offsetHeight || 420;
    const room = vh - GUTTER * 2;

    let top = rect.top;
    if (top + h > vh - GUTTER) top = rect.bottom - h;   // grow upward
    top = Math.max(HEADER_SAFE, Math.min(top, vh - GUTTER - Math.min(h, room)));

    // Only ever constrain when the panel genuinely cannot fit the screen, so a
    // short card is never given a scrollbar it does not need.
    const maxHeight = Math.min(vh * 0.9, room);

    setPos({ top, left, width: w, maxHeight, centred: false });
  }, [anchorSelector, width, panelRef]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); setLost(false); return undefined; }
    setLost(false);
    place();

    let frame = null;
    const onMove = () => {
      if (frame) return;                       // one reposition per frame
      frame = requestAnimationFrame(() => { frame = null; place(); });
    };

    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);   // capture

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onMove);
      // The panel: its height changes as the billing and patient requests land,
      // and a taller panel may no longer fit below the card.
      if (panelRef?.current) ro.observe(panelRef.current);
      // The anchor: opening an appointment collapses the sidebar, which widens
      // every grid column over a 300ms transition. That moves the card the
      // panel is pointing at, and a layout change fires neither `resize` nor
      // `scroll`, so without watching the card itself the panel would sit where
      // the card used to be.
      const anchorEl = anchorSelector && document.querySelector(anchorSelector);
      if (anchorEl) ro.observe(anchorEl);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      ro?.disconnect();
    };
  }, [open, place, panelRef, anchorSelector]);

  // Re-measure once the panel has rendered and its real height is known.
  useEffect(() => { if (open) place(); }, [open, place]);

  return { pos, lost };
}
