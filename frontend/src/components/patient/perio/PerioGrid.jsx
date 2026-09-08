import React, { memo, useCallback, useRef } from 'react';
import { universalToFDI } from '../../../utils/toothNumbering';
import {
  BUCCAL_SITES, LINGUAL_SITES, SITE_LABELS, MOBILITY, FURCATION,
  FURCATION_TEETH, MAX_DEPTH, depthTone,
} from './perioConstants';

/**
 * One arch of a full six-point chart.
 *
 * The thing that decides whether a perio chart gets used is not how it looks,
 * it is how fast a number gets into it. A clinician probing with one hand types
 * with the other and does not look at the screen, so:
 *
 *   - digits only, and a digit commits the cell and moves on by itself
 *   - `1` waits a beat, because 10 to 15 are real depths and 1 is not a
 *     reason to lose them
 *   - Tab, Shift-Tab and the arrow keys still work for going back
 *
 * There is deliberately no animation anywhere in this grid. A cell advance
 * happens hundreds of times per chart; anything that has to finish first turns
 * a fast tool into a slow one.
 */

/* The row skeleton. Both the label column and every tooth column render from
   this same list, which is what keeps them aligned without magic numbers. */
const ROWS = [
  { key: 'tooth', label: '', h: 'h-8' },
  { key: 'band-b', label: 'Buccal', h: 'h-6', band: true },
  { key: 'pd-b', label: 'Pocket depth', h: 'h-8', kind: 'pd', sites: BUCCAL_SITES },
  { key: 'rec-b', label: 'Recession', h: 'h-8', kind: 'rec', sites: BUCCAL_SITES },
  { key: 'cal-b', label: 'Attachment loss', h: 'h-6', kind: 'cal', sites: BUCCAL_SITES },
  { key: 'bop-b', label: 'Bleeding', h: 'h-6', kind: 'bop', sites: BUCCAL_SITES },
  { key: 'plq-b', label: 'Plaque', h: 'h-6', kind: 'plq', sites: BUCCAL_SITES },
  { key: 'band-l', label: null, h: 'h-6', band: true },
  { key: 'pd-l', label: 'Pocket depth', h: 'h-8', kind: 'pd', sites: LINGUAL_SITES },
  { key: 'rec-l', label: 'Recession', h: 'h-8', kind: 'rec', sites: LINGUAL_SITES },
  { key: 'cal-l', label: 'Attachment loss', h: 'h-6', kind: 'cal', sites: LINGUAL_SITES },
  { key: 'bop-l', label: 'Bleeding', h: 'h-6', kind: 'bop', sites: LINGUAL_SITES },
  { key: 'plq-l', label: 'Plaque', h: 'h-6', kind: 'plq', sites: LINGUAL_SITES },
  { key: 'mob', label: 'Mobility', h: 'h-8', kind: 'mob' },
  { key: 'fur', label: 'Furcation', h: 'h-8', kind: 'fur' },
];

const CELL_W = 'w-[26px]';

/* One shared empty record, so an unrecorded tooth keeps the same prop identity
   across renders and the memo above actually holds. */
const EMPTY = Object.freeze({});

/* ── One tooth ─────────────────────────────────────────────────────────────
   Memoised on its own record. Editing tooth 3 leaves the other 31 columns
   untouched, which is what keeps 192 inputs per arch responsive. */
const ToothColumn = memo(function ToothColumn({
  tooth, record, missing, lingualLabel, onSetSite, onToggleFlag, onSetTooth,
}) {
  const pendingRef = useRef(null);

  const advance = (el, back = false) => {
    const root = el.closest('[data-perio-grid]');
    if (!root) return;
    const inputs = [...root.querySelectorAll('input[data-perio-cell]:not([disabled])')];
    const i = inputs.indexOf(el);
    const next = inputs[i + (back ? -1 : 1)];
    if (next) { next.focus(); next.select(); }
  };

  const onKeyDown = (e, kind, site) => {
    const el = e.currentTarget;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const d = Number(e.key);
      const pending = pendingRef.current;

      // A `1` is sitting there waiting to become 10-15.
      if (pending && pending.site === site && pending.kind === kind) {
        const combined = 10 + d;
        pendingRef.current = null;
        if (combined <= MAX_DEPTH) {
          onSetSite(tooth, kind, site, combined);
          advance(el);
          return;
        }
      }

      onSetSite(tooth, kind, site, d);
      if (d === 1) {
        // Hold position for one keystroke so 10-15 stay typable.
        pendingRef.current = { kind, site };
        return;
      }
      advance(el);
      return;
    }

    pendingRef.current = null;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onSetSite(tooth, kind, site, null);
      if (e.key === 'Backspace') advance(el, true);
      return;
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); advance(el); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); advance(el, true); }
  };

  const pd = record.pd || {};
  const rec = record.rec || {};

  if (missing) {
    return (
      <div className="shrink-0 border-r border-gray-100 last:border-r-0 bg-gray-50/60">
        {ROWS.map((row) => (
          <div key={row.key} className={`${row.h} flex items-center justify-center px-1`}>
            {row.key === 'tooth' && (
              <span className="text-[11px] font-bold text-gray-300 line-through">
                {universalToFDI(tooth)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  const renderRow = (row) => {
    if (row.key === 'tooth') {
      return (
        <span className="text-[11px] font-bold text-gray-700">{universalToFDI(tooth)}</span>
      );
    }
    if (row.band) return null;

    if (row.kind === 'pd' || row.kind === 'rec') {
      const source = row.kind === 'pd' ? pd : rec;
      return row.sites.map((site) => {
        const value = source[site];
        const has = value === 0 || value;
        return (
          <input
            key={site}
            data-perio-cell
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={has ? value : ''}
            onChange={() => { /* keystrokes are handled in onKeyDown */ }}
            onKeyDown={(e) => onKeyDown(e, row.kind, site)}
            onFocus={(e) => { pendingRef.current = null; e.currentTarget.select(); }}
            onBlur={() => { pendingRef.current = null; }}
            aria-label={`${row.label}, ${SITE_LABELS[site]}, tooth ${universalToFDI(tooth)}`}
            className={`${CELL_W} h-6 text-center text-[12px] rounded border border-transparent bg-transparent outline-none caret-[#2a276e]
              hover:border-gray-200 focus:border-[#2a276e] focus:bg-white focus:ring-1 focus:ring-[#2a276e]/20
              ${row.kind === 'pd' ? depthTone(value) : 'text-gray-500'}`}
          />
        );
      });
    }

    if (row.kind === 'cal') {
      return row.sites.map((site) => {
        const d = pd[site];
        const has = d === 0 || d;
        const cal = has ? Number(d) + (Number(rec[site]) || 0) : null;
        return (
          <span
            key={site}
            title={cal === null ? '' : `${SITE_LABELS[site]} attachment loss ${cal}mm`}
            className={`${CELL_W} text-center text-[11px] ${cal >= 5 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}
          >
            {cal === null ? '' : cal}
          </span>
        );
      });
    }

    if (row.kind === 'bop' || row.kind === 'plq') {
      const list = Array.isArray(record[row.kind]) ? record[row.kind] : [];
      const on = row.kind === 'bop' ? 'bg-red-500' : 'bg-slate-400';
      return row.sites.map((site) => {
        const active = list.includes(site);
        return (
          <button
            key={site}
            type="button"
            onClick={() => onToggleFlag(tooth, row.kind, site)}
            aria-pressed={active}
            aria-label={`${row.label}, ${SITE_LABELS[site]}, tooth ${universalToFDI(tooth)}`}
            className={`${CELL_W} h-5 flex items-center justify-center rounded cursor-pointer hover:bg-gray-100`}
          >
            <span className={`w-2 h-2 rounded-full ${active ? on : 'bg-gray-200'}`} />
          </button>
        );
      });
    }

    if (row.kind === 'mob') {
      return (
        <select
          value={record.mob ?? ''}
          onChange={(e) => onSetTooth(tooth, 'mob', e.target.value === '' ? null : Number(e.target.value))}
          aria-label={`Mobility, tooth ${universalToFDI(tooth)}`}
          className="w-full h-6 text-center text-[11px] font-semibold text-gray-700 bg-transparent border border-transparent rounded cursor-pointer outline-none hover:border-gray-200 focus:border-[#2a276e]"
        >
          <option value="">·</option>
          {MOBILITY.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      );
    }

    if (row.kind === 'fur') {
      if (!FURCATION_TEETH.has(Number(tooth))) {
        return <span className="text-[11px] text-gray-200">—</span>;
      }
      return (
        <select
          value={record.fur ?? ''}
          onChange={(e) => onSetTooth(tooth, 'fur', e.target.value === '' ? null : Number(e.target.value))}
          aria-label={`Furcation, tooth ${universalToFDI(tooth)}`}
          className="w-full h-6 text-center text-[11px] font-semibold text-gray-700 bg-transparent border border-transparent rounded cursor-pointer outline-none hover:border-gray-200 focus:border-[#2a276e]"
        >
          <option value="">·</option>
          {FURCATION.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      );
    }
    return null;
  };

  return (
    <div className="shrink-0 border-r border-gray-100 last:border-r-0">
      {ROWS.map((row) => (
        <div
          key={row.key}
          className={`${row.h} flex items-center justify-center gap-px px-1 ${
            row.band ? 'bg-gray-50' : ''
          } ${row.key === 'tooth' ? 'bg-gray-50/70 border-b border-gray-200' : ''}`}
        >
          {renderRow(row)}
        </div>
      ))}
    </div>
  );
});

const PerioGrid = ({ arch, chart, teethData, onSetSite, onToggleFlag, onSetTooth }) => (
  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
    <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-gray-200">
      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{arch.label} arch</h4>
    </div>

    <div className="flex overflow-x-auto custom-scrollbar" data-perio-grid>
      {/* Row labels. Sticky so they survive the horizontal scroll — a column of
          numbers with no idea which measure it is would be unreadable. */}
      <div className="shrink-0 sticky left-0 z-10 bg-white border-r border-gray-200">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className={`${row.h} flex items-center justify-end pr-3 pl-4 whitespace-nowrap ${
              row.band ? 'bg-gray-50' : ''
            } ${row.key === 'tooth' ? 'bg-gray-50/70 border-b border-gray-200' : ''}`}
          >
            <span className={
              row.band
                ? 'text-[10px] font-black uppercase tracking-[0.15em] text-gray-400'
                : 'text-[11px] font-medium text-gray-500'
            }>
              {row.key === 'band-l' ? arch.lingualLabel : row.label}
            </span>
          </div>
        ))}
      </div>

      {arch.teeth.map((tooth) => (
        <ToothColumn
          key={tooth}
          tooth={tooth}
          record={chart.teeth?.[String(tooth)] || EMPTY}
          missing={(teethData?.[tooth]?.status || '') === 'missing'}
          lingualLabel={arch.lingualLabel}
          onSetSite={onSetSite}
          onToggleFlag={onToggleFlag}
          onSetTooth={onSetTooth}
        />
      ))}
    </div>
  </div>
);


export default PerioGrid;
