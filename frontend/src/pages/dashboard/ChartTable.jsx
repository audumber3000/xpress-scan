import React from 'react';

/**
 * The table twin every chart on this page carries.
 *
 * Three jobs, none of them optional:
 *
 *  1. It is the accessibility relief for the palette. Several marks sit below
 *     3:1 against white — unavoidable for a light tint doing "context" duty —
 *     and the rule is that such a chart ships either visible labels or a table.
 *  2. It ungates the tooltip. A value a doctor can only reach by hovering is a
 *     value they cannot reach on a touch screen, cannot copy, and cannot read
 *     with a keyboard.
 *  3. It is what people actually want half the time. Both of the dashboards
 *     this design was measured against put a "Table" button on the card, which
 *     is a fair signal about how often a chart is the wrong answer.
 *
 * Driven entirely by `columns`, so no chart hand-rolls a table and they all
 * scroll, align and truncate the same way.
 */
const ChartTable = ({ columns, rows, height }) => (
  <div className="overflow-auto -mx-1 px-1" style={height ? { maxHeight: height } : undefined}>
    <table className="w-full text-[11px] border-collapse">
      <thead>
        {/* Sticky so the header survives a long month of daily rows. */}
        <tr className="sticky top-0 bg-white">
          {columns.map(({ key, label, align = 'left' }) => (
            <th
              key={key}
              scope="col"
              className={`font-semibold text-gray-400 pb-1.5 border-b border-gray-100 whitespace-nowrap ${
                align === 'right' ? 'text-right pl-3' : 'text-left pr-3'
              }`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key ?? i} className="border-b border-gray-50 last:border-0">
            {columns.map(({ key, align = 'left', format }) => (
              <td
                key={key}
                className={`py-1.5 whitespace-nowrap ${
                  align === 'right'
                    ? // tabular-nums belongs here and nowhere else on the card:
                      // these are columns of figures that have to line up.
                      'text-right pl-3 tabular-nums font-semibold text-gray-700'
                    : 'text-left pr-3 text-gray-500'
                }`}
              >
                {format ? format(row[key], row) : row[key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ChartTable;
