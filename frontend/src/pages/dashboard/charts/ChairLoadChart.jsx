import React from 'react';
import ChartCard from '../ChartCard';
import { RAMP, RAMP_EMPTY, rampIndex, rampInk, geometryFor } from '../chartTheme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const hourLabel = (h) => (h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`);
const windowLabel = (h) => `${hourLabel(h)}–${hourLabel(h + 2)}`;

const fmtMinutes = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return `${rem}m`;
  return rem ? `${h}h ${rem}m` : `${h}h`;
};

/**
 * When the chair is actually busy, as weekday against time of day.
 *
 * ─── Why a heatmap, and why this is the chart nothing else replaces ───────
 *
 * Every other view of appointments in this product is a list or a run of
 * daily totals, and neither can show the shape of a week. The thing a doctor
 * cannot see from the calendar page is that Tuesday afternoons are dead while
 * Saturday mornings are turning people away, because those two facts are
 * thirty screens apart. On a grid they are one glance.
 *
 * Magnitude on a grid is the textbook case for a single-hue sequential ramp:
 * one hue, light to dark, no second colour and nothing to decode.
 *
 * ─── Minutes, not bookings ────────────────────────────────────────────────
 *
 * The fill is booked minutes. Six fifteen-minute check-ups and two forty-five
 * minute fillings are the same number of appointments and very different
 * amounts of chair time, and chair time is what runs out. The count is printed
 * in the cell so the two are never confused with each other.
 *
 * Cancellations and no-shows are excluded upstream: they consumed no chair
 * time, and counting them would draw a busy Tuesday out of a Tuesday nobody
 * attended.
 */
const ChairLoadChart = ({ data, loading, refreshing, breakpoint }) => {
  const geo = geometryFor(breakpoint);
  const hours = data?.hours || [];
  const cells = data?.cells || [];

  const byKey = Object.fromEntries(cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const max = cells.reduce((m, c) => Math.max(m, c.minutes || 0), 0);
  const totalMinutes = cells.reduce((sum, c) => sum + (c.minutes || 0), 0);

  // Busiest and quietest *working* window. A window nobody has ever booked is
  // not "your quietest hour", it is an hour the clinic does not open — naming
  // it would be a finding about the opening times, not about demand. So the
  // quietest is the least-used window that has at least one booking, and the
  // all-zero case falls through to no takeaway at all.
  const worked = cells.filter((c) => (c.minutes || 0) > 0);
  const busiest = worked.reduce((b, c) => (!b || c.minutes > b.minutes ? c : b), null);
  const quietest = worked.length > 2
    ? worked.reduce((q, c) => (!q || c.minutes < q.minutes ? c : q), null)
    : null;

  const takeaway = busiest
    ? `Busiest: ${DAYS[busiest.weekday]} ${windowLabel(busiest.hour)}, ${fmtMinutes(busiest.minutes)} in the chair.` +
      (quietest && quietest !== busiest
        ? ` Quietest open slot: ${DAYS[quietest.weekday]} ${windowLabel(quietest.hour)}.`
        : '')
    : null;

  return (
    <ChartCard
      title="When your chair is busy"
      description="Booked time by day of the week and hour"
      loading={loading}
      refreshing={refreshing}
      isEmpty={totalMinutes === 0}
      takeaway={takeaway}
      emptyTitle="Nothing booked in this period"
      emptyHint="Once appointments are on the calendar, this shows the shape of your week."
      table={{
        height: geo.height,
        columns: [
          { key: 'day', label: 'Day' },
          { key: 'window', label: 'Window' },
          { key: 'count', label: 'Appts', align: 'right' },
          { key: 'minutes', label: 'Chair time', align: 'right', format: fmtMinutes },
        ],
        rows: worked
          .slice()
          .sort((a, b) => b.minutes - a.minutes)
          .map((c) => ({
            key: `${c.weekday}-${c.hour}`,
            day: DAYS[c.weekday],
            window: windowLabel(c.hour),
            count: c.count,
            minutes: c.minutes,
          })),
      }}
    >
      <div className="min-w-0">
        {/* Hour header. The left spacer matches the weekday gutter so the
            columns line up with the cells under them. */}
        <div className="flex items-center gap-1 mb-1">
          <span className="w-8 flex-shrink-0" />
          {hours.map((h) => (
            <span key={h} className="flex-1 text-center text-[9px] font-medium text-gray-400 min-w-0">
              {hourLabel(h)}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {DAYS.map((day, weekday) => (
            <div key={day} className="flex items-center gap-1">
              <span className="w-8 flex-shrink-0 text-[10px] font-semibold text-gray-400">{day}</span>
              {hours.map((h) => {
                const cell = byKey[`${weekday}-${h}`];
                const minutes = cell?.minutes || 0;
                const count = cell?.count || 0;

                // The index, not just the fill: the digit sitting on top has
                // to know how dark the cell underneath it ended up.
                const idx = rampIndex(minutes, max);

                return (
                  <div
                    key={h}
                    // The value is in the cell and in the table; this is the
                    // screen-reader path and the pointer-hover path, not the
                    // only way to read it.
                    title={`${day} ${windowLabel(h)}: ${count} ${count === 1 ? 'appointment' : 'appointments'}, ${fmtMinutes(minutes)}`}
                    aria-label={`${day} ${windowLabel(h)}, ${count} appointments, ${fmtMinutes(minutes)}`}
                    className="flex-1 min-w-0 rounded-[3px] grid place-items-center tabular-nums"
                    style={{
                      background: idx < 0 ? RAMP_EMPTY : RAMP[idx],
                      height: breakpoint === 'mobile' ? 22 : 26,
                      color: rampInk(idx),
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {geo.labels && count > 0 ? count : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Scale key. A sequential fill needs one; it is not a legend of
            categories, so it is a strip with two ends named. */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[9px] text-gray-400">Quiet</span>
          {RAMP.map((c) => (
            <i key={c} className="w-4 h-1.5 rounded-[2px]" style={{ background: c }} />
          ))}
          <span className="text-[9px] text-gray-400">Busy</span>
          {data?.outside > 0 && (
            <span className="text-[9px] text-gray-400 ml-auto">
              {data.outside} outside 8am–10pm
            </span>
          )}
        </div>
      </div>
    </ChartCard>
  );
};

export default ChairLoadChart;
