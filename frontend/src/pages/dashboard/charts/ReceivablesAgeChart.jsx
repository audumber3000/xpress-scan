import React from 'react';
import { ChevronRight } from 'lucide-react';
import ChartCard from '../ChartCard';
import { formatMoney, formatCount } from '../format';
import { RAMP, geometryFor } from '../chartTheme';

// Light to dark, oldest last. These are genuinely ordered categories — the one
// case a value ramp is correct for — so the darkest bar is always the money
// that has been waiting longest, whatever the amounts happen to be. Four
// bands, four steps, straight through.
const BAND_TONE = RAMP;

const BAND_NOTE = {
  '0-15': 'just raised',
  '16-30': 'due about now',
  '31-60': 'chase these',
  '60+': 'unlikely without a call',
};

/**
 * Unpaid money, by how long it has been waiting.
 *
 * The Outstanding KPI card gives one total and the share of it that is over 30
 * days old. That is a number; this is the shape. A clinic owed two lakh across
 * bills raised last week is in a completely different position from one owed
 * two lakh from bills raised in March, and the card above cannot tell those
 * two apart.
 *
 * ─── Not period-filtered, and it says so ─────────────────────────────────
 *
 * Money owed is owed regardless of which window the header is showing. A
 * receivables figure that shrank when you switched to "Today" would be
 * actively misleading, so this card ignores the filter — and unlike the gender
 * donut it replaced, it prints that in its own subtitle rather than sitting
 * silently under a control that does not apply to it.
 *
 * Bands are not individually clickable. The drawer behind the Outstanding card
 * lists every unpaid bill but cannot filter to one age band, and a bar that
 * opens a list of something broader than the bar is worse than a bar that does
 * nothing. One honest action in the header instead.
 */
const ReceivablesAgeChart = ({ data, loading, refreshing, breakpoint, onOpenDetail }) => {
  const geo = geometryFor(breakpoint);
  const bands = data?.bands || [];
  const total = Number(data?.total) || 0;
  const count = Number(data?.count) || 0;
  const oldestDays = Number(data?.oldest_days) || 0;

  // Scaled against the biggest band, not the total: against the total, a clinic
  // whose debt is spread evenly gets four identical quarter-width bars.
  const max = bands.reduce((m, b) => Math.max(m, Number(b.amount) || 0), 0);

  const stale = bands
    .filter((b) => b.label === '31-60' || b.label === '60+')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const takeaway = total > 0
    ? stale > 0
      ? `${formatMoney(stale)} has been waiting more than a month. The oldest bill is ${oldestDays} days old.`
      : `Nothing has been waiting more than a month. The oldest bill is ${oldestDays} days old.`
    : null;

  return (
    <ChartCard
      title="Money waiting"
      description="Unpaid bills by age, across all time"
      loading={loading}
      refreshing={refreshing}
      isEmpty={total === 0}
      takeaway={takeaway}
      emptyTitle="Nothing outstanding"
      emptyHint="Every bill you have raised has been settled."
      action={
        onOpenDetail && (
          <button
            type="button"
            onClick={onOpenDetail}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#4b45b5] px-1.5 py-1 rounded-md cursor-pointer hover:bg-[#4b45b5]/[0.07] transition-colors whitespace-nowrap"
          >
            All unpaid
            <ChevronRight size={12} strokeWidth={2.5} />
          </button>
        )
      }
      table={{
        height: geo.height,
        columns: [
          { key: 'label', label: 'Age', format: (v) => `${v} days` },
          { key: 'amount', label: 'Amount', align: 'right', format: formatMoney },
          { key: 'share', label: 'Share', align: 'right', format: (v) => `${v}%` },
          { key: 'count', label: 'Bills', align: 'right', format: formatCount },
        ],
        rows: bands,
      }}
    >
      <div className="flex flex-col" style={{ minHeight: geo.height - 40 }}>
        <div className="flex items-baseline gap-2 mb-3">
          {/* Proportional figures, not tabular: this is a standalone display
              number, and equal-width digits make it look loose. */}
          <span className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight leading-none">
            {formatMoney(total)}
          </span>
          <span className="text-[11px] text-gray-400">
            across {formatCount(count)} {count === 1 ? 'bill' : 'bills'}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 flex-1">
          {bands.map((band, i) => {
            const amount = Number(band.amount) || 0;
            const width = max > 0 ? (amount / max) * 100 : 0;

            return (
              <div key={band.label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-xs text-gray-700 font-medium whitespace-nowrap">
                    {band.label} days
                    <span className="text-gray-400 font-normal ml-1.5">{BAND_NOTE[band.label]}</span>
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums flex-shrink-0 ${
                      amount > 0 ? 'text-gray-800' : 'text-gray-300'
                    }`}
                  >
                    {amount > 0 ? formatMoney(amount) : '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden min-w-0">
                    {/* A band with money in it never renders as nothing: below
                        about 2% the bar would be invisible and the row would
                        read as empty next to an amount that isn't. */}
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: amount > 0 ? `${Math.max(2, width)}%` : 0,
                        background: BAND_TONE[i] || RAMP[RAMP.length - 1],
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0 w-14 text-right">
                    {band.count > 0 ? `${formatCount(band.count)} ${band.count === 1 ? 'bill' : 'bills'}` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
};

export default ReceivablesAgeChart;
