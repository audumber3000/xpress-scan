import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLORS, HEIGHT, SIZES, TOOLS, WIDTH, emptySketch, newPage, newStroke,
  normaliseSketch,
} from './sketchModel';
import { strokeHit } from './strokePath';

// How many steps back Undo goes. More than anyone reaches for in one sitting,
// few enough that the stacks never become why a tablet runs short of memory.
const HISTORY_LIMIT = 50;

// The eraser's reach, in logical units. Generous: it is used with a fingertip
// as often as a stylus, and an eraser you have to aim gets abandoned.
const ERASER_RADIUS = 18;

/** The first page whose content differs between two notes, or -1. */
const changedPageIndex = (a, b) => {
  const n = Math.max(a.pages.length, b.pages.length);
  for (let i = 0; i < n; i += 1) {
    if (a.pages[i] !== b.pages[i]) return Math.min(i, b.pages.length - 1);
  }
  return -1;
};

/**
 * Everything a pen note does, apart from drawing it.
 *
 * ─── How state flows, and why it is shaped like this ───────────────────────
 *
 * The note lives in a ref, not only in React state. Every change goes through
 * `apply`, which updates the ref, pushes history, renders and notifies the
 * parent — in that order, synchronously, outside any state updater.
 *
 * Two bugs made that necessary, and both are pinned by useSketchPad.test.jsx:
 *
 *   1. The parent stores what we hand it and passes it back down as `value`.
 *      This hook used to re-seed whenever `value` changed, so our own write
 *      coming back was read as "a different case paper was opened": it jumped
 *      to page 1 and wiped Undo after every single stroke. `value` is now read
 *      ONCE, at mount. A different paper is a different mount — the parent
 *      keys this component — which is the React way to say "start over".
 *
 *   2. History was pushed from inside a setState updater. StrictMode calls
 *      updaters twice, so every change was recorded twice and Undo appeared to
 *      do nothing on every other press.
 *
 * ─── The behaviours that make it usable on a tablet ─────────────────────────
 *
 *   Palm rejection. Once a stylus has touched this surface, touch input stops
 *   drawing, so a hand can rest on the screen as it would on paper. Until then
 *   touch draws normally — on a phone it is the only pointer there is.
 *
 *   Coordinate mapping through the SVG's own transform, so a pen lands where
 *   it touches whatever shape the canvas has been given. Mapping against the
 *   element's box is only correct when the box is exactly 3:2; in full screen
 *   it is not, and the ink drifted away from the nib.
 *
 *   One Undo per eraser sweep, however many strokes it takes.
 */
export function useSketchPad({
  value, onChange, disabled = false, defaultBackdrop = 'adult-chart', shortcuts = true,
}) {
  const initial = useRef(null);
  if (initial.current === null) {
    initial.current = normaliseSketch(value) || emptySketch(defaultBackdrop);
  }

  const noteRef = useRef(initial.current);
  const [note, setNote] = useState(initial.current);

  const [pageIndex, setPageIndexState] = useState(0);
  const pageIndexRef = useRef(0);

  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(SIZES[1].value);
  // Read inside pointer handlers, which must not go stale mid-stroke.
  const toolRef = useRef(tool); toolRef.current = tool;
  const colorRef = useRef(color); colorRef.current = color;
  const sizeRef = useRef(size); sizeRef.current = size;

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const past = useRef([]);
  const future = useRef([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const syncDepth = () => setDepth({ undo: past.current.length, redo: future.current.length });

  const setPageIndex = useCallback((i) => {
    const last = noteRef.current.pages.length - 1;
    const next = Math.max(0, Math.min(last, i));
    pageIndexRef.current = next;
    setPageIndexState(next);
  }, []);

  /** The one door every change goes through. */
  const apply = useCallback((next, { record = true } = {}) => {
    const prev = noteRef.current;
    if (next === prev) return;
    if (record) {
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
      future.current = [];
      syncDepth();
    }
    noteRef.current = next;
    setNote(next);
    // Keep the page in range after a page disappears.
    if (pageIndexRef.current > next.pages.length - 1) setPageIndex(next.pages.length - 1);
    onChangeRef.current?.(next);
  }, [setPageIndex]);

  /** Change the current page. Returns the same note when nothing moved. */
  const withPage = (note, index, mutate) => {
    const page = note.pages[index];
    if (!page) return note;
    const changed = mutate(page);
    if (changed === page) return note;
    return { ...note, pages: note.pages.map((p, i) => (i === index ? changed : p)) };
  };

  // ── The live stroke ─────────────────────────────────────────────────────
  // Held apart from the note, so a sample at 120Hz re-renders one path rather
  // than rewriting the document and redrawing every stroke already on it.
  const [live, setLive] = useState(null);
  const liveRef = useRef(null);
  const drawingId = useRef(null);
  const penSeen = useRef(false);
  const erasing = useRef(null);   // the note as it was when the sweep began
  const ctm = useRef(null);       // screen → page transform, fixed per stroke

  const surfaceRef = useRef(null);

  const toLogical = useCallback((e) => {
    // A stylus reports real pressure. A mouse reports 0.5, and some browsers
    // report 0 for a button that is plainly held — a stroke of no width at all.
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    if (ctm.current) {
      const { a, b, c, d, e: tx, f: ty } = ctm.current;
      return [
        a * e.clientX + c * e.clientY + tx,
        b * e.clientX + d * e.clientY + ty,
        pressure,
      ];
    }
    const box = surfaceRef.current?.getBoundingClientRect?.();
    if (!box || !box.width || !box.height) return null;
    return [
      ((e.clientX - box.left) / box.width) * WIDTH,
      ((e.clientY - box.top) / box.height) * HEIGHT,
      pressure,
    ];
  }, []);

  const eraseAt = useCallback((x, y) => {
    const next = withPage(noteRef.current, pageIndexRef.current, (p) => {
      const kept = p.strokes.filter((s) => !strokeHit(s, x, y, ERASER_RADIUS));
      return kept.length === p.strokes.length ? p : { ...p, strokes: kept };
    });
    // Unrecorded: the whole sweep becomes one step when the pen lifts.
    apply(next, { record: false });
  }, [apply]);

  const onPointerDown = useCallback((e) => {
    if (disabled || drawingId.current !== null) return;
    if (e.pointerType === 'pen') penSeen.current = true;
    if (e.pointerType === 'touch' && penSeen.current) return;   // the palm
    if (e.button !== undefined && e.button > 0 && e.button !== 5) return; // right click

    // The SVG's own transform, inverted once for the whole stroke. Correct for
    // any size the canvas is given; refetching it per sample would be waste.
    const svg = surfaceRef.current;
    const screen = typeof svg?.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    ctm.current = screen ? screen.inverse() : null;

    const at = toLogical(e);
    if (!at) return;
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    drawingId.current = e.pointerId;

    // The eraser tool, a stylus barrel button, or the far end of a pencil.
    if (toolRef.current === TOOLS.ERASER || e.button === 5 || e.buttons === 32) {
      erasing.current = noteRef.current;
      eraseAt(at[0], at[1]);
      return;
    }

    const started = newStroke({
      tool: toolRef.current,
      color: colorRef.current,
      size: sizeRef.current,
      // Whether this pointer has pressure of its own. Stored per stroke, so the
      // note renders the same on another device and in the PDF.
      sim: e.pointerType !== 'pen',
      points: [at],
    });
    liveRef.current = started;
    setLive(started);
  }, [disabled, toLogical, eraseAt]);

  const onPointerMove = useCallback((e) => {
    if (disabled || drawingId.current !== e.pointerId) return;

    // Every position the browser coalesced while the main thread was busy.
    // Without them a quick circle on a 120Hz tablet comes out a pentagon.
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const added = (samples.length ? samples : [e]).map(toLogical).filter(Boolean);
    if (!added.length) return;

    if (erasing.current) {
      added.forEach(([x, y]) => eraseAt(x, y));
      return;
    }
    if (!liveRef.current) return;
    liveRef.current = { ...liveRef.current, points: [...liveRef.current.points, ...added] };
    setLive(liveRef.current);
  }, [disabled, toLogical, eraseAt]);

  const endStroke = useCallback((e) => {
    if (drawingId.current === null || (e && drawingId.current !== e.pointerId)) return;
    drawingId.current = null;
    ctm.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }

    if (erasing.current) {
      const before = erasing.current;
      erasing.current = null;
      // One step for the whole sweep — and none if it touched nothing.
      if (noteRef.current !== before) {
        past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), before];
        future.current = [];
        syncDepth();
      }
      return;
    }

    const finished = liveRef.current;
    liveRef.current = null;
    setLive(null);
    // A tap is a dot, and a dot is a mark somebody meant.
    if (finished?.points.length) {
      apply(withPage(noteRef.current, pageIndexRef.current,
        (p) => ({ ...p, strokes: [...p.strokes, finished] })));
    }
  }, [apply]);

  // A safety net under pointer capture. Some browsers decline capture on an
  // SVG, and then a pen lifted outside the canvas never tells it the stroke is
  // over — leaving a stroke that follows the next touch from wherever it was.
  useEffect(() => {
    const finish = (e) => { if (drawingId.current === e.pointerId) endStroke(e); };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [endStroke]);

  // ── History ─────────────────────────────────────────────────────────────
  const step = useCallback((from, to) => {
    const target = from.current.pop();
    if (!target) return;
    const current = noteRef.current;
    to.current = [...to.current.slice(-(HISTORY_LIMIT - 1)), current];
    syncDepth();
    noteRef.current = target;
    setNote(target);
    // Show the page that changed. Undoing a stroke on page 3 while looking at
    // page 1 would otherwise look like Undo did nothing.
    const where = changedPageIndex(current, target);
    setPageIndex(where >= 0 ? where : pageIndexRef.current);
    onChangeRef.current?.(target);
  }, [setPageIndex]);

  const undo = useCallback(() => step(past, future), [step]);
  const redo = useCallback(() => step(future, past), [step]);

  // ── Pages ───────────────────────────────────────────────────────────────
  const clearPage = useCallback(() => {
    apply(withPage(noteRef.current, pageIndexRef.current,
      (p) => (p.strokes.length ? { ...p, strokes: [] } : p)));
  }, [apply]);

  const setBackdrop = useCallback((backdrop) => {
    apply(withPage(noteRef.current, pageIndexRef.current,
      (p) => (p.backdrop === backdrop ? p : { ...p, backdrop })));
  }, [apply]);

  const addPage = useCallback(() => {
    const current = noteRef.current;
    const from = current.pages[pageIndexRef.current];
    // A new page carries on the same paper — somebody working on the arch who
    // needs more room wants more arch.
    apply({ ...current, pages: [...current.pages, newPage(from?.backdrop)] });
    setPageIndex(current.pages.length);
  }, [apply, setPageIndex]);

  const removePage = useCallback(() => {
    const current = noteRef.current;
    if (current.pages.length <= 1) { clearPage(); return; }
    const at = pageIndexRef.current;
    apply({ ...current, pages: current.pages.filter((_, i) => i !== at) });
    setPageIndex(Math.max(0, at - 1));
  }, [apply, clearPage, setPageIndex]);

  // ── Keyboard, for the clinicians on a laptop ────────────────────────────
  // Only while the pad is on screen. Listening whenever the case paper was open
  // meant Ctrl+Z anywhere on the paper undid a drawing hidden in a collapsed
  // panel — an edit the clinician could neither see nor had asked for.
  useEffect(() => {
    if (disabled || !shortcuts) return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName) || t?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod || e.altKey) return;
      if (k === 'p') setTool(TOOLS.PEN);
      if (k === 'm') setTool(TOOLS.MARKER);
      if (k === 'e') setTool(TOOLS.ERASER);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, shortcuts, undo, redo]);

  const safeIndex = Math.min(pageIndex, note.pages.length - 1);
  const page = note.pages[safeIndex];

  return {
    sketch: note, page, pageIndex: safeIndex, pageCount: note.pages.length,
    pages: note.pages, live,
    tool, setTool, color, setColor, size, setSize,
    surfaceRef, onPointerDown, onPointerMove, endStroke,
    undo, redo, canUndo: depth.undo > 0, canRedo: depth.redo > 0,
    clearPage, setBackdrop, addPage, removePage, setPageIndex,
  };
}
