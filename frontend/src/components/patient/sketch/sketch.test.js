import { describe, expect, it } from 'vitest';
import {
  COLORS, HEIGHT, SIZES, TOOLS, WIDTH,
  emptySketch, isSketchEmpty, newPage, normaliseSketch, strokeCount,
} from './sketchModel';
import { strokeHit, strokeOpacity, strokeToPath } from './strokePath';

const stroke = (over = {}) => ({
  id: 's1', tool: TOOLS.PEN, color: '#1f2937', size: 8,
  points: [[10, 10, 0.5], [20, 20, 0.6], [30, 25, 0.4]],
  ...over,
});

describe('what a pen note is once it is stored', () => {
  it('starts as one empty page', () => {
    const s = emptySketch();
    expect(s.pages).toHaveLength(1);
    expect(isSketchEmpty(s)).toBe(true);
    expect(strokeCount(s)).toBe(0);
  });

  it('counts marks across every page', () => {
    const s = { v: 1, pages: [{ ...newPage(), strokes: [stroke(), stroke()] },
                              { ...newPage(), strokes: [stroke()] }] };
    expect(strokeCount(s)).toBe(3);
    expect(isSketchEmpty(s)).toBe(false);
  });

  it('a page with no strokes is still an empty note', () => {
    expect(isSketchEmpty({ v: 1, pages: [newPage(), newPage()] })).toBe(true);
  });
});

describe('reading back whatever was stored', () => {
  // This column is written by a browser and read by a PDF renderer. A note that
  // will not parse has to come back as an empty page, never as a crash in the
  // middle of a patient's clinical record.
  it.each([null, undefined, 42, 'a drawing', {}, { pages: 'no' }, { pages: [] }])(
    'refuses to build a note out of %p', (raw) => {
      expect(normaliseSketch(raw)).toBeNull();
    });

  it('drops strokes with no points and keeps the rest', () => {
    const out = normaliseSketch({
      pages: [{ backdrop: 'grid', strokes: [stroke(), { points: [] }, null, stroke({ id: 's2' })] }],
    });
    expect(out.pages[0].strokes.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('fills in anything a stroke is missing rather than rendering a hole', () => {
    const [s] = normaliseSketch({ pages: [{ strokes: [{ points: [[1, 2]] }] }] }).pages[0].strokes;
    expect(s.tool).toBe(TOOLS.PEN);
    expect(s.color).toBe(COLORS[0].value);
    expect(s.size).toBe(SIZES[1].value);
    // A sample with no pressure is a sample from a mouse, not a zero-width mark.
    expect(s.points[0][2]).toBe(0.5);
  });

  it('keeps an unknown tool out of the render path', () => {
    const [s] = normaliseSketch({ pages: [{ strokes: [stroke({ tool: 'laser' })] }] }).pages[0].strokes;
    expect(s.tool).toBe(TOOLS.PEN);
  });

  it('survives a round trip through JSON, which is how it is stored', () => {
    const original = { v: 1, pages: [{ ...newPage('adult-chart'), strokes: [stroke()] }] };
    const back = normaliseSketch(JSON.parse(JSON.stringify(original)));
    expect(back.pages[0].strokes[0].points).toEqual(stroke().points);
    expect(back.pages[0].backdrop).toBe('adult-chart');
  });
});

describe('the ink', () => {
  it('is a closed filled outline, not a stroked line', () => {
    // A polyline with a width has no weight to it and reads as wire on a
    // tablet. perfect-freehand returns the OUTLINE of the ink, so the path has
    // to close.
    const d = strokeToPath(stroke());
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('Q');
  });

  it('draws a single tap, because a dot is a mark somebody meant', () => {
    expect(strokeToPath(stroke({ points: [[50, 50, 0.7]] }))).not.toBe('');
  });

  it('draws nothing at all for a stroke with no points', () => {
    expect(strokeToPath(stroke({ points: [] }))).toBe('');
  });

  it('lays down translucent ink for a highlighter and solid for a pen', () => {
    expect(strokeOpacity(stroke({ tool: TOOLS.MARKER }))).toBeLessThan(1);
    expect(strokeOpacity(stroke())).toBe(1);
  });

  it('stays inside the logical page it was drawn in', () => {
    const numbers = strokeToPath(stroke({ points: [[0, 0, 0.5], [WIDTH, HEIGHT, 0.5]] }))
      .match(/-?\d+\.\d+/g).map(Number);
    // Generous bound: the outline bulges by the nib width beyond the samples.
    expect(Math.min(...numbers)).toBeGreaterThan(-100);
    expect(Math.max(...numbers)).toBeLessThan(WIDTH + 100);
  });
});

describe('the eraser', () => {
  // Whole strokes, not pixels: a clinician wants the line they just drew gone,
  // not a bite taken out of it.
  it('catches a stroke under the cursor', () => {
    expect(strokeHit(stroke(), 20, 20, 18)).toBe(true);
  });

  it('catches one that merely passes nearby', () => {
    expect(strokeHit(stroke(), 22, 24, 18)).toBe(true);
  });

  it('leaves a stroke that is well clear of it', () => {
    expect(strokeHit(stroke(), 500, 500, 18)).toBe(false);
  });

  it('is exclusive at its own radius, so two adjacent lines do not both go', () => {
    expect(strokeHit({ ...stroke(), points: [[0, 0, 0.5]] }, 30, 0, 18)).toBe(false);
  });
});
