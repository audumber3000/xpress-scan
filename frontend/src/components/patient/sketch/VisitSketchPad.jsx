import React, { useCallback, useMemo, useState } from 'react';
import { PenLine, ChevronDown, ChevronUp, Maximize2, Minimize2, Lock } from 'lucide-react';
import { universalToFDI } from '../../../utils/toothNumbering';
import { useIsDentalPatient } from '../../../utils/casePaper';
import SketchSurface from './SketchSurface';
import SketchToolbar from './SketchToolbar';
import { useSketchPad } from './useSketchPad';
import { TOOLS, isSketchEmpty, strokeCount } from './sketchModel';

/**
 * Pen notes for one visit.
 *
 * What this is for, in the clinician's words: "let me show you which tooth".
 * That conversation happens with a tablet turned around to face the patient,
 * and until now the only way to have it was to draw on the back of an envelope
 * — so the explanation that persuaded somebody to accept a treatment plan was
 * never part of their record.
 *
 * It saves with the case paper, on the case paper's own date, so a note drawn
 * while back-entering a visit from June belongs to June.
 *
 * ─── Why it is collapsed by default ──────────────────────────────────────────
 *
 * Most visits are not drawn on, and a canvas the height of the screen sitting
 * open above the clinical notes would push the rest of the case paper below the
 * fold for every visit that never needed it. Once there is ink on it, it opens
 * with the paper — because then it is part of the record and hiding it would be
 * hiding clinical content.
 */

const VisitSketchPad = ({ value, onChange, patient, disabled = false, blockedReason = '' }) => {
  const isDental = useIsDentalPatient(patient);

  // Opened when there is something to see. `useState` initialiser, not an
  // effect: an effect would flash the collapsed state first on every paper that
  // has a drawing, which reads as the note having been lost.
  const [open, setOpen] = useState(() => !isSketchEmpty(value));
  const [full, setFull] = useState(false);

  const pad = useSketchPad({ value, onChange, disabled });

  // FDI, the same as the tooth drawer and the treatment plan. Stored Universal
  // and displayed FDI everywhere in this app, so the tooth a doctor circles on
  // the diagram is the tooth the chart two tabs away calls it.
  const toothLabel = useCallback((n) => universalToFDI(n), []);

  const cursor = pad.tool === TOOLS.ERASER ? 'cell' : 'crosshair';
  const count = useMemo(() => strokeCount(pad.sketch), [pad.sketch]);

  // A dermatology or general clinic has no tooth chart, so it opens on a plain
  // page instead of an arch nobody there will draw on.
  const summary = count > 0
    ? `${pad.pageCount} page${pad.pageCount === 1 ? '' : 's'} · ${count} mark${count === 1 ? '' : 's'}`
    : isDental
      ? 'Draw on a tooth chart to explain the plan'
      : 'Sketch a note for this visit';

  const body = (
    <div className={full ? 'flex h-full flex-col gap-3' : 'space-y-3'}>
      {!disabled && <SketchToolbar {...pad} />}
      <div
        className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${
          full ? 'min-h-0 flex-1' : ''
        }`}
        style={full ? undefined : { aspectRatio: '3 / 2' }}
      >
        <SketchSurface
          page={pad.page}
          strokes={pad.pageStrokes}
          simulatePressure={pad.simulatePressure}
          toothLabel={toothLabel}
          disabled={disabled}
          cursor={cursor}
          surfaceRef={pad.surfaceRef}
          onPointerDown={pad.onPointerDown}
          onPointerMove={pad.onPointerMove}
          endStroke={pad.endStroke}
        />
      </div>
      {!disabled && (
        <p className="text-[11px] leading-snug text-gray-400">
          Draw with a stylus or a finger. Once you have used a pen on this screen,
          resting your hand on it stops drawing, so you can write as you would on paper.
        </p>
      )}
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-[95] flex flex-col gap-3 bg-[#f8fafc] p-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <PenLine size={17} className="shrink-0 text-[#2a276e]" />
            <h3 className="truncate text-sm font-bold text-gray-900">
              Pen notes{patient?.name ? ` — ${patient.name}` : ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setFull(false)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Minimize2 size={15} /> Done
          </button>
        </div>
        {body}
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a276e]/[0.07] text-[#2a276e]">
            <PenLine size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">Pen notes</span>
            <span className="block truncate text-xs text-gray-500">{summary}</span>
          </span>
        </button>

        {open && !disabled && (
          <button
            type="button"
            onClick={() => setFull(true)}
            title="Fill the screen"
            aria-label="Fill the screen"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
          >
            <Maximize2 size={15} />
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
        <div className="border-t border-gray-100 p-4">
          {disabled && blockedReason && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              <Lock size={13} className="mt-px shrink-0 text-amber-600" />
              {blockedReason}
            </p>
          )}
          {body}
        </div>
      )}
    </div>
  );
};

export default VisitSketchPad;
