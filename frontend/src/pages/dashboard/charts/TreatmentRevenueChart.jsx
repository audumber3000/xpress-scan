import React from 'react';
import ChartCard from '../ChartCard';
import { formatMoney, formatCount } from '../format';
import { SERIES, geometryFor } from '../chartTheme';

/**
 * What the clinic actually earns its money doing.
 *
 * ─── Why this is hand-built and not recharts ──────────────────────────────
 *
 * A ranked list of six things is a list. Recharts' horizontal BarChart would
 * cost a category axis that either truncates "Root canal treatment" or eats a
 * third of the card's width to fit it, and it would put the value in a tooltip
 * when the value is the whole point. Bars drawn as divs put the name, the
 * money and the share on one line at the width they actually need.
 *
 * ─── The pairing is the point ─────────────────────────────────────────────
 *
 * Every row carries both its share of the money and how many bills it appeared
 * on. A treatment can be a third of the visits and a twelfth of the revenue,
 * and nowhere else in this product are those two numbers on the same line. The
 * takeaway under the chart names that gap explicitly when it is large enough
 * to be worth acting on, because it is the finding a doctor would otherwise
 * have to go looking for.
 *
 * One hue for every bar. These are nominal categories with no natural order,
 * so shading them darker-where-bigger would encode the bar's length a second
 * time and spend the only free channel saying what the length already says.
 * "Other" is the one exception, and it is not a rank: it is a remainder, and
 * the pale fill says it is not a treatment you can go and do more of.
 */
const TreatmentRevenueChart = ({ data, loading, refreshing, breakpoint }) => {
  const geo = geometryFor(breakpoint);
  const rows = data?.rows || [];
  const total = Number(data?.total) || 0;

  // Bars are scaled against the biggest row, not the total. Against the total,
  // a clinic with an even spread gets six bars all about a sixth of the way
  // across and the chart says nothing.
  const max = rows.reduce((m, r) => Math.max(m, Number(r.amount) || 0), 0);

  const top = rows.find((r) => !String(r.name).startsWith('Other ('));

  // The row doing the most work for the least money. Ten points is the
  // threshold where the gap stops being noise and starts being a pricing or a
  // chair-time question worth putting in words.
  const lopsided = rows
    .filter((r) => !String(r.name).startsWith('Other ('))
    .reduce((worst, r) => {
      const spread = (Number(r.visit_share) || 0) - (Number(r.share) || 0);
      return spread > 10 && (!worst || spread > worst.spread) ? { row: r, spread } : worst;
    }, null);

  const takeaway = lopsided
    ? `${lopsided.row.name} is on ${lopsided.row.visit_share}% of your bills but only ${lopsided.row.share}% of the money.`
    : top
      ? `${top.name} brought in ${top.share}% of everything you billed this period.`
      : null;

  return (
    <ChartCard
      title="What earns the money"
      description="Revenue by treatment, from your bills"
      loading={loading}
      refreshing={refreshing}
      isEmpty={rows.length === 0 || total === 0}
      takeaway={takeaway}
      emptyTitle="Nothing billed in this period"
      emptyHint="Once you raise bills with line items, this ranks them by revenue."
      table={{
        height: geo.height,
        columns: [
          { key: 'name', label: 'Treatment' },
          { key: 'amount', label: 'Revenue', align: 'right', format: formatMoney },
          { key: 'share', label: 'Share', align: 'right', format: (v) => `${v}%` },
          { key: 'visits', label: 'Bills', align: 'right', format: formatCount },
        ],
        rows,
      }}
    >
      <div className="flex flex-col gap-2.5" style={{ minHeight: geo.height - 40 }}>
        {rows.map((row) => {
          const amount = Number(row.amount) || 0;
          const isOther = String(row.name).startsWith('Other (');
          const width = max > 0 ? Math.max(2, (amount / max) * 100) : 0;

          return (
            <div key={row.name} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span
                  className={`text-xs truncate ${isOther ? 'text-gray-400 italic' : 'text-gray-700 font-medium'}`}
                  title={row.name}
                >
                  {row.name}
                </span>
                <span className="text-xs font-bold text-gray-800 tabular-nums flex-shrink-0">
                  {formatMoney(amount)}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden min-w-0">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${width}%`, background: isOther ? SERIES.soft : SERIES.strong }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0 whitespace-nowrap">
                  {row.share}% · {formatCount(row.visits)} {row.visits === 1 ? 'bill' : 'bills'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
};

export default TreatmentRevenueChart;
