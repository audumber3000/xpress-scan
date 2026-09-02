import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, RotateCcw, AlertTriangle } from 'lucide-react';

/**
 * Choose which columns a table shows.
 *
 * A modal rather than a drawer: this edits something that already exists, and
 * the side panels are for creating.
 *
 * The fit warning is measured, not guessed. Every column already carries the
 * pixel floor its resize handle clamps to, so adding the floors of the ticked
 * set gives the narrowest the table can honestly be. Compare that against the
 * width the table actually has and you can say exactly when it will start
 * scrolling sideways, rather than inventing a rule like "more than eight
 * columns is too many".
 *
 * It warns and lets them through. Plenty of people will happily scroll for a
 * column they need, and a picker that refuses is a picker they work around.
 */
const ColumnsModal = ({ open, columns, hidden, onApply, onReset, onClose, available }) => {
  const [draft, setDraft] = useState(hidden);

  // Resync on open so the dialog always reflects committed state, never a
  // half-finished edit somebody cancelled last time.
  useEffect(() => { if (open) setDraft(hidden); }, [open, hidden]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shown = useMemo(
    () => columns.filter((c) => !draft.includes(c.key)),
    [columns, draft],
  );

  const needed = useMemo(
    () => shown.reduce((sum, c) => sum + (c.min || 72), 0),
    [shown],
  );

  const overflows = available > 0 && needed > available;

  if (!open) return null;

  const toggle = (col) => {
    if (col.fixed) return;
    setDraft((prev) => {
      if (prev.includes(col.key)) return prev.filter((k) => k !== col.key);
      // Never hide the last one. An empty table reads as data loss, not a
      // setting.
      if (columns.length - prev.length <= 1) return prev;
      return [...prev, col.key];
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">Choose columns</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {shown.length} of {columns.length} showing. Drag the header edges to resize them.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {columns.map((col) => {
            const isShown = !draft.includes(col.key);
            const isLast = isShown && shown.length <= 1;
            const locked = col.fixed || isLast;
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => toggle(col)}
                disabled={locked}
                title={
                  col.fixed ? 'This column cannot be hidden'
                    : isLast ? 'A table needs at least one column'
                      : undefined
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'
                }`}
              >
                <span
                  className={`w-[18px] h-[18px] rounded border flex-shrink-0 grid place-items-center transition-colors ${
                    isShown ? 'bg-[#2a276e] border-[#2a276e] text-white' : 'bg-white border-gray-300'
                  }`}
                >
                  {isShown && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">
                    {col.label || 'Actions'}
                  </span>
                </span>
                {col.fixed && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex-shrink-0">
                    Always on
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {overflows && (
          <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-t border-amber-200 flex-shrink-0">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">
              These columns need about <strong>{Math.round(needed)}px</strong> and the table
              has <strong>{Math.round(available)}px</strong>, so it will scroll sideways. That is
              fine if you want it, but turning one or two off will fit everything on screen.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#2a276e] transition-colors cursor-pointer"
          >
            <RotateCcw size={13} /> Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => { onApply(draft); onClose(); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#2a276e] hover:bg-[#1e1c4f] transition-colors cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnsModal;
