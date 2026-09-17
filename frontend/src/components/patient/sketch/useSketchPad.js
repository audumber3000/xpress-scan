import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLORS, HEIGHT, SIZES, TOOLS, WIDTH, emptySketch, newPage, newStroke,
  normaliseSketch,
} from './sketchModel';
import { strokeHit } from './strokePath';

// How many steps back Undo goes. Fifty is more than anyone reaches for in one
// sitting and small enough that the stacks never become the reason a tablet
// runs out of memory.
const HISTORY_LIMIT = 50;

// The eraser's reach, in logical units. Generous on purpose: this is used with
// a fingertip as often as a stylus, and an eraser you have to aim is an eraser
// that gets used twice and then abandoned.
const ERASER_RADIUS = 18;

/**
 * Everything a pen note does, apart from drawing itself.
 *
 * Kept out of the component because two of these behaviours are easy to get
 * subtly wrong and impossible to see in a screenshot:
 *
 *   Palm rejection. A tablet reports the heel of a hand as `pointerType:
 *   'touch'` while the stylus is writing. Once a pen has been seen on this
 *   surface, touch stops drawing — so a clinician can rest their hand on the
 *   screen like they would on paper. Before any pen has been seen, touch draws
 *   normally, because on a phone that is the only pointer there is.
 *
 *   Capture. The pointer is captured on the element for the whole stroke, so a
 *   line that runs off the edge of the canvas finishes cleanly instead of being
 *   left open — which is what leaves a stroke that never ends and an undo stack
 *   that no longer matches what is on screen.
 */
export function useSketchPad({ value, onChange, disabled = false }) {
  const [sketch, setSketch] = useState(() => normaliseSketch(value) || emptySketch());
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(SIZES[1].value);

  // The stroke currently under the pen. Held apart from the committed note so
  // every sample does not rewrite the whole document — at 120Hz on a tablet
  // that is the difference between ink that keeps up and ink that lags.
  const [live, setLive] = useState(null);
  const liveRef = useRef(null);
  const drawingId = useRef(null);
  const penSeen = useRef(false);

  const past = useRef([]);
  const future = useRef([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const syncDepth = () => setDepth({ undo: past.current.length, redo: future.current.length });

  // Re-seed when a different case paper is opened. Keyed on identity, not on
  // every change: re-seeding on our own writes would fight the user's pen.
  const seeded = useRef(value);
  useEffect(() => {
    if (value === seeded.current) return;
    seeded.current = value;
    setSketch(normaliseSketch(value) || emptySketch());
    setPageIndex(0);
    past.current = [];
    future.current = [];
    syncDepth();
  }, [value]);

  const page = sketch.pages[Math.min(pageIndex, sketch.pages.length - 1)] || sketch.pages[0];

  /** Every change to the note goes through here, so Undo always has the step. */
  const commit = useCallback((next, { history = true } = {}) => {
    setSketch((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (history) {
        past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
        future.current = [];
      }
      onChange?.(resolved);
      return resolved;
    });
    if (history) syncDepth();
  }, [onChange]);

  const replacePage = useCallback((mutate, opts) => {
    commit((prev) => {
      const pages = prev.pages.map((p, i) => (i === pageIndex ? mutate(p) : p));
      return { ...prev, pages };
    }, opts);
  }, [commit, pageIndex]);

  // ── Pointer → logical coordinates ─────────────────────────────────────────
  const surfaceRef = useRef(null);
  const toLogical = useCallback((e) => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return [
      ((e.clientX - box.left) / box.width) * WIDTH,
      ((e.clientY - box.top) / box.height) * HEIGHT,
      // A stylus reports real pressure. A mouse reports 0.5, and some browsers
      // report 0 for a button that is plainly down — which would render as a
      // stroke of no width at all, i.e. an invisible line the user just drew.
      e.pressure > 0 ? e.pressure : 0.5,
    ];
  }, []);

  const erase = useCallback((x, y) => {
    replacePage((p) => {
      const kept = p.strokes.filter((s) => !strokeHit(s, x, y, ERASER_RADIUS));
      return kept.length === p.strokes.length ? p : { ...p, strokes: kept };
    });
  }, [replacePage]);

  const onPointerDown = useCallback((e) => {
    if (disabled) return;
    if (e.pointerType === 'pen') penSeen.current = true;
    // The palm, once a pen has been used on this surface.
    if (e.pointerType === 'touch' && penSeen.current) return;
    // A stylus barrel button, or the eraser end of an Apple Pencil.
    const erasing = tool === TOOLS.ERASER || e.button === 5 || e.buttons === 32;

    const at = toLogical(e);
    if (!at) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingId.current = e.pointerId;

    if (erasing) { erase(at[0], at[1]); return; }

    const started = newStroke({ tool, color, size, points: [at] });
    liveRef.current = started;
    setLive(started);
  }, [disabled, tool, color, size, toLogical, erase]);

  const onPointerMove = useCallback((e) => {
    if (disabled || drawingId.current !== e.pointerId) return;
    const at = toLogical(e);
    if (!at) return;

    if (!liveRef.current) { erase(at[0], at[1]); return; }

    // Every intermediate position the browser coalesced while the main thread
    // was busy. Without this a fast stroke on a 120Hz tablet is drawn from the
    // handful of samples that happened to land between frames, and a quick
    // circle comes out as a pentagon.
    const events = typeof e.getCoalescedEvents === 'function'
      ? e.getCoalescedEvents() : [e];
    const added = events.map(toLogical).filter(Boolean);
    if (!added.length) return;

    liveRef.current = {
      ...liveRef.current,
      points: [...liveRef.current.points, ...added],
    };
    setLive(liveRef.current);
  }, [disabled, toLogical, erase]);

  const endStroke = useCallback((e) => {
    if (drawingId.current !== e.pointerId) return;
    drawingId.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const finished = liveRef.current;
    liveRef.current = null;
    setLive(null);
    // A tap with the pen is a dot, and a dot is a legitimate mark. Anything with
    // no points at all is not.
    if (finished && finished.points.length) {
      replacePage((p) => ({ ...p, strokes: [...p.strokes, finished] }));
    }
  }, [replacePage]);

  // ── History ───────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setSketch((current) => {
      future.current = [...future.current.slice(-(HISTORY_LIMIT - 1)), current];
      onChange?.(prev);
      return prev;
    });
    syncDepth();
  }, [onChange]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setSketch((current) => {
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), current];
      onChange?.(next);
      return next;
    });
    syncDepth();
  }, [onChange]);

  // ── Pages ─────────────────────────────────────────────────────────────────
  const clearPage = useCallback(() => {
    replacePage((p) => ({ ...p, strokes: [] }));
  }, [replacePage]);

  const setBackdrop = useCallback((backdrop) => {
    replacePage((p) => ({ ...p, backdrop }));
  }, [replacePage]);

  const addPage = useCallback(() => {
    commit((prev) => ({ ...prev, pages: [...prev.pages, newPage(page.backdrop)] }));
    setPageIndex(sketch.pages.length);
  }, [commit, page.backdrop, sketch.pages.length]);

  const removePage = useCallback(() => {
    if (sketch.pages.length <= 1) { clearPage(); return; }
    commit((prev) => ({ ...prev, pages: prev.pages.filter((_, i) => i !== pageIndex) }));
    setPageIndex((i) => Math.max(0, i - 1));
  }, [commit, clearPage, pageIndex, sketch.pages.length]);

  // ── Keyboard, for the half of clinicians on a laptop ─────────────────────
  useEffect(() => {
    if (disabled) return undefined;
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
        || e.target?.isContentEditable;
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (!mod && e.key.toLowerCase() === 'p') setTool(TOOLS.PEN);
      if (!mod && e.key.toLowerCase() === 'm') setTool(TOOLS.MARKER);
      if (!mod && e.key.toLowerCase() === 'e') setTool(TOOLS.ERASER);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, undo, redo]);

  const pageStrokes = useMemo(
    () => (live ? [...page.strokes, live] : page.strokes),
    [page.strokes, live],
  );

  return {
    sketch, page, pageIndex, pageCount: sketch.pages.length, pageStrokes,
    tool, setTool, color, setColor, size, setSize,
    surfaceRef, onPointerDown, onPointerMove, endStroke,
    undo, redo, canUndo: depth.undo > 0, canRedo: depth.redo > 0,
    clearPage, setBackdrop, addPage, removePage, setPageIndex,
    // Live stroke is drawn with simulated pressure only when the input has none
    // to give; a stylus always wins.
    simulatePressure: !penSeen.current,
  };
}
