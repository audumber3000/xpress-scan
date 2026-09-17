import React, { memo } from 'react';
import SketchBackdrop from './SketchBackdrop';
import { HEIGHT, WIDTH } from './sketchModel';
import { strokeOpacity, strokeToPath } from './strokePath';

/**
 * The page itself: diagram underneath, ink on top.
 *
 * One SVG at a fixed viewBox, scaled by CSS to whatever room it has. Everything
 * stored is in that coordinate space, so a note drawn on a phone opens the same
 * on a 13" tablet and prints at full resolution.
 *
 * Three layers, and the split is what keeps the ink up with the nib:
 *   backdrop   — memoised on the paper type; never redraws while writing
 *   committed  — memoised on the stroke list; redraws only when a stroke lands
 *   live       — the one stroke under the pen, redrawn every sample
 *
 * `touchAction: none` is not optional. Without it the browser claims the
 * gesture for scrolling and the pen draws a short line before the page starts
 * moving under it.
 */

const Stroke = ({ stroke }) => (
  <path d={strokeToPath(stroke)} fill={stroke.color} opacity={strokeOpacity(stroke)} />
);

const Committed = memo(({ strokes }) => (
  <g>{strokes.map((s) => <Stroke key={s.id} stroke={s} />)}</g>
));
Committed.displayName = 'Committed';

const Backdrop = memo(SketchBackdrop);

/**
 * `readOnly` draws the page without listening to anything — the page strip's
 * thumbnails and anywhere else a note is shown rather than written on.
 */
const SketchSurface = ({
  page, live = null, toothLabel, readOnly = false, disabled = false,
  surfaceRef, onPointerDown, onPointerMove, endStroke, cursor, className = '',
}) => (
  <svg
    ref={readOnly ? undefined : surfaceRef}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={readOnly ? 'Pen notes page' : 'Pen notes for this visit — draw here'}
    className={`block h-full w-full select-none ${className}`}
    style={readOnly
      ? { pointerEvents: 'none' }
      : { touchAction: 'none', cursor: disabled ? 'default' : cursor, WebkitUserSelect: 'none' }}
    {...(readOnly ? {} : {
      onPointerDown,
      onPointerMove,
      onPointerUp: endStroke,
      onPointerCancel: endStroke,
      onLostPointerCapture: endStroke,
      // A long press on iPad opens the callout/magnifier over the canvas.
      onContextMenu: (e) => e.preventDefault(),
    })}
  >
    <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#ffffff" />
    <Backdrop backdrop={page.backdrop} toothLabel={toothLabel} />
    <Committed strokes={page.strokes} />
    {live && <Stroke stroke={live} />}
  </svg>
);

export default SketchSurface;
