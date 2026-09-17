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

// ── One tooth ───────────────────────────────────────────────────────────────
// Anteriors are drawn narrow and rounded, posteriors square with a fissure
// cross. Not anatomy — a diagram. It has to be recognisable at a glance and
// leave room to be written on, and a faithful molar is neither.
const Tooth = ({ x, y, w, h, posterior, upper }) => {
  const r = posterior ? 3 : 5;
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx={r} ry={r}
        fill={TOOTH_FILL} stroke={TOOTH_LINE} strokeWidth="1.2"
      />
      {posterior ? (
        <>
          <line x1={x + w / 2} y1={y + h * 0.22} x2={x + w / 2} y2={y + h * 0.78}
            stroke={TOOTH_LINE} strokeWidth="1" />
          <line x1={x + w * 0.2} y1={y + h / 2} x2={x + w * 0.8} y2={y + h / 2}
            stroke={TOOTH_LINE} strokeWidth="1" />
        </>
      ) : (
        <line
          x1={x + w * 0.22} y1={upper ? y + h * 0.7 : y + h * 0.3}
          x2={x + w * 0.78} y2={upper ? y + h * 0.7 : y + h * 0.3}
          stroke={TOOTH_LINE} strokeWidth="1"
        />
      )}
    </g>
  );
};

/**
 * One arch, laid out as an arc rather than a straight row.
 *
 * A straight line of sixteen boxes is a spreadsheet. The curve is what makes it
 * read as a mouth from across the chair, which matters because the person being
 * shown it is the patient, not the dentist.
 */
const Arch = ({ teeth, cx, cy, rx, ry, upper, labels, toothW, toothH }) => (
  <g>
    {teeth.map((tooth, i) => {
      // Spread across the arc, leaving the ends open so the last molars sit at
      // roughly the corners of the mouth rather than folding underneath.
      const t = teeth.length === 1 ? 0.5 : i / (teeth.length - 1);
      const angle = Math.PI * (0.08 + t * 0.84);
      const x = cx - Math.cos(angle) * rx;
      const y = upper ? cy - Math.sin(angle) * ry : cy + Math.sin(angle) * ry;
      const posterior = i < 5 || i >= teeth.length - 5;
      return (
        <g key={tooth}>
          <Tooth
            x={x - toothW / 2} y={y - toothH / 2}
            w={toothW} h={toothH} posterior={posterior} upper={upper}
          />
          <text
            x={x} y={upper ? y - toothH / 2 - 7 : y + toothH / 2 + 15}
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

const Mouth = ({ teeth: [upper, lower], labels }) => (
  <g>
    <Arch teeth={upper} labels={labels} cx={WIDTH / 2} cy={HEIGHT / 2 - 34}
      rx={WIDTH * 0.37} ry={HEIGHT * 0.26} upper toothW={46} toothH={62} />
    <Arch teeth={lower} labels={labels} cx={WIDTH / 2} cy={HEIGHT / 2 + 34}
      rx={WIDTH * 0.37} ry={HEIGHT * 0.26} upper={false} toothW={46} toothH={62} />
    <text x={WIDTH / 2} y={HEIGHT / 2 + 6} textAnchor="middle" fontSize="12"
      fill={LABEL} fontFamily="system-ui, sans-serif" letterSpacing="2">
      RIGHT · LEFT
    </text>
  </g>
);

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
  return <Mouth teeth={teeth} labels={labels} />;
};

export default SketchBackdrop;
