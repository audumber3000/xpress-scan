import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PenLine, ChevronDown, ChevronUp, Maximize2, Minimize2, Lock, FileDown, Loader2, Check,
} from 'lucide-react';
import { universalToFDI } from '../../../utils/toothNumbering';
import { useIsDentalPatient } from '../../../utils/casePaper';
import SketchSurface from './SketchSurface';
import SketchToolbar from './SketchToolbar';
import SketchPages from './SketchPages';
import { useSketchPad } from './useSketchPad';
import { BACKDROPS, HEIGHT, TOOLS, WIDTH, strokeCount } from './sketchModel';

// A dental record gets the arch; everybody else gets paper. A skin clinic
// opening a pen note onto a tooth chart is a screen that was not built for it.
const TOOTH_BACKDROPS = new Set(['adult-chart', 'child-chart']);

/** Which paper a new note starts on, for this patient. */
const startingPaper = (isDental, patient) => {
  if (!isDental) return 'blank';
  // A full primary dentition until about six. Older children have permanent
  // molars and incisors coming in, and the adult arch is the closer drawing.
  const age = Number(patient?.age);
  return Number.isFinite(age) && age > 0 && age < 6 ? 'child-chart' : 'adult-chart';
};

/**
 * Pen notes for one visit.
 *
 * What this is for, in the clinician's words: "let me show you which tooth".
 * That conversation happens with a tablet turned to face the patient, and until
 * now it happened on the back of an envelope — so the explanation that got a
 * treatment plan accepted was never part of the record.
 *
 * Saves with the case paper, on the case paper's own date. The HOST keys this
 * component per case paper: a different paper is a fresh mount, which is how
 * the pad knows the value it was given is a new document and not its own write
 * coming back (see useSketchPad).
 *
 * Always starts collapsed, drawn on or not — the same rule as every section in
 * Control Center. A canvas that opens itself pushes the rest of the case paper
 * below the fold. What is on it is still visible without opening it: the header
 * carries the first page as a thumbnail and says how much is drawn.
 */

/**
 * The largest 3:2 page that fits the room it is given.
 *
 * CSS `aspect-ratio` cannot do "fit inside" when both dimensions are
 * constrained — the page either overflows the screen or letterboxes inside
 * a box that is still the wrong shape. So it is measured.
 */
const FitPage = ({ children }) => {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = WIDTH / HEIGHT;
      const w = Math.min(width, height * ratio);
      setSize({ w: Math.floor(w), h: Math.floor(w / ratio) });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => { ro?.disconnect(); window.removeEventListener('orientationchange', measure); };
  }, []);

  return (
    <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center">
      {size.w > 0 && (
        <div
          className="overflow-hidden rounded-xl border border-gray-300 bg-white"
          style={{ width: size.w, height: size.h }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/** Every page as standalone SVG markup, for the server to build a PDF from. */
const pagesAsSvg = async (pages, toothLabel) => {
  // Loaded on demand: the server renderer is only needed at the moment of
  // export, and it has no business in the bundle every visit loads.
  const { renderToStaticMarkup } = await import('react-dom/server');
  return pages.map((p) => renderToStaticMarkup(
    <SketchSurface page={p} readOnly toothLabel={toothLabel} />,
  ));
};

const ExportButton = ({ onClick, state }) => {
  const busy = state === 'busy';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Download these notes as a PDF and file them under Documents"
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
    >
      {busy ? <Loader2 size={15} className="animate-spin" />
        : state === 'done' ? <Check size={15} className="text-emerald-600" />
          : <FileDown size={15} />}
      {busy ? 'Preparing…' : state === 'done' ? 'Saved' : 'Save as PDF'}
    </button>
  );
};

const VisitSketchPad = ({
  value, onChange, patient, disabled = false, blockedReason = '', onExport,
}) => {
  const isDental = useIsDentalPatient(patient);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  // idle → busy → done | error. Said at the control, not in a toast: the
  // clinician is looking at the button they just pressed.
  const [exportState, setExportState] = useState('idle');
  const [exportMessage, setExportMessage] = useState('');

  const pad = useSketchPad({
    value, onChange, disabled,
    defaultBackdrop: startingPaper(isDental, patient),
    // Keyboard shortcuts only while the pad can be seen — see useSketchPad.
    shortcuts: open || full,
  });
  const backdrops = useMemo(
    () => (isDental ? BACKDROPS : BACKDROPS.filter((b) => !TOOTH_BACKDROPS.has(b.key))),
    [isDental],
  );

  // FDI, the same as the tooth drawer and the treatment plan: the tooth a
  // doctor circles here is the tooth the chart two tabs away calls it.
  const toothLabel = useCallback((n) => universalToFDI(n), []);

  const count = useMemo(() => strokeCount(pad.sketch), [pad.sketch]);
  // Says what is there, and only offers to draw to somebody who can.
  const summary = count > 0
    ? `${pad.pageCount} page${pad.pageCount === 1 ? '' : 's'} · ${count} mark${count === 1 ? '' : 's'}`
    : disabled ? 'Nothing drawn for this visit'
      : isDental ? 'Draw on a tooth chart to explain the plan' : 'Sketch a note for this visit';
  const firstDrawn = pad.pages.find((p) => p.strokes.length > 0);

  // ── Full screen ─────────────────────────────────────────────────────────
  // The overlay is the full screen. The browser's own full-screen mode is
  // asked for on top, where it exists, so a tablet loses its address bar too —
  // and if the clinician leaves that with the system gesture, the overlay
  // leaves with it rather than stranding them in half a mode.
  const enterFull = () => {
    setFull(true);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => { /* refused or unsupported: overlay alone is fine */ });
    }
  };
  const exitFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!full) return undefined;
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e) => { if (e.key === 'Escape') exitFull(); };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll when a palm drags across the overlay.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [full, exitFull]);

  // ── Export ──────────────────────────────────────────────────────────────
  const doneTimer = useRef(null);
  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const handleExport = async () => {
    if (!onExport) return;
    if (count === 0) {
      setExportState('error');
      setExportMessage('Nothing is drawn yet, so there is nothing to export.');
      return;
    }
    setExportState('busy');
    setExportMessage('');
    try {
      // Only pages with something on them. A blank page in a clinical PDF is
      // a sheet somebody has to wonder about.
      const drawn = pad.pages.filter((p) => p.strokes.length > 0);
      const svgs = await pagesAsSvg(drawn, toothLabel);
      const result = await onExport(svgs);
      setExportState('done');
      setExportMessage(result?.saved === false
        ? 'Downloaded, but it could not be filed under Documents. Try again, or upload the PDF there yourself.'
        : 'Downloaded, and filed under Documents.');
      clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setExportState('idle'), 4000);
    } catch (err) {
      setExportState('error');
      setExportMessage(err?.message || 'The PDF could not be made. Please try again.');
    }
  };

  const exportButton = onExport && !disabled
    ? <ExportButton onClick={handleExport} state={exportState} />
    : null;

  const surface = (
    <SketchSurface
      page={pad.page}
      live={pad.live}
      toothLabel={toothLabel}
      disabled={disabled}
      cursor={pad.tool === TOOLS.ERASER ? 'cell' : 'crosshair'}
      surfaceRef={pad.surfaceRef}
      onPointerDown={pad.onPointerDown}
      onPointerMove={pad.onPointerMove}
      endStroke={pad.endStroke}
    />
  );

  const pages = (
    <SketchPages
      pages={pad.pages}
      pageIndex={pad.pageIndex}
      setPageIndex={pad.setPageIndex}
      addPage={pad.addPage}
      removePage={pad.removePage}
      toothLabel={toothLabel}
      disabled={disabled}
      compact={!full}
    />
  );

  const exportNote = exportMessage && (
    <p className={`text-xs leading-snug ${exportState === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
      {exportMessage}
    </p>
  );

  if (full) {
    return (
      <div
        className="fixed inset-0 z-[95] flex flex-col gap-3 bg-gray-100 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Pen notes, full screen"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <PenLine size={17} className="shrink-0 text-[#2a276e]" />
            <h3 className="truncate text-sm font-bold text-gray-900">
              Pen notes{patient?.name ? ` · ${patient.name}` : ''}
            </h3>
            <span className="hidden text-xs text-gray-500 sm:inline">
              Page {pad.pageIndex + 1} of {pad.pageCount}
            </span>
          </div>
          {exportButton}
          <button
            type="button"
            onClick={exitFull}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2a276e] px-4 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#1a1548] active:scale-[0.97]"
          >
            <Minimize2 size={15} /> Done
          </button>
        </div>

        {!disabled && <SketchToolbar {...pad} backdrops={backdrops} />}
        {exportNote}
        <FitPage>{surface}</FitPage>
        <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-2 py-1.5">{pages}</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {firstDrawn && !open ? (
            <span
              className="relative h-10 w-[60px] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white"
              aria-hidden="true"
            >
              <SketchSurface page={firstDrawn} readOnly toothLabel={toothLabel} />
            </span>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e]">
              <PenLine size={17} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Pen notes</span>
            <span className="block truncate text-xs text-gray-500">{summary}</span>
          </span>
        </button>

        {!disabled && (
          <button
            type="button"
            onClick={() => { setOpen(true); enterFull(); }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Maximize2 size={14} />
            <span className="hidden sm:inline">Full screen</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Hide pen notes' : 'Show pen notes'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-gray-100 p-4">
          {disabled && blockedReason && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              <Lock size={13} className="mt-px shrink-0 text-amber-600" />
              {blockedReason}
            </p>
          )}
          {!disabled && <SketchToolbar {...pad} backdrops={backdrops} trailing={exportButton} />}
          {exportNote}
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white" style={{ aspectRatio: '3 / 2' }}>
            {surface}
          </div>
          {pages}
          {!disabled && (
            <p className="text-[11px] leading-snug text-gray-400">
              Draw with a stylus or a finger. Once a pen has touched the screen, resting
              your hand on it stops drawing, so you can write as you would on paper.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VisitSketchPad;
