import React from 'react';

/**
 * The two bits of markup a resizable table needs, beside useColumnWidths.
 *
 * ColGroup carries the widths. It has to be a real <colgroup> rather than
 * widths on the <th>: under `table-fixed` the browser reads the first row for
 * sizing, and a colgroup states the intent once for header and body together.
 */
export const ColGroup = ({ widths }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: `${w}%` }} />
    ))}
  </colgroup>
);

/**
 * The grab area on a column boundary.
 *
 * 12px wide and centred on the edge, because a 1px line is not a target anyone
 * can hit. The visible hairline is half-height and grey until you approach it.
 * Its <th> must be `relative` and must not clip its overflow, or the half that
 * hangs over the boundary is cut off and the handle becomes 6px wide.
 */
export const ResizeHandle = ({ onPointerDown, onDoubleClick }) => (
  <span
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize column"
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    // Sorting or selection could live on the header later; a resize drag must
    // never read as a click on the thing behind it.
    onClick={(e) => e.stopPropagation()}
    title="Drag to resize. Double-click to reset every column."
    className="group absolute top-0 right-0 z-10 flex h-full w-3 translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center"
  >
    <span className="block h-1/2 w-px bg-gray-200 transition-colors group-hover:w-0.5 group-hover:bg-[#2a276e]" />
  </span>
);

/**
 * A whole <thead> built from a column spec, with a grab handle on every
 * boundary but the last.
 *
 * Nine tables now share this. Hand-writing the header per table is how the
 * resize handle ends up on six of them and the seventh quietly stops being
 * draggable after someone edits a column.
 *
 * The tint sits on the cells rather than the row so the outer two can round off
 * with the card corner, which a card that must not clip its overflow can no
 * longer do for them.
 */
export const ResizableHead = ({
  columns,
  startResize,
  onReset,
  className = 'border-b border-gray-100 sticky z-10',
  style,
  rounded = true,
}) => (
  <thead className={className} style={style}>
    <tr>
      {columns.map((col, i) => (
        <th
          key={col.key}
          className={`relative bg-[#f8fafc] px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
            col.align === 'right' ? 'text-right' : 'text-left'
          } ${rounded && i === 0 ? 'rounded-tl-xl' : ''} ${
            rounded && i === columns.length - 1 ? 'rounded-tr-xl' : ''
          }`}
        >
          <span className="block truncate">{col.label}</span>
          {i < columns.length - 1 && (
            <ResizeHandle
              onPointerDown={(e) => startResize(i, e)}
              onDoubleClick={onReset}
            />
          )}
        </th>
      ))}
    </tr>
  </thead>
);
