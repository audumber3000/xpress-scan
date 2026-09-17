import React, { memo } from 'react';
import SketchBackdrop from './SketchBackdrop';
import { HEIGHT, WIDTH } from './sketchModel';
import { strokeOpacity, strokeToPath } from './strokePath';

/**
 * The page itself: diagram underneath, ink on top.
 *
 * One SVG at a fixed viewBox, scaled by CSS to whatever room it has. Everything
 * stored is in that coordinate space, so a note drawn on a phone opens
 * identically on a 13" tablet and prints at full resolution — which an
 * `<img>` of a rasterised canvas cannot do.
 *
 * `touchAction: none` is not optional. Without it the browser claims the
 * gesture for scrolling and the pen draws a short line before the page starts
 * moving under it, which on a tablet makes the whole surface feel broken.
 */

const Ink = memo(({ strokes, simulatePressure }) => (
  <g>
    {strokes.map((s) => (
      <path
        key={s.id}
        d={strokeToPath(s, { simulatePressure })}
        fill={s.color}
        opacity={strokeOpacity(s)}
        // The ink is a filled outline, not a stroked line — see strokePath.
        // Rounding the joins keeps a fast scribble from showing hard corners
        // where the outline doubles back on itself.
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ))}
  </g>
));
Ink.displayName = 'Ink';

const SketchSurface = ({
  page, strokes, simulatePressure, toothLabel, disabled,
  surfaceRef, onPointerDown, onPointerMove, endStroke, cursor,
}) => (
  <svg
    ref={surfaceRef}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Pen notes for this visit"
    className="block h-full w-full select-none rounded-xl bg-white"
    style={{ touchAction: 'none', cursor: disabled ? 'default' : cursor }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endStroke}
    onPointerCancel={endStroke}
    onPointerLeave={endStroke}
  >
    <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#ffffff" />
    <SketchBackdrop backdrop={page.backdrop} toothLabel={toothLabel} />
    <Ink strokes={strokes} simulatePressure={simulatePressure} />
  </svg>
);

export default SketchSurface;
