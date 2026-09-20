import React, { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import EmptyState from './EmptyState';
import ChartSkeleton from './ChartSkeleton';
import ChartTable from './ChartTable';
import { describeDelta } from './format';

/**
 * "12% vs last" / "+8 vs last", color-coded.
 *
 * Two changes from the version this replaces. The phrasing now comes from
 * describeDelta, which drops the percentage when the base is too small to
 * carry one — see the note there. And the arrows are lucide icons rather than
 * the ▲ / ▼ text glyphs, which sat on a different baseline from every other
 * icon on the page and rendered at whatever weight the system font felt like.
 */
const DeltaCaption = ({ delta }) => {
  const d = describeDelta(delta || {});
  if (!d) return null;

  // A rise is good for money collected and bad for money owed. `invert` is how
  // the card that shows the second one says so.
  const good = delta.invert ? !d.up : d.up;
  const Icon = d.up ? ArrowUp : ArrowDown;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        d.tone === 'flat' ? 'text-gray-400' : good ? 'text-emerald-700' : 'text-red-600'
      }`}
    >
      {d.tone !== 'flat' && <Icon size={11} strokeWidth={2.5} aria-hidden="true" />}
      {d.text}
      <span className="text-gray-400 font-medium ml-0.5">vs last</span>
    </span>
  );
};

/**
 * White card wrapper for a dashboard chart: skeleton on first fetch, empty
 * state when there is nothing, then the chart.
 *
 * The legend lives up here in the header rather than inside the chart. Recharts'
 * own <Legend> eats vertical space from the plot area and re-flows the chart on
 * every resize; as header text it costs nothing and stays put.
 *
 * Two things this card deliberately does not have any more:
 *
 *   The icon square. Eight identical tinted rounded squares (four here, four on
 *   the KPI row) is chrome repeated until it stops meaning anything. The title
 *   is the label.
 *
 *   A skeleton on every refetch. Changing the period used to blank all four
 *   cards to grey bars and reflow the page. `refreshing` holds the previous
 *   render at reduced opacity instead, which is what TodayPanel already did for
 *   day changes.
 */
const ChartCard = ({
  title, children, loading, refreshing, isEmpty, delta, description,
  legend, emptyTitle, emptyHint, emptyIcon, action,
  // One sentence stating what the chart shows, under the plot. This is the
  // difference between a chart and a shrug: the reader should not have to
  // derive the finding the card was built to deliver.
  takeaway,
  // { columns, rows } — renders the Table toggle. See ChartTable.
  table,
}) => {
  const [showTable, setShowTable] = useState(false);
  const canToggle = !!table && !loading && !isEmpty;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5 md:p-5 flex flex-col w-full h-full">
      {/* flex-wrap, not truncate: a narrow card (the 1/3 column) has to give the
          title its full text and let the legend drop to the next line, otherwise
          a two-word title renders as "Appoint…" next to a legend that had room
          to move. */}
      <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap mb-3.5">
        <div className="flex-1 min-w-[11rem]">
          <h3 className="font-bold text-gray-800 tracking-tight text-sm md:text-[15px] leading-tight">
            {title}
          </h3>
          {description && (
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap">
          {!loading && !isEmpty && !showTable && legend?.length > 0 &&
            legend.map(({ label, color, soft }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap">
                {/* A 2px inset ring rather than a flat dot for the soft series,
                    so the pale swatch is still findable against white. */}
                <i
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={soft ? { boxShadow: `inset 0 0 0 3px ${color}` } : { background: color }}
                />
                {label}
              </span>
            ))}
          {!loading && !isEmpty && delta && <DeltaCaption delta={delta} />}
          {action}
          {canToggle && (
            // Radius 6, not 8: this chip sits inside a 12px card at 14px
            // padding, and a concentric inner corner is outer minus the gap.
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2 py-1 rounded-md cursor-pointer hover:border-gray-300 hover:text-gray-700 transition-colors whitespace-nowrap"
            >
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>

      <div
        className={`flex-1 relative min-h-[170px] transition-opacity duration-200 ${
          refreshing ? 'opacity-50' : ''
        }`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />
        ) : showTable ? (
          <ChartTable columns={table.columns} rows={table.rows} height={table.height} />
        ) : (
          children
        )}
      </div>

      {takeaway && !loading && !isEmpty && (
        <p className="text-[11px] text-gray-500 leading-snug mt-3 pt-2.5 border-t border-gray-100">
          {takeaway}
        </p>
      )}
    </div>
  );
};

export default ChartCard;
