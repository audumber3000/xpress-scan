/**
 * What a pen note is, once it is written down.
 *
 * Stored as VECTORS, not as a picture. A dentist sketching on a tooth diagram to
 * explain a plan produces a few dozen strokes; as JSON that is a couple of
 * kilobytes, it stays sharp on a 4K screen and on paper, and it can be reopened
 * and added to at the next visit. The same drawing as a PNG is two hundred
 * kilobytes of pixels that blur when printed and can never be edited again.
 *
 * Every coordinate is in a fixed logical space (WIDTH × HEIGHT below), never in
 * screen pixels. The canvas scales that space to whatever room it has, so the
 * same note drawn on a phone and on a 13" tablet is the same note — which is
 * the whole point of storing it at all.
 *
 *   {
 *     v: 1,
 *     pages: [{
 *       id, backdrop: 'adult-chart' | 'child-chart' | 'grid' | 'blank',
 *       strokes: [{ id, tool: 'pen'|'marker', color, size, points: [[x,y,pressure], …] }],
 *     }],
 *   }
 *
 * `v` is there so a later shape change can be migrated rather than guessed at.
 * Nothing reads it yet, and that is fine — the cost of adding it now is one
 * integer, and the cost of not having it is every old note being unreadable.
 */

export const SKETCH_VERSION = 1;

// The logical page. 3:2 landscape, which is the shape a tablet is held in and
// close enough to a sheet of A4 in landscape that printing does not letterbox.
export const WIDTH = 1200;
export const HEIGHT = 800;

export const TOOLS = { PEN: 'pen', MARKER: 'marker', ERASER: 'eraser' };

// Ink. Six, not a colour wheel: a clinician picking a colour mid-sentence wants
// to point at one, and every extra swatch is a decision that is not about the
// patient. Dark first — it is what almost everything is drawn in.
export const COLORS = [
  { value: '#1f2937', label: 'Ink' },
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#059669', label: 'Green' },
  { value: '#d97706', label: 'Amber' },
  { value: '#7c3aed', label: 'Violet' },
];

// Nib sizes in logical units. Three is enough to mean "fine", "normal", "bold".
export const SIZES = [
  { value: 4, label: 'Fine' },
  { value: 8, label: 'Medium' },
  { value: 16, label: 'Bold' },
];

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1).toString(36)}`;

export const newStroke = (attrs) => ({ id: nextId('s'), points: [], ...attrs });

export const newPage = (backdrop = 'adult-chart') => ({
  id: nextId('p'),
  backdrop,
  strokes: [],
});

export const emptySketch = (backdrop) => ({
  v: SKETCH_VERSION,
  pages: [newPage(backdrop)],
});

/**
 * Whatever was stored, as something safe to render.
 *
 * Deliberately forgiving. This column is written by a browser and read by a PDF
 * renderer; a note that fails to parse must show as an empty page, never as a
 * crash in the middle of a patient's clinical record.
 */
export const normaliseSketch = (raw) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.pages)) return null;
  const pages = raw.pages
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : nextId('p'),
      backdrop: typeof p.backdrop === 'string' ? p.backdrop : 'blank',
      strokes: (Array.isArray(p.strokes) ? p.strokes : [])
        .filter((s) => s && Array.isArray(s.points) && s.points.length > 0)
        .map((s) => ({
          id: typeof s.id === 'string' ? s.id : nextId('s'),
          tool: s.tool === TOOLS.MARKER ? TOOLS.MARKER : TOOLS.PEN,
          color: typeof s.color === 'string' ? s.color : COLORS[0].value,
          size: Number.isFinite(s.size) ? s.size : SIZES[1].value,
          points: s.points
            .filter((pt) => Array.isArray(pt) && pt.length >= 2)
            .map(([x, y, pressure]) => [
              Number(x) || 0,
              Number(y) || 0,
              Number.isFinite(pressure) ? pressure : 0.5,
            ]),
        })),
    }));
  return pages.length ? { v: SKETCH_VERSION, pages } : null;
};

/** True when there is nothing drawn anywhere — so nothing is stored. */
export const isSketchEmpty = (sketch) =>
  !sketch || !Array.isArray(sketch.pages)
  || sketch.pages.every((p) => !p.strokes || p.strokes.length === 0);

/** How many strokes across the whole note, for the "2 pages · 34 strokes" line. */
export const strokeCount = (sketch) =>
  (sketch?.pages || []).reduce((n, p) => n + (p.strokes?.length || 0), 0);

// The papers a page can be drawn on. Data, not a component, so the toolbar can
// list them without importing the artwork that draws them.
export const BACKDROPS = [
  { key: 'adult-chart', label: 'Adult teeth' },
  { key: 'child-chart', label: 'Child teeth' },
  { key: 'grid', label: 'Grid' },
  { key: 'ruled', label: 'Lined' },
  { key: 'blank', label: 'Blank' },
];
