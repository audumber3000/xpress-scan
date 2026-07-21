import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X,
} from 'lucide-react';
import {
  format, addMonths, subMonths, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  isSameDay, isSameMonth, isWithinInterval, isBefore,
} from 'date-fns';
import { clinicToday } from '../utils/datetime';

// The page's own accent (matches Payments.jsx). Kept local so the panel looks
// native to wherever it's dropped in.
const ACCENT = '#2a276e';

// Parse the clinic's "today" (YYYY-MM-DD) into a local-midnight Date so all the
// preset math and calendar rendering happen on the clinic's calendar, not the
// viewer's browser day.
function clinicTodayDate() {
  const [y, m, d] = clinicToday().split('-').map(Number);
  return new Date(y, m - 1, d);
}

const iso = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromIso = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Industry-standard quick ranges (Stripe / GA style), all anchored to clinic today.
function buildPresets() {
  const today = clinicTodayDate();
  return [
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'yesterday', label: 'Yesterday', from: subDays(today, 1), to: subDays(today, 1) },
    { key: 'last7', label: 'Last 7 days', from: subDays(today, 6), to: today },
    { key: 'last30', label: 'Last 30 days', from: subDays(today, 29), to: today },
    { key: 'thisMonth', label: 'This month', from: startOfMonth(today), to: today },
    {
      key: 'lastMonth',
      label: 'Last month',
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1)),
    },
  ];
}

// One month grid.
function MonthGrid({ month, rangeStart, rangeEnd, hoverDate, onPick, onHover }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out = [];
    let cur = start;
    while (cur <= end) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [month]);

  // Preview end while hovering after a start is chosen.
  const effectiveEnd = rangeEnd || (rangeStart && hoverDate && !isBefore(hoverDate, rangeStart) ? hoverDate : null);

  return (
    <div className="flex-1 min-w-0">
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isStart = rangeStart && isSameDay(day, rangeStart);
          const isEnd = effectiveEnd && isSameDay(day, effectiveEnd);
          const inRange = rangeStart && effectiveEnd
            && isWithinInterval(day, { start: rangeStart, end: effectiveEnd });
          const isEdge = isStart || isEnd;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => inMonth && onPick(day)}
              onMouseEnter={() => onHover(day)}
              disabled={!inMonth}
              className={[
                'h-8 text-sm flex items-center justify-center transition-colors relative',
                !inMonth ? 'text-gray-300 cursor-default' : 'cursor-pointer',
                inRange && !isEdge ? 'bg-[#2a276e]/10 text-[#2a276e]' : '',
                inRange && !isEdge ? '' : 'rounded-lg',
                isEdge ? 'bg-[#2a276e] text-white font-semibold rounded-lg' : '',
                inMonth && !inRange && !isEdge ? 'text-gray-700 hover:bg-gray-100 rounded-lg' : '',
                isStart && effectiveEnd && !isSameDay(rangeStart, effectiveEnd) ? 'rounded-r-none' : '',
                isEnd && rangeStart && !isSameDay(rangeStart, effectiveEnd) ? 'rounded-l-none' : '',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Unified filter popover: one control holding a date range (quick presets + a
 * two-month range calendar) plus the tab's own filters (status/mode, or ledger
 * type). Draft state lives here; nothing is committed until Apply, so the list
 * doesn't thrash on every click.
 *
 * `value`  = { dateFrom, dateTo, preset, status, mode, ledgerType }
 * `onApply(next)` fires with the same shape.
 * `tab`    = 'payments' | 'today' | 'ledger'
 * `dateEnabled` — when false (e.g. the "Today" tab, which is fixed to today),
 *   the date range section is hidden and only the tab's own filters show.
 */
const FilterPanel = ({ value, onApply, tab, dateEnabled = true }) => {
  const isLedger = tab === 'ledger';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [viewMonth, setViewMonth] = useState(() => fromIso(value.dateFrom) || clinicTodayDate());
  const [hoverDate, setHoverDate] = useState(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  // The popover is position:fixed (so it escapes the content area's
  // overflow-x-hidden and never tucks under the sidebar). We anchor it to the
  // trigger button and keep it inside the viewport with an 8px gutter.
  const [pos, setPos] = useState(null);

  const presets = useMemo(buildPresets, []);

  // Resync the draft whenever we (re)open, so it reflects committed state.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setViewMonth(fromIso(value.dateFrom) || clinicTodayDate());
      setHoverDate(null);
    }
  }, [open, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Anchor the fixed popover under the trigger, right-aligned, clamped so its
  // left edge never runs off-screen. Recomputed on open, resize and scroll.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gutter = 8;
      const maxWidth = window.innerWidth - gutter * 2;
      // Two months side by side only when there's genuinely room; otherwise a
      // single compact column that fits any width.
      const two = dateEnabled && maxWidth >= 700;
      const preferred = !dateEnabled ? 256 : (two ? 720 : 340);
      const width = Math.min(preferred, maxWidth);
      // Prefer aligning the panel's right edge to the button; clamp the left so
      // it stays fully on screen.
      let left = rect.right - width;
      if (left < gutter) left = gutter;
      if (left + width > window.innerWidth - gutter) left = window.innerWidth - gutter - width;
      const top = rect.bottom + 8;
      // Cap to whatever vertical space is left below the trigger; the columns
      // scroll inside this so nothing is ever cropped, on any screen.
      const maxHeight = window.innerHeight - top - gutter;
      setPos({ top, left, width, two, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, dateEnabled]);

  const rangeStart = fromIso(draft.dateFrom);
  const rangeEnd = fromIso(draft.dateTo);

  const pickPreset = (p) => {
    setDraft((d) => ({ ...d, dateFrom: iso(p.from), dateTo: iso(p.to), preset: p.key }));
    setViewMonth(startOfMonth(p.from));
  };

  const pickDay = (day) => {
    // No start yet, or a full range already set → begin a fresh range.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setDraft((d) => ({ ...d, dateFrom: iso(day), dateTo: '', preset: 'custom' }));
      return;
    }
    // Second click: order the two ends.
    if (isBefore(day, rangeStart)) {
      setDraft((d) => ({ ...d, dateFrom: iso(day), dateTo: iso(rangeStart), preset: 'custom' }));
    } else {
      setDraft((d) => ({ ...d, dateTo: iso(day), preset: 'custom' }));
    }
  };

  const setField = (key, v) => setDraft((d) => ({ ...d, [key]: v }));

  const clearAll = () => {
    const cleared = { dateFrom: '', dateTo: '', preset: '', status: '', mode: '', ledgerType: '' };
    setDraft(cleared);
  };

  const apply = () => {
    onApply(draft);
    setOpen(false);
  };

  // Count committed (not draft) active dimensions for the trigger badge.
  const activeCount = useMemo(() => {
    let n = 0;
    if (dateEnabled && (value.dateFrom || value.dateTo)) n += 1;
    if (isLedger) {
      if (value.ledgerType) n += 1;
    } else {
      if (value.status) n += 1;
      if (value.mode) n += 1;
    }
    return n;
  }, [value, isLedger]);

  // Short human label for the committed range, shown on the trigger.
  const rangeLabel = useMemo(() => {
    if (!dateEnabled || (!value.dateFrom && !value.dateTo)) return null;
    const preset = presets.find((p) => p.key === value.preset);
    if (preset) return preset.label;
    const f = value.dateFrom ? format(fromIso(value.dateFrom), 'd MMM') : '';
    const t = value.dateTo ? format(fromIso(value.dateTo), 'd MMM') : '';
    if (f && t) return f === t ? f : `${f} – ${t}`;
    return f || t;
  }, [value, presets]);

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'finalized', label: 'Finalized' },
    { value: 'partially_paid', label: 'Partial' },
    { value: 'paid_verified', label: 'Paid (Verified)' },
    { value: 'paid_unverified', label: 'Paid (Unverified)' },
  ];
  const modeOptions = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];
  const ledgerOptions = [
    { value: 'invoice', label: 'Payments (In)' },
    { value: 'expense', label: 'Expenses (Out)' },
  ];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-lg text-sm font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 ${
          activeCount > 0
            ? 'bg-[#2a276e]/5 border-[#2a276e]/30 text-[#2a276e]'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <SlidersHorizontal size={15} />
        <span>{rangeLabel || 'Filters'}</span>
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#2a276e] text-white text-[11px] font-semibold">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={activeCount > 0 ? 'text-[#2a276e]' : 'text-gray-400'} />
      </button>

      {open && (
        <div
          style={pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : { visibility: 'hidden' }}
          className="fixed z-50 flex flex-col bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className={`flex min-h-0 flex-1 ${pos?.two ? 'flex-row' : 'flex-col overflow-y-auto'}`}>
            {/* Left: presets + the tab's own filters */}
            <div className={`shrink-0 border-gray-100 p-3 space-y-1 bg-gray-50/60 ${pos?.two ? 'overflow-y-auto min-h-0' : ''} ${dateEnabled ? (pos?.two ? 'w-48 border-r' : 'w-full border-b') : 'w-full'}`}>
              {dateEnabled && (
              <>
              <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date range</p>
              {presets.map((p) => {
                const isActive = draft.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-[#2a276e] text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setField('preset', 'custom')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                  draft.preset === 'custom' ? 'bg-[#2a276e] text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Custom range
              </button>
              </>
              )}

              {/* Tab-specific filters */}
              <div className={`space-y-2 ${dateEnabled ? 'pt-3 mt-2 border-t border-gray-200' : ''}`}>
                {isLedger ? (
                  <label className="block px-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</span>
                    <select
                      value={draft.ledgerType || ''}
                      onChange={(e) => setField('ledgerType', e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                    >
                      <option value="">All</option>
                      {ledgerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                ) : (
                  <>
                    <label className="block px-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                      <select
                        value={draft.status || ''}
                        onChange={(e) => setField('status', e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                      >
                        <option value="">All</option>
                        {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block px-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mode</span>
                      <select
                        value={draft.mode || ''}
                        onChange={(e) => setField('mode', e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                      >
                        <option value="">All</option>
                        {modeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Right: two-month range calendar */}
            {dateEnabled && (
            <div className={`p-3 flex-1 min-w-0 ${pos?.two ? 'overflow-y-auto min-h-0' : ''}`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronLeft size={18} />
                </button>
                <div className="flex-1 flex justify-around text-sm font-semibold text-gray-800">
                  <span>{format(viewMonth, 'MMMM yyyy')}</span>
                  {pos?.two && <span>{format(addMonths(viewMonth, 1), 'MMMM yyyy')}</span>}
                </div>
                <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="flex gap-4 min-w-0" onMouseLeave={() => setHoverDate(null)}>
                <MonthGrid
                  month={viewMonth}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverDate={hoverDate}
                  onPick={pickDay}
                  onHover={setHoverDate}
                />
                {pos?.two && (
                <div className="flex-1 min-w-0">
                  <MonthGrid
                    month={addMonths(viewMonth, 1)}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    hoverDate={hoverDate}
                    onPick={pickDay}
                    onHover={setHoverDate}
                  />
                </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              <X size={14} /> Clear all
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
