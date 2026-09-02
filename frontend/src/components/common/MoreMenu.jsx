import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * The secondary-action menu that sits beside a section's Add button.
 *
 * Every list screen was growing its own row of outline buttons — Export here,
 * Import there — and the toolbar was where features went to pile up. The rule
 * now is two controls on the right of any table: the one thing you came to do,
 * and everything else behind this.
 *
 * position:fixed and anchored to the trigger, the same way FilterPanel does it.
 * The filter bars these live in are `sticky` with a z-index, which makes them
 * stacking contexts; an absolutely positioned menu would be trapped inside one
 * and tuck under the table it is supposed to float over.
 *
 * Renders nothing when there is nothing to show. A menu that opens onto an
 * empty box is worse than no menu.
 *
 * items: [{ key, label, icon?, onClick, disabled?, hint?, danger? }]
 *        a falsy entry is skipped, so callers can inline `cond && {...}`.
 */
const MoreMenu = ({ items = [], label = 'More', className = '', align = 'right' }) => {
  const visible = items.filter(Boolean);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Anchor under the trigger, clamped to an 8px gutter so it never runs off
  // the side of a narrow window. Recomputed on scroll because the bar it lives
  // in is sticky and moves under the menu as the page scrolls.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gutter = 8;
      const width = 224;
      const left = align === 'right' ? rect.right - width : rect.left;
      setPos({
        top: rect.bottom + 6,
        left: Math.max(gutter, Math.min(left, window.innerWidth - width - gutter)),
        width,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  if (!visible.length) return null;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className={`inline-flex justify-center items-center gap-2 whitespace-nowrap h-10 px-3.5 border rounded-lg text-sm font-semibold bg-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e] ${
          open
            ? 'border-[#2a276e]/30 text-[#2a276e] bg-[#2a276e]/[0.04]'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        {label}
        <MoreVertical size={18} className="text-[#2a276e]" />
      </button>

      {open && (
        <div
          role="menu"
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden' }}
          className="fixed z-50 py-1.5 bg-white border border-gray-200 rounded-xl shadow-xl"
        >
          {visible.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick?.(); }}
              className={`w-full text-left flex items-start gap-2.5 px-3 py-2 text-sm transition-colors ${
                item.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : `cursor-pointer hover:bg-gray-50 ${item.danger ? 'text-red-600' : 'text-gray-700'}`
              }`}
            >
              {item.icon && (
                <span className={`mt-0.5 flex-shrink-0 ${item.danger ? 'text-red-500' : 'text-[#2a276e]'}`}>
                  {item.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block font-medium truncate">{item.label}</span>
                {/* One line of "what this actually does", for the actions a
                    doctor meets once a quarter and has to re-learn. */}
                {item.hint && (
                  <span className="block text-[11px] text-gray-400 leading-snug">{item.hint}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreMenu;
