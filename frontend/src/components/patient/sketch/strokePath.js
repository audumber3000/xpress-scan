import { getStroke } from 'perfect-freehand';
import { TOOLS } from './sketchModel';

/**
 * A list of pointer samples turned into the outline of a real pen stroke.
 *
 * `perfect-freehand` is the geometry, not the UI: it takes the points and gives
 * back the OUTLINE of the ink, so the result is a filled shape that thickens
 * where the pen pressed and tapers where it lifted. Drawing a polyline with a
 * stroke-width instead is what makes digital handwriting look like a wire — it
 * has no weight, and a dentist circling a tooth on a tablet can tell instantly.
 *
 * Chosen over a whiteboard framework on purpose: four kilobytes, no
 * dependencies, MIT, and no opinion about our UI. It is the same engine tldraw
 * uses, so the ink quality is not a compromise for the size.
 */

// Two feels, one engine.
//
// A pen responds to pressure and tapers at both ends, which is what makes it
// read as handwriting. A marker deliberately does not: a highlighter has a felt
// tip of constant width, and simulating pressure on one makes it look like a
// leaking pen rather than a highlight.
const OPTIONS = {
  [TOOLS.PEN]: {
    thinning: 0.6,
    smoothing: 0.55,
    streamline: 0.45,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    start: { taper: 0, cap: true },
    end: { taper: 12, cap: true },
  },
  [TOOLS.MARKER]: {
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.4,
    easing: (t) => t,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  },
};

/**
 * `simulatePressure` is the difference between a mouse and a pencil.
 *
 * A stylus reports real pressure and we use it. A mouse and a finger always
 * report 0.5 (or 0, which is worse), and a stroke of exactly uniform width is
 * the dead-wire look again — so for those the library infers pressure from how
 * fast the pointer moved, which is a very good approximation of how hard
 * somebody would have pressed.
 *
 * Read off the stroke (`sim`), which is where the pad records what kind of
 * pointer drew it, so the same note renders identically everywhere.
 */
export const strokeOutline = (stroke) =>
  getStroke(stroke.points, {
    size: stroke.size,
    simulatePressure: stroke.sim !== false,
    ...(OPTIONS[stroke.tool] || OPTIONS[TOOLS.PEN]),
  });

// Computed paths, per stroke object. A committed stroke never changes — every
// edit produces a new object — so its outline is worked out once. Without this
// each pen sample re-ran the geometry for every stroke already on the page,
// and a busy page lagged behind the nib.
const pathCache = new WeakMap();

/** The outline as an SVG path. Empty string for a stroke with nothing in it. */
export const strokeToPath = (stroke) => {
  const cached = pathCache.get(stroke);
  if (cached !== undefined) return cached;
  const d = buildPath(stroke);
  pathCache.set(stroke, d);
  return d;
};

const buildPath = (stroke) => {
  const outline = strokeOutline(stroke);
  if (!outline.length) return '';

  // Quadratic segments through the midpoints — the shape is a closed polygon
  // and joining its corners with curves is what stops the edge of the ink from
  // looking faceted at high zoom or on a printed page.
  let d = `M ${outline[0][0].toFixed(2)} ${outline[0][1].toFixed(2)}`;
  for (let i = 0; i < outline.length; i += 1) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
  }
  return `${d} Z`;
};

/** A marker lays down translucent ink; a pen does not. */
export const strokeOpacity = (stroke) => (stroke.tool === TOOLS.MARKER ? 0.35 : 1);

/**
 * Is this stroke within `radius` of (x, y)?
 *
 * The eraser works on whole strokes rather than on pixels, which is the right
 * model for a clinical note: a doctor wants the line they just drew gone, not a
 * bite taken out of it. Point-sampling the stroke is enough — samples are dense
 * relative to any sensible eraser radius, and a cheap test that runs on every
 * pointer move beats an exact one that stutters.
 */
export const strokeHit = (stroke, x, y, radius) => {
  const r2 = radius * radius;
  for (let i = 0; i < stroke.points.length; i += 1) {
    const dx = stroke.points[i][0] - x;
    const dy = stroke.points[i][1] - y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
};
