import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Column layout for a data table: which columns are shown, and how wide.
 *
 * Two things have to be true before a width means anything. The table must be
 * `table-fixed` — under the default auto layout a width is only a suggestion and
 * the content wins — and every cell must clip, because a fixed column no longer
 * grows to fit a long value. The shared `.mp-table-fixed` rule does the second.
 *
 * `width` is a relative weight, not a literal percentage. The visible set is
 * normalised to 100% on every render, which is what lets a column be hidden or
 * brought back without the remaining ones having to be renumbered.
 *
 * Dragging a boundary moves width from one column to its neighbour rather than
 * growing the table, so the table can never outgrow its container. That is not
 * only tidier: the alternative needs an `overflow-x` wrapper, and an overflow
 * ancestor is exactly what stops a sticky column header from sticking.
 *
 * Saved per browser in localStorage. A layout preference is about the screen you
 * are sitting at, and this way it costs no request and no schema.
 *
 * columns: [{ key, label, width, min, align?, optional?, fixed? }]
 *   optional — starts hidden, offered in the column picker
 *   fixed    — cannot be hidden at all
 */

const widthKey = (name) => `mp.colwidths.${name}`;
const hiddenKey = (name) => `mp.colhidden.${name}`;
const DEFAULT_MIN = 72;

const defaultWidths = (columns) => columns.map((c) => c.width);
const defaultHidden = (columns) => columns.filter((c) => c.optional).map((c) => c.key);

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off; the change still applied for this tab */ }
};
const clear = (key) => {
  try { localStorage.removeItem(key); } catch { /* nothing saved to clear */ }
};

const loadWidths = (name, columns) => {
  const base = defaultWidths(columns);
  const saved = read(widthKey(name));
  // A saved layout is only valid for the exact column set it was saved for. Ship
  // a new column and the old array silently means something else, so it is
  // discarded rather than stretched to fit.
  const usable = Array.isArray(saved)
    && saved.length === base.length
    && saved.every((n) => typeof n === 'number' && n > 0);
  return usable ? saved : base;
};

const loadHidden = (name, columns) => {
  const saved = read(hiddenKey(name));
  if (!Array.isArray(saved)) return defaultHidden(columns);
  // Keys that no longer exist are dropped rather than kept as dead weight, and a
  // column marked `fixed` is never honoured as hidden however it got in there.
  const keys = new Set(columns.filter((c) => !c.fixed).map((c) => c.key));
  const kept = saved.filter((k) => keys.has(k));
  // Never hide everything: a table with no columns is a bug that looks like data
  // loss. If a saved list would empty it, fall back to the defaults.
  return kept.length >= columns.length ? defaultHidden(columns) : kept;
};

// Live hooks, keyed by layout name. Inventory's tables own their widths inside
// child components while the More menu that resets them lives on the page, and
// threading a callback up through four components to solve that is more plumbing
// than the feature is worth. A named reset reaches whichever table is mounted.
const listeners = new Map();

const subscribe = (name, fn) => {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
};

/** Clear a saved layout and snap any mounted table using it back to defaults. */
export function resetColumnWidths(name) {
  clear(widthKey(name));
  clear(hiddenKey(name));
  listeners.get(name)?.forEach((fn) => fn());
}

export default function useColumnWidths(name, allColumns) {
  const tableRef = useRef(null);
  const [full, setFull] = useState(() => loadWidths(name, allColumns));
  const [hidden, setHiddenState] = useState(() => loadHidden(name, allColumns));
  const [resizing, setResizing] = useState(false);

  // The pointerup handler fires long after the closure that created it, so the
  // committed widths have to be read from a ref rather than captured.
  const latest = useRef(full);
  latest.current = full;

  // A page can point this at a different table when its tab changes.
  useEffect(() => {
    setFull((prev) => {
      const next = loadWidths(name, allColumns);
      const same = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return same ? prev : next;
    });
    setHiddenState(loadHidden(name, allColumns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, allColumns.length]);

  useEffect(
    () => subscribe(name, () => {
      setFull(defaultWidths(allColumns));
      setHiddenState(defaultHidden(allColumns));
    }),
    [name, allColumns],
  );

  // What actually gets rendered: the visible columns, and their weights scaled
  // so they fill the table.
  const { columns, widths, indexes, weightSum } = useMemo(() => {
    const idx = allColumns.map((_, i) => i).filter((i) => !hidden.includes(allColumns[i].key));
    const live = idx.length ? idx : allColumns.map((_, i) => i);
    const sum = live.reduce((a, i) => a + full[i], 0) || 1;
    return {
      columns: live.map((i) => allColumns[i]),
      widths: live.map((i) => (full[i] / sum) * 100),
      indexes: live,
      weightSum: sum,
    };
  }, [allColumns, hidden, full]);

  const setHidden = useCallback((next) => {
    setHiddenState(next);
    write(hiddenKey(name), next);
  }, [name]);

  const startResize = useCallback((visibleIndex, e) => {
    const table = tableRef.current;
    if (!table || visibleIndex >= indexes.length - 1) return;
    const total = table.offsetWidth;
    if (!total) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const start = latest.current.slice();
    const a = indexes[visibleIndex];
    const b = indexes[visibleIndex + 1];
    // The two columns either side of this boundary, as the reader sees them.
    const shownA = (start[a] / weightSum) * 100;
    const shownB = (start[b] / weightSum) * 100;
    const floor = (i) => ((allColumns[i].min || DEFAULT_MIN) / total) * 100;

    const onMove = (ev) => {
      const wanted = ((ev.clientX - startX) / total) * 100;
      // Clamped by both floors, so neither the column being dragged nor the one
      // paying for it can be squeezed into a sliver.
      const delta = Math.max(-(shownA - floor(a)), Math.min(wanted, shownB - floor(b)));
      // Back out of the normalisation to store the change as weights. The sum is
      // unchanged because the width only moved between two visible columns.
      const asWeight = delta * (weightSum / 100);
      const next = start.slice();
      next[a] = start[a] + asWeight;
      next[b] = start[b] - asWeight;
      setFull(next);
    };

    const stop = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', stop);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setResizing(false);
      write(widthKey(name), latest.current);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', stop);
    // Without these a drag selects the header text and the cursor flickers back
    // to a caret every time it leaves the 12px handle.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    setResizing(true);
  }, [allColumns, indexes, weightSum, name]);

  // Both reset paths go through resetColumnWidths, so a reset fired from a menu
  // and one fired from a double-click cannot drift apart.
  const reset = useCallback(() => resetColumnWidths(name), [name]);

  return { tableRef, columns, widths, allColumns, hidden, setHidden, startResize, reset, resizing };
}
