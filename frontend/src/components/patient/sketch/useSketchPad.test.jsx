import React, { StrictMode, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useSketchPad } from './useSketchPad';
import { TOOLS } from './sketchModel';

/**
 * The pad hosted exactly the way the case paper hosts it: controlled, with the
 * parent storing whatever the pad hands back, under StrictMode (which is how
 * main.jsx runs the app in development).
 *
 * That arrangement is where the bugs live. The pad writes, the parent stores
 * it, the new value comes back down as a prop — and the pad has to know that
 * this is its own write returning, not a different case paper being opened.
 */
function Harness({ onPad, initial = null }) {
  const [form, setForm] = useState({ sketches: initial });
  const pad = useSketchPad({
    value: form.sketches,
    onChange: (sketches) => setForm((f) => ({ ...f, sketches })),
  });
  // A stand-in for the <svg>: 1200×800 on screen, so screen pixels are
  // logical units and the arithmetic in these tests is readable.
  pad.surfaceRef.current = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
  };
  onPad(pad, form);
  return null;
}

// Rendered with react-dom directly, like the other component tests here:
// @testing-library/react is installed without the @testing-library/dom it needs.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots = [];
afterEach(() => {
  roots.splice(0).forEach(({ root, el }) => { act(() => root.unmount()); el.remove(); });
});

const mount = (initial) => {
  const box = {};
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  roots.push({ root, el });
  act(() => {
    root.render(
      <StrictMode>
        <Harness initial={initial} onPad={(pad, form) => { box.pad = pad; box.form = form; }} />
      </StrictMode>,
    );
  });
  return box;
};

const target = { setPointerCapture() {}, releasePointerCapture() {} };
const ev = (x, y, over = {}) => ({
  clientX: x, clientY: y, pressure: 0.5, pointerId: 1, pointerType: 'mouse',
  button: 0, buttons: 1, currentTarget: target, ...over,
});

const draw = (box, points, over) => {
  act(() => box.pad.onPointerDown(ev(...points[0], over)));
  points.slice(1).forEach((p) => act(() => box.pad.onPointerMove(ev(...p, over))));
  act(() => box.pad.endStroke(ev(...points[points.length - 1], over)));
};

describe('pages', () => {
  it('stays on the new page after adding one', () => {
    const box = mount();
    act(() => box.pad.addPage());
    expect(box.pad.pageIndex).toBe(1);
    expect(box.pad.pageCount).toBe(2);
  });

  it('stays on page 2 while drawing on it — the reported bug', () => {
    const box = mount();
    act(() => box.pad.addPage());
    draw(box, [[100, 100], [150, 150], [200, 120]]);

    expect(box.pad.pageIndex).toBe(1);
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(0);
    expect(box.pad.sketch.pages[1].strokes).toHaveLength(1);
  });

  it('keeps every stroke on the page it was drawn on across several pages', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);
    act(() => box.pad.addPage());
    draw(box, [[30, 30], [40, 40]]);
    draw(box, [[50, 50], [60, 60]]);
    act(() => box.pad.addPage());
    draw(box, [[70, 70], [80, 80]]);

    expect(box.pad.sketch.pages.map((p) => p.strokes.length)).toEqual([1, 2, 1]);
    expect(box.pad.pageIndex).toBe(2);
  });

  it('never points past the last page after one is removed', () => {
    const box = mount();
    act(() => box.pad.addPage());
    act(() => box.pad.removePage());
    expect(box.pad.pageCount).toBe(1);
    expect(box.pad.pageIndex).toBe(0);
  });
});

describe('undo', () => {
  it('takes back exactly one stroke per press, even under StrictMode', () => {
    // StrictMode calls state updaters twice. History pushed from inside one is
    // pushed twice, and Undo then appears to do nothing every other press.
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);
    draw(box, [[30, 30], [40, 40]]);
    act(() => box.pad.undo());
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(1);
    act(() => box.pad.undo());
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(0);
    expect(box.pad.canUndo).toBe(false);
  });

  it('survives the parent storing each write', () => {
    // The value coming back down as a prop used to be treated as "a different
    // case paper was opened", which wiped the history after every stroke.
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);
    expect(box.pad.canUndo).toBe(true);
    expect(box.form.sketches.pages[0].strokes).toHaveLength(1);
  });

  it('redoes what was undone', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);
    act(() => box.pad.undo());
    act(() => box.pad.redo());
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(1);
  });

  it('moves to the page an undo changed, so its effect is visible', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);          // page 1
    act(() => box.pad.addPage());
    draw(box, [[30, 30], [40, 40]]);          // page 2
    act(() => box.pad.setPageIndex(0));
    act(() => box.pad.undo());                // takes back the page-2 stroke
    expect(box.pad.pageIndex).toBe(1);
    expect(box.pad.sketch.pages[1].strokes).toHaveLength(0);
  });

  it('keeps the parent in step with what is on screen', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]]);
    act(() => box.pad.undo());
    expect(box.form.sketches.pages[0].strokes).toHaveLength(0);
  });
});

describe('the eraser', () => {
  it('removes a stroke it passes over', () => {
    const box = mount();
    draw(box, [[100, 100], [110, 110]]);
    act(() => box.pad.setTool(TOOLS.ERASER));
    draw(box, [[105, 105], [106, 106]]);
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(0);
  });

  it('is one undo step for a whole sweep, however many strokes it takes', () => {
    const box = mount();
    draw(box, [[100, 100], [101, 101]]);
    draw(box, [[200, 100], [201, 101]]);
    draw(box, [[300, 100], [301, 101]]);
    act(() => box.pad.setTool(TOOLS.ERASER));
    draw(box, [[100, 100], [150, 100], [200, 100], [250, 100], [300, 100]]);
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(0);

    act(() => box.pad.undo());
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(3);
  });

  it('leaves no undo step when it touches nothing', () => {
    const box = mount();
    draw(box, [[100, 100], [101, 101]]);
    act(() => box.pad.setTool(TOOLS.ERASER));
    draw(box, [[900, 700], [901, 701]]);
    act(() => box.pad.undo());
    // The one undo takes back the stroke, not an empty eraser pass.
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(0);
  });
});

describe('palm rejection', () => {
  it('ignores touch once a pen has been used', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]], { pointerType: 'pen', pressure: 0.7 });
    draw(box, [[300, 300], [320, 320]], { pointerType: 'touch', pointerId: 2 });
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(1);
  });

  it('lets touch draw on a device that has never seen a pen', () => {
    const box = mount();
    draw(box, [[300, 300], [320, 320]], { pointerType: 'touch' });
    expect(box.pad.sketch.pages[0].strokes).toHaveLength(1);
  });

  it('remembers per stroke whether the pressure was real', () => {
    const box = mount();
    draw(box, [[10, 10], [20, 20]], { pointerType: 'pen', pressure: 0.8 });
    draw(box, [[30, 30], [40, 40]], { pointerType: 'mouse' });
    const [pen, mouse] = box.pad.sketch.pages[0].strokes;
    expect(pen.sim).toBe(false);
    expect(mouse.sim).toBe(true);
  });
});

describe('opening a note that was saved', () => {
  it('starts on its first page with no history', () => {
    const saved = {
      v: 1,
      pages: [
        { id: 'p1', backdrop: 'grid', strokes: [] },
        { id: 'p2', backdrop: 'blank', strokes: [{ id: 's', tool: 'pen', color: '#000', size: 8, points: [[1, 1, 0.5]] }] },
      ],
    };
    const box = mount(saved);
    expect(box.pad.pageCount).toBe(2);
    expect(box.pad.pageIndex).toBe(0);
    expect(box.pad.canUndo).toBe(false);
  });
});
