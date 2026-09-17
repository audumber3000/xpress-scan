import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Which record the patient keeps is the only outside fact the pad reads.
let dental = true;
vi.mock('../../../utils/casePaper', () => ({ useIsDentalPatient: () => dental }));

import VisitSketchPad from './VisitSketchPad';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = [];
afterEach(() => {
  mounted.splice(0).forEach(({ root, el }) => { act(() => root.unmount()); el.remove(); });
  dental = true;
});

const render = (props) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  mounted.push({ root, el });
  act(() => root.render(<VisitSketchPad onChange={() => {}} patient={{ name: 'Asha', age: 34 }} {...props} />));
  return el;
};

const drawn = {
  v: 1,
  pages: [{ id: 'p1', backdrop: 'adult-chart', strokes: [
    { id: 's1', tool: 'pen', color: '#dc2626', size: 8, sim: true, points: [[10, 10, 0.5], [40, 40, 0.5]] },
  ] }],
};

const canvas = (el) => el.querySelector('svg[aria-label="Pen notes for this visit. Draw here."]');
const open = (el) => act(() => el.querySelector('button[aria-expanded]').click());

describe('opening a case paper', () => {
  it('starts collapsed when nothing is drawn', () => {
    expect(canvas(render({ value: null }))).toBeNull();
  });

  it('starts collapsed when something IS drawn', () => {
    const el = render({ value: drawn });
    expect(canvas(el)).toBeNull();
    expect(el.textContent).toContain('1 page · 1 mark');
  });

  it('shows the drawing as a thumbnail while collapsed, so nobody has to open it to see', () => {
    const el = render({ value: drawn });
    expect(el.querySelector('svg[aria-label="Pen notes page"]')).not.toBeNull();
  });

  it('opens when asked', () => {
    const el = render({ value: drawn });
    open(el);
    expect(canvas(el)).not.toBeNull();
  });
});

describe('the paper a new note starts on', () => {
  it('is the adult arch for a dental patient', () => {
    const el = render({ value: null });
    open(el);
    expect(el.querySelector('select[aria-label="Page background"]').value).toBe('adult-chart');
  });

  it('is the child arch for a young child', () => {
    const el = render({ value: null, patient: { name: 'Riya', age: 4 } });
    open(el);
    expect(el.querySelector('select[aria-label="Page background"]').value).toBe('child-chart');
  });

  it('is plain paper, with no tooth charts offered, for a general clinic', () => {
    dental = false;
    const el = render({ value: null });
    open(el);
    const select = el.querySelector('select[aria-label="Page background"]');
    expect(select.value).toBe('blank');
    const offered = [...select.options].map((o) => o.value);
    expect(offered).not.toContain('adult-chart');
    expect(offered).not.toContain('child-chart');
  });
});

describe('somebody who cannot write clinical records', () => {
  it('is not invited to draw', () => {
    const el = render({ value: null, disabled: true, blockedReason: 'Receptionist' });
    expect(el.textContent).toContain('Nothing drawn for this visit');
    expect(el.textContent).not.toContain('Draw on a tooth chart');
  });
});
