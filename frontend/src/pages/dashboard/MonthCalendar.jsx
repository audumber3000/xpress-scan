import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RAMP, RAMP_EMPTY, rampIndex, rampInk, STATUS } from './chartTheme';

const DOW = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
];

// The folded corner that carries the day's headcount. Green because a day with
// people in it is good news, and because it has to stay findable on top of a
// cell that may itself be shaded near-navy.
//
// The lab-due and bill-due dots that used to sit here are gone. Three 5px dots
// plus a number plus a shaded cell was four things competing inside 40 pixels.
// Both facts survive in the cell's tooltip and aria-label, where they cost
// nothing and are still one hover away.
const CORNER = STATUS.good;
// Side of the quarter-disc, in px. Wide enough for two digits at 8px with the
// arc clearing them, small enough to leave the date the middle of the cell.
const CORNER_SIZE = 20;

/**
 * Month grid, shaded by how busy each day is.
 *
 * ─── What changed, and why ────────────────────────────────────────────────
 *
 * This grid used to stack four encodings on a 36px cell: three 3px dots for
 * appointments, lab work and dues; a filled green badge in the corner holding
 * a digit; and a four-item legend above the whole thing to explain them. Three
 * pixels is below the size at which a coloured dot is reliably perceived at
 * all, the digit badge competed with the date for the same cell, and the
 * reader still could not answer the question a month view exists to answer:
 * which weeks are heavy and which are empty.
 *
 * Now the cell's fill carries how many people that day involves, and the same
 * number is printed in the cell. One quantity, encoded twice: the shading
 * gives the month its shape at a glance, and the digit gives the exact answer
 * without a hover. That redundancy is deliberate — it is also what makes the
 * grid readable without colour.
 *
 * The three markers that remain are presence-only. The appointments dot is
 * gone because the shading absorbed it, and the new-patient count moved out of
 * its badge into the dot, which is the reduction that made room for the digit.
 *
 * Takes year/month/today as separate values rather than one payload so the grid
 * can be drawn for a month whose activity has not arrived yet. Pressing an
 * arrow redraws the dates immediately and the shading fills in behind them,
 * instead of the calendar blanking out for the length of a request.
 */
const MonthCalendar = ({
  year,
  month,
  today,
  days = [],
  loading = false,
  selected,
  onSelect,
  onNavigate,
  onToday,
}) => {
  const [focusDay, setFocusDay] = useState(null);
  const cellRefs = useRef({});
  const wantsFocus = useRef(false);

  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 0;

  // Only steal focus when the move came from the keyboard. Without the guard
  // the grid would grab focus on every re-render, including the ones caused by
  // the dots arriving from the network.
  useEffect(() => {
    if (!wantsFocus.current || focusDay == null) return;
    wantsFocus.current = false;
    cellRefs.current[focusDay]?.focus();
  }, [focusDay]);

  const move = useCallback((from, delta) => {
    const next = from + delta;
    if (next < 1 || next > daysInMonth) return;
    wantsFocus.current = true;
    setFocusDay(next);
  }, [daysInMonth]);

  const onKeyDown = useCallback((e, day) => {
    const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (deltas[e.key] !== undefined) {
      e.preventDefault();
      move(day, deltas[e.key]);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      wantsFocus.current = true;
      setFocusDay(1);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      wantsFocus.current = true;
      setFocusDay(daysInMonth);
    }
  }, [move, daysInMonth]);

  if (!year || !month) return null;

  const byDate = Object.fromEntries((days || []).map((d) => [d.date, d]));
  const first = new Date(year, month - 1, 1);
  const leading = first.getDay();

  const iso = (day) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // `today` is the real today whichever month is on screen, so this is also how
  // the Today button knows whether it has anywhere to go.
  const onCurrentMonth =
    !!today && today.startsWith(`${year}-${String(month).padStart(2, '0')}`);

  // Shading is scaled to this month's own busiest day, not to a fixed ceiling.
  // A fixed one would render a quiet practice's entire year in the palest step
  // and say nothing; scaled, every month shows its own peaks and troughs. The
  // trade is that the shade is relative, which is why the number is printed
  // alongside it rather than left to the colour.
  const busiest = (days || []).reduce((m, d) => Math.max(m, d.people || 0), 0);

  // The single tab stop. Whichever day the keyboard last landed on, else today,
  // else the 1st — so tabbing in never dumps focus on a day nobody cares about
  // and never costs 31 presses to cross the month.
  const todayDay = onCurrentMonth ? Number(today.slice(-2)) : null;
  const tabDay = focusDay ?? todayDay ?? 1;

  const navBtn = 'w-7 h-7 grid place-items-center rounded-lg text-gray-400 cursor-pointer hover:text-[#4b45b5] hover:bg-gray-100 transition-colors';

  return (
    // Capped width: past ~26rem the grid stops reading as a calendar and starts
    // reading as a table of lonely numbers.
    <div className="min-w-0 w-full max-w-[26rem]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-0.5 min-w-0">
          <button type="button" onClick={() => onNavigate?.(-1)} className={navBtn} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-sm font-bold text-gray-800 tracking-tight whitespace-nowrap px-0.5">{title}</h4>
          <button type="button" onClick={() => onNavigate?.(1)} className={navBtn} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Only offered when it would do something. A Today button on today is
            a button that does nothing, which teaches people not to trust them. */}
        {!onCurrentMonth && (
          <button
            type="button"
            onClick={() => { setFocusDay(null); onToday?.(); }}
            className="text-[11px] font-bold text-[#4b45b5] px-2 py-1 rounded-md cursor-pointer hover:bg-[#4b45b5]/[0.07] transition-colors whitespace-nowrap"
          >
            Today
          </button>
        )}
      </div>

      {/* Not role="grid": that role wants row elements, and this is a bare
          seven-column CSS grid. Each cell is a button carrying a full
          accessible name instead, which is the path that actually reads well. */}
      <div
        aria-label={`${title}, clinic activity`}
        className={`grid grid-cols-7 gap-0.5 transition-opacity ${loading ? 'opacity-50' : ''}`}
      >
        {DOW.map(([short, full], i) => (
          <div
            key={i}
            title={full}
            // The short labels repeat (two T's, two S's), so the accessible
            // name carries the full day and the visible glyph stays one letter.
            className={`text-center text-[10px] font-bold pb-1 ${
              i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            <span aria-hidden="true">{short}</span>
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} aria-hidden="true" />;

          const date = iso(day);
          const activity = byDate[date] || {};
          const isToday = date === today;
          const isSelected = date === selected;
          const isWeekend = (leading + day - 1) % 7 === 0 || (leading + day - 1) % 7 === 6;
          const people = activity.people || 0;

          // -1 is empty, which is a different thing from the palest step: one
          // day nobody came, the other one person did.
          const step = rampIndex(people, busiest);
          // A number sitting on a coloured fill is the one label allowed off
          // the text tokens, because the fill is what it has to clear.
          const ink = step < 0 ? '#4b5563' : rampInk(step);

          const parts = [
            activity.appointments ? `${activity.appointments} appointment${activity.appointments === 1 ? '' : 's'}` : null,
            activity.patients ? `${activity.patients} new patient${activity.patients === 1 ? '' : 's'}` : null,
            activity.labs ? `${activity.labs} lab due` : null,
            activity.dues ? `${activity.dues} bill due` : null,
          ].filter(Boolean);
          const summary = parts.length ? parts.join(', ') : 'nothing on';

          const long = new Date(year, month - 1, day)
            .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

          // Which way the tooltip hangs, so an edge cell doesn't push it
          // outside the card.
          const col = (leading + day - 1) % 7;
          const anchor = col <= 1 ? 'left-0' : col >= 5 ? 'right-0' : 'left-1/2 -translate-x-1/2';

          return (
            // The button is clipped so the corner fold can run right into its
            // edge, so the tooltip has to live outside it or it would be
            // clipped too. Hence the wrapper: it owns the hover group and the
            // positioning context, the button owns the clip.
            <div key={date} className="group relative">
            <button
              ref={(el) => { cellRefs.current[day] = el; }}
              type="button"
              tabIndex={day === tabDay ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, day)}
              onFocus={() => setFocusDay(day)}
              onClick={() => onSelect?.(isSelected ? null : date)}
              aria-label={`${long}: ${summary}`}
              aria-pressed={isSelected}
              // Fixed height, never aspect-square: in a wide card a square cell
              // becomes ~100px tall and the calendar alone fills the screen.
              // 44px on touch (the tightest target on the page, seven across a
              // 390px phone), 40px once there's a pointer.
              //
              // rounded-[4px], not rounded-lg. At 8px on a 40px cell the corners
              // ate enough of the square that the grid read as a row of pills
              // rather than a calendar.
              className={`relative w-full h-11 md:h-10 rounded-[4px] overflow-hidden transition-[background-color,box-shadow] grid place-items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4b45b5] focus-visible:ring-offset-1 ${
                isSelected ? 'ring-2 ring-[#4b45b5] ring-offset-1' : isToday ? 'ring-1 ring-[#4b45b5]' : ''
              }`}
              style={{
                background: isSelected ? '#4b45b5' : step < 0 ? RAMP_EMPTY : RAMP[step],
                // An empty weekend recedes slightly; a busy one does not,
                // because a packed Saturday is exactly the thing worth seeing.
                opacity: isWeekend && step < 0 ? 0.55 : 1,
              }}
            >
              <span
                className={`text-[11px] tabular-nums leading-none ${isToday || isSelected ? 'font-bold' : 'font-medium'}`}
                style={{ color: isSelected ? '#fff' : ink }}
              >
                {day}
              </span>

              {/* The day's headcount, as a folded corner rather than a badge.
                  A pill sitting on top of the cell was a second object in a
                  40px square, fighting the date for the same space. A fold is
                  part of the card: it cuts the corner instead of covering it,
                  so the date keeps the middle to itself.

                  clip-path draws the quarter-disc in one line — the circle is
                  centred on the cell's own top-right corner, so the arc curves
                  in towards the middle exactly as a turned-down page does.
                  Nothing is rendered at all on a day with no one in, which is
                  what keeps a quiet month quiet. */}
              {people > 0 && (
                <span
                  className="absolute top-0 right-0 pointer-events-none"
                  style={{
                    width: CORNER_SIZE,
                    height: CORNER_SIZE,
                    background: CORNER,
                    clipPath: `circle(${CORNER_SIZE}px at 100% 0)`,
                  }}
                >
                  {/* Set in from the point, not jammed against it. The
                      quarter-disc has most of its area a few pixels in, so a
                      digit hard against the corner reads as clipped. */}
                  <span className="absolute top-[4px] right-[4.5px] text-[8px] font-bold text-white leading-none tabular-nums">
                    {people > 99 ? '99+' : people}
                  </span>
                </span>
              )}

            </button>

              {/* CSS-only tooltip. `title` was doing this job before, which
                  meant a half-second delay, no styling, and nothing at all for
                  a keyboard. This shows on hover and on focus, and the same
                  text is already on aria-label for a screen reader. */}
              <span
                role="tooltip"
                className={`pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus-within:block z-20 whitespace-nowrap rounded-md bg-gray-900 text-white text-[10px] font-medium px-2 py-1 shadow-lg ${anchor}`}
              >
                {long}: {summary}
              </span>
            </div>
          );
        })}
      </div>

      {/* A scale key for the shading, and one note for the corner. The
          four-item legend this replaces was explaining three dot colours that
          no longer exist. */}
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2.5">
        <span className="flex items-center gap-1">
          <span className="text-[9px] text-gray-400">Quiet</span>
          {RAMP.map((c) => (
            <i key={c} className="w-3 h-1.5 rounded-[2px]" style={{ background: c }} />
          ))}
          <span className="text-[9px] text-gray-400">Busy</span>
        </span>
        <span className="flex items-center gap-1 text-[9px] text-gray-400 whitespace-nowrap">
          <i
            className="w-2.5 h-2.5"
            style={{ background: CORNER, clipPath: 'circle(10px at 100% 0)' }}
          />
          Patients that day
        </span>
      </div>

    </div>
  );
};

export default MonthCalendar;
