import React, { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import SketchSurface from './SketchSurface';

/**
 * Every page of the note, as thumbnails you can tap.
 *
 * "Page 2 of 3" with arrows tells you where you are; it does not tell you which
 * page had the lower arch on it. The thumbnails do, and switching is one tap
 * instead of a walk. They are the real pages drawn small — the same component
 * in read-only mode, with the same cached ink — not screenshots that go stale.
 */
const SketchPages = ({
  pages, pageIndex, setPageIndex, addPage, removePage, toothLabel,
  disabled = false, compact = false,
}) => {
  const stripRef = useRef(null);

  // Keep the current page in view: adding a fifth page should not leave the
  // clinician looking at thumbnails one to four.
  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-page="${pageIndex}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [pageIndex, pages.length]);

  const thumbW = compact ? 72 : 96;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={stripRef}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Pages"
      >
        {pages.map((p, i) => {
          const active = i === pageIndex;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Page ${i + 1}`}
              data-page={i}
              onClick={() => setPageIndex(i)}
              className={`group relative shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors ${
                active ? 'border-[#2a276e]' : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ width: thumbW, aspectRatio: '3 / 2' }}
            >
              <SketchSurface page={p} readOnly toothLabel={toothLabel} />
              <span className={`absolute bottom-0.5 left-1 rounded px-1 text-[10px] font-bold ${
                active ? 'bg-[#2a276e] text-white' : 'bg-white/90 text-gray-500'
              }`}>
                {i + 1}
              </span>
            </button>
          );
        })}

        {!disabled && (
          <button
            type="button"
            onClick={addPage}
            title="Add a page"
            aria-label="Add a page"
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 transition-colors hover:border-[#2a276e]/40 hover:text-[#2a276e]"
            style={{ width: thumbW, aspectRatio: '3 / 2' }}
          >
            <Plus size={16} />
            {!compact && <span className="text-[10px] font-semibold">Page</span>}
          </button>
        )}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={removePage}
          title={pages.length > 1 ? `Delete page ${pageIndex + 1}` : 'Clear this page'}
          aria-label={pages.length > 1 ? `Delete page ${pageIndex + 1}` : 'Clear this page'}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

export default SketchPages;
