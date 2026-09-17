import React from 'react';
import { WIDTH, HEIGHT } from './sketchModel';

/**
 * What the clinician draws ON.
 *
 * A blank page is fine for a note. It is the wrong surface for "let me show you
 * which tooth" — that conversation starts by pointing at a mouth, and a dentist
 * who has to draw the arch before they can circle a molar will stop using the
 * feature by the third patient.
 *
 * So the diagrams are part of the page, not something to be drawn. They are
 * rendered beneath the ink from the same tooth numbering the rest of the app
 * uses, in FDI or Universal depending on the clinic's setting, so the tooth the
 * doctor circles is the tooth the chart calls it.
 *
 * Deliberately pale. This is paper, not content: strong artwork competes with
 * the ink on top of it and photographs badly when the patient takes a picture
 * of the screen, which they do.
 */

const LINE = '#e2e8f0';
const TOOTH_FILL = '#fbfbfa';
const TOOTH_LINE = '#cbd5e1';
const LABEL = '#94a3b8';

// ── Laying teeth along an arch ──────────────────────────────────────────────
//
// Teeth are spaced by DISTANCE along the curve, not by angle. Equal angles
// bunch up at the ends of an ellipse, where the curve turns vertical — which
// stacked the three molars on each side on top of one another and hid their
// numbers. Spacing by arc length, with each tooth sized like the real thing and
// turned to follow the curve, is what makes it read as a mouth.
//
// Drawn as paths with the corners computed here rather than with a
// `transform`: the PDF export rebuilds this SVG from an allowlist, and keeping
// that list free of transforms keeps it small.

// Relative crown widths, patient's right to left. Molars are wide, laterals
// narrow; the numbers are proportions of real mesiodistal widths, not mm.
const ADULT_WIDTHS = [10, 10, 10, 7, 7, 7.5, 6.5, 8.5, 8.5, 6.5, 7.5, 7, 7, 10, 10, 10];
const CHILD_WIDTHS = [8, 7.5, 6, 5.5, 6.5, 6.5, 5.5, 6, 7.5, 8];

const f = (n) => n.toFixed(1);

/** Points along the arch with their running length, for arc-length lookup. */
const sampleArch = ({ cx, cy, rx, ry, t0, t1, upper }) => {
  const N = 480;
  const out = [];
  let length = 0;
  let prev = null;
  for (let i = 0; i <= N; i += 1) {
    const t = t0 + ((t1 - t0) * i) / N;
    const x = cx - Math.cos(t) * rx;
    const y = upper ? cy - Math.sin(t) * ry : cy + Math.sin(t) * ry;
    if (prev) length += Math.hypot(x - prev.x, y - prev.y);
    const pt = { t, x, y, length };
    out.push(pt);
    prev = pt;
  }
  return out;
};

/** Where along the arch a given distance falls, with its direction. */
const at = (samples, s, { cx, cy, rx, ry }) => {
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].length < s) lo = mid; else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const k = b.length === a.length ? 0 : (s - a.length) / (b.length - a.length);
  const x = a.x + (b.x - a.x) * k;
  const y = a.y + (b.y - a.y) * k;
  // Outward normal of the ellipse, from its gradient; tangent is square to it.
  let nx = (x - cx) / (rx * rx);
  let ny = (y - cy) / (ry * ry);
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  return { x, y, nx, ny, tx: -ny, ty: nx };
};

/** A rounded rectangle centred on (x, y), turned to lie along (tx, ty). */
const toothOutline = ({ x, y, tx, ty, nx, ny }, w, h, r) => {
  // Local (u along the arch, v away from the centre) → page.
  const p = (u, v) => [x + u * tx + v * nx, y + u * ty + v * ny];
  const hw = w / 2;
  const hh = h / 2;
  const pt = (u, v) => p(u, v).map(f).join(' ');
  // Four straight edges, each corner a quadratic through the true corner.
  return [
    `M ${pt(-hw + r, -hh)}`,
    `L ${pt(hw - r, -hh)}`, `Q ${pt(hw, -hh)} ${pt(hw, -hh + r)}`,
    `L ${pt(hw, hh - r)}`, `Q ${pt(hw, hh)} ${pt(hw - r, hh)}`,
    `L ${pt(-hw + r, hh)}`, `Q ${pt(-hw, hh)} ${pt(-hw, hh - r)}`,
    `L ${pt(-hw, -hh + r)}`, `Q ${pt(-hw, -hh)} ${pt(-hw + r, -hh)}`,
    'Z',
  ].join(' ');
};

const segment = ({ x, y, tx, ty, nx, ny }, u1, v1, u2, v2) => ({
  x1: f(x + u1 * tx + v1 * nx), y1: f(y + u1 * ty + v1 * ny),
  x2: f(x + u2 * tx + v2 * nx), y2: f(y + u2 * ty + v2 * ny),
});

/**
 * One arch. `upper` draws it as ∩ above the centre line, otherwise ∪ below.
 * Molars get the fissure cross, anteriors the incisal line — enough to tell
 * them apart at a glance, while leaving room to write on.
 */
const Arch = ({ teeth, widths, geom, labels, height, posteriorCount }) => {
  const samples = sampleArch(geom);
  const total = samples[samples.length - 1].length;
  const sum = widths.reduce((a, b) => a + b, 0);
  const GAP = 6;

  let run = 0;
  return (
    <g>
      {teeth.map((tooth, i) => {
        const share = (widths[i] / sum) * total;
        const place = at(samples, run + share / 2, geom);
        run += share;
        const w = Math.max(18, share - GAP);
        const h = height;
        const posterior = i < posteriorCount || i >= teeth.length - posteriorCount;
        const cross = posterior
          ? [segment(place, -w * 0.3, 0, w * 0.3, 0), segment(place, 0, -h * 0.28, 0, h * 0.28)]
          : [segment(place, -w * 0.28, -h * 0.22, w * 0.28, -h * 0.22)];
        // The number sits outside the arch, clear of the crown.
        const lx = place.x + place.nx * (h / 2 + 15);
        const ly = place.y + place.ny * (h / 2 + 15) + 4.5;
        return (
          <g key={tooth}>
            <path
              d={toothOutline(place, w, h, Math.min(6, w / 4))}
              fill={TOOTH_FILL} stroke={TOOTH_LINE} strokeWidth="1.2"
            />
            {cross.map((c, k) => (
              <line key={k} {...c} stroke={TOOTH_LINE} strokeWidth="1" />
            ))}
            <text
              x={f(lx)} y={f(ly)}
              textAnchor="middle" fontSize="13" fontWeight="600" fill={LABEL}
              fontFamily="system-ui, sans-serif"
            >
              {labels[tooth]}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Universal numbers, which is how the rest of this app stores a tooth. The
// label map converts for display so the diagram agrees with the chart.
const ADULT_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const ADULT_LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];
// Primary dentition, FDI 55–65 / 85–75, left-to-right as the patient faces you.
const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const Grid = () => {
  const step = 40;
  const lines = [];
  for (let x = step; x < WIDTH; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1="0" x2={x} y2={HEIGHT} stroke={LINE} strokeWidth="0.8" />);
  }
  for (let y = step; y < HEIGHT; y += step) {
    lines.push(<line key={`h${y}`} x1="0" y1={y} x2={WIDTH} y2={y} stroke={LINE} strokeWidth="0.8" />);
  }
  return <g opacity="0.6">{lines}</g>;
};

const Ruled = () => {
  const step = 56;
  const lines = [];
  for (let y = step * 1.5; y < HEIGHT; y += step) {
    lines.push(<line key={y} x1="56" y1={y} x2={WIDTH - 56} y2={y} stroke={LINE} strokeWidth="1.2" />);
  }
  return <g>{lines}</g>;
};

const Mouth = ({ child, teeth: [upper, lower], labels }) => {
  // The two arches share a centre line with a gap between them for the
  // RIGHT · LEFT marker. A child's mouth is drawn smaller, as it is.
  const scale = child ? 0.82 : 1;
  const common = {
    cx: WIDTH / 2, rx: WIDTH * 0.4 * scale, ry: HEIGHT * 0.27 * scale,
    t0: Math.PI * 0.06, t1: Math.PI * 0.94,
  };
  const widths = child ? CHILD_WIDTHS : ADULT_WIDTHS;
  const height = child ? 56 : 58;
  const posteriorCount = child ? 2 : 5;
  return (
    <g>
      <Arch teeth={upper} widths={widths} labels={labels} height={height}
        posteriorCount={posteriorCount}
        geom={{ ...common, cy: HEIGHT / 2 - 34, upper: true }} />
      <Arch teeth={lower} widths={widths} labels={labels} height={height}
        posteriorCount={posteriorCount}
        geom={{ ...common, cy: HEIGHT / 2 + 34, upper: false }} />
      <text x={WIDTH / 2} y={HEIGHT / 2 + 5} textAnchor="middle" fontSize="12"
        fill={LABEL} fontFamily="system-ui, sans-serif" letterSpacing="2">
        RIGHT · LEFT
      </text>
    </g>
  );
};

/**
 * @param {string} backdrop  one of BACKDROPS
 * @param {(n:number)=>string|number} toothLabel  how this clinic writes a tooth
 *        number — FDI or Universal. Passed in rather than read here so the
 *        diagram can never disagree with the dental chart two tabs away.
 */
const SketchBackdrop = ({ backdrop, toothLabel = (n) => n }) => {
  if (backdrop === 'grid') return <Grid />;
  if (backdrop === 'ruled') return <Ruled />;
  if (backdrop === 'blank') return null;

  const child = backdrop === 'child-chart';
  const teeth = child ? [CHILD_UPPER, CHILD_LOWER] : [ADULT_UPPER, ADULT_LOWER];
  // Primary teeth are already stored as FDI, so they are shown as typed; the
  // permanent ones go through the clinic's own numbering.
  const labels = Object.fromEntries(
    teeth.flat().map((n) => [n, child ? n : toothLabel(n)])
  );
  return <Mouth child={child} teeth={teeth} labels={labels} />;
};

export default SketchBackdrop;
