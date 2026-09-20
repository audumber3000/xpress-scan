/**
 * Single source of truth for dashboard chart styling.
 *
 * ─── Why the palette changed ──────────────────────────────────────────────
 *
 * The previous set (brand navy #2a276e, lavender #9B8CFF, green #22c55e,
 * amber #f59e0b, red #ef4444) failed three checks when it was actually
 * measured against the white card surface:
 *
 *   lightness   #2a276e sits at L 0.323, well below the band a data color can
 *               occupy. It is an ink color, and it was doing a fill's job.
 *   CVD         #f59e0b against #22c55e is dE 5.7 under protanopia (target 8).
 *               A red-green colorblind dentist could not tell "completed" from
 *               "billed".
 *   contrast    lavender 2.77, green 2.28, amber 2.15 against white — all
 *               under the 3:1 a mark needs to be seen at all.
 *
 * There was also a category error: COLORS.warning, a status token, was
 * carrying the "Billed" series. So amber meant "needs attention" on the
 * calendar and "invoiced" in the chart beside it, and neither reading was
 * safe.
 *
 * The two sets below are separated by *job* and each one passes every check on
 * white. Do not mix them: SERIES is identity, STATUS is state.
 */

/**
 * Identity. Two tints of one hue, for the "this measure against its context"
 * shape nearly every chart here has (collected against billed, actual against
 * target, done against booked).
 *
 * Validated: dE 19.1 protan, both >= 3:1 on #ffffff.
 */
export const SERIES = {
  strong: '#4b45b5',  // the measure that matters
  soft:   '#8b86dd',  // the context it is read against
};

/**
 * State. Only ever used where the color *means* good / attention / bad, and
 * always with a label or icon beside it, never as the sole channel.
 *
 * Validated against SERIES.strong: dE 8.0 deutan, all >= 3:1 on #ffffff.
 */
export const STATUS = {
  good: '#2f9e6e',
  warn: '#b45309',
  bad:  '#c23b3b',
};

/**
 * Ordinal ramp: one hue, light to dark. For magnitude on a grid (the chair-load
 * heatmap, the calendar) and for genuinely ordered categories (receivable age
 * bands, where older is worse).
 *
 * Never use this on nominal categories. Shading treatments darker-where-bigger
 * would double-encode the bar length as hue and spend the only free channel on
 * information the bar already carries.
 *
 * ─── Why the light end is not paler ──────────────────────────────────────
 *
 * The first draft of this ramp opened at #eeedf9, which is 1.16:1 against a
 * white card — a step that carries data and is, in practice, invisible. A
 * quiet-but-not-empty Tuesday rendered as blank card. The lightest *data* step
 * now clears 2:1, so the difference between "nobody came" and "two people
 * came" is a difference you can actually see.
 *
 * RAMP_EMPTY is separate and deliberately near-surface: it is not a step on
 * the scale, it is the absence of one. An empty day should look empty.
 *
 * Validated as an ordinal ramp on white: monotone lightness, every adjacent
 * gap over the floor, light end 2.33:1, hue spread 9°.
 */
export const RAMP_EMPTY = '#f4f3fb';
export const RAMP = ['#a9a3e0', '#8b84d4', '#6c64c2', '#4b45b5'];

/**
 * Which step `value` lands on within [0, max]. -1 means empty, which is a
 * distinct answer from "the lowest step" and the two must not be conflated:
 * one is no data, the other is a small amount of it.
 */
export const rampIndex = (value, max) => {
  if (!value || value <= 0 || !max) return -1;
  return Math.min(RAMP.length - 1, Math.max(0, Math.ceil((value / max) * RAMP.length) - 1));
};

export const rampFill = (value, max) => {
  const i = rampIndex(value, max);
  return i < 0 ? RAMP_EMPTY : RAMP[i];
};

/**
 * Text colour for a label sitting on a ramp step — the one place a label is
 * allowed to be something other than a text token, because it has a coloured
 * fill under it rather than the surface.
 *
 * Both sides clear 4.5:1: ink reads 7.6 and 5.4 on the two light steps, white
 * reads 5.0 and 7.5 on the two dark ones. Flipping one step either way would
 * put a number below AA on its own background.
 */
export const RAMP_INK_FLIP = 2;
export const rampInk = (index) => (index >= RAMP_INK_FLIP ? '#ffffff' : '#111827');

/** Text tokens. Labels, values and axis ticks wear these, never a series color. */
export const INK = {
  primary:   '#111827',
  secondary: '#4b5563',
  muted:     '#9ca3af',
};

export const SURFACE = '#ffffff';
export const GRID = '#eceef2';  // one step off the surface, and no more

/**
 * The gap that separates touching marks.
 *
 * White doing the separating, not a stroke around each mark. Recharts has no
 * gap primitive, so a 2px stroke in the surface color is how it is spelled —
 * which looks like a border and is not one: it is the surface showing through.
 */
export const SURFACE_GAP = 2;
export const stackGap = { stroke: SURFACE, strokeWidth: SURFACE_GAP };

// Cap, not a width. Recharts will happily fill the whole band; 24px is the
// point past which a column stops being a mark and becomes a block, and the
// leftover band is meant to be air.
export const BAR_MAX = 24;
export const BAR_RADIUS = [4, 4, 0, 0];

/**
 * Per-breakpoint chart geometry. A chart that keeps desktop proportions on a
 * phone doesn't shrink gracefully — the bars go hairline-thin and the value
 * labels collide — so each width gets its own numbers rather than one set that
 * scales. `bp` comes from useBreakpoint().
 *
 * `maxBuckets` trims the x-axis instead of squashing it: on a phone you see the
 * most recent 6 buckets at a readable width, not 24 at 4px each.
 */
export const CHART_GEOMETRY = {
  mobile:  { height: 180, barSize: 16, groupGap: 3, labels: false, maxBuckets: 6 },
  tablet:  { height: 210, barSize: 20, groupGap: 4, labels: true,  maxBuckets: 12 },
  desktop: { height: 240, barSize: 24, groupGap: 5, labels: true,  maxBuckets: 24 },
};

export const geometryFor = (bp) => CHART_GEOMETRY[bp] || CHART_GEOMETRY.desktop;

// Keep the most recent N buckets. Charts read left-to-right oldest-to-newest,
// so the tail is the part worth keeping when space runs out.
export const trimBuckets = (data, max) =>
  Array.isArray(data) && data.length > max ? data.slice(-max) : (data || []);

// Solid hairline, never dashed. A dashed rule reads as a projection or a
// threshold, and this is neither — it is the grid.
export const GRID_PROPS = {
  stroke: GRID,
  strokeDasharray: '0',
  vertical: false,
};

export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fontWeight: 500, fill: INK.muted },
};

// left stays at 0. It used to be -18 to claw back space from recharts' default
// 60px axis gutter, but the charts now set an explicit YAxis `width`, and a
// negative margin on top of that shifts the tick labels out of the plot area
// and clips their leading digits — "25" renders as "5".
export const CHART_MARGIN = { left: 0, right: 8, top: 8, bottom: 0 };
