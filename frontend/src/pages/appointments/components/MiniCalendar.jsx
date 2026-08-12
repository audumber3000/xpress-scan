import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The month, small.
 *
 * It had four visual treatments competing in the same navy and purple family
 * with nothing to tell them apart: a filled pill for the selected day, a ring
 * for today, a purple pill for every day of the visible week, and a dot for
 * "has appointments". Six purple pills read as six selected days, and the one
 * thing worth knowing at a glance, which days are busy, was a 4px dot that
 * disappeared the moment you selected that day.
 *
 * It now says three things and keeps them visually separate:
 *   selected   solid navy fill
 *   today      navy ring, and both together when they coincide
 *   how busy   a dot that grows with the number booked, with the count in the
 *              tooltip, and stays visible when the day is selected
 *
 * The week you are looking at is a plain grey band behind the row: context,
 * not a selection.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfWeek = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
};

const isSameWeek = (a, b) => sameDay(startOfWeek(a), startOfWeek(b));

const buildMonthGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
};

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

const MiniCalendar = ({
  currentDate,
  onSelectDate,
  // Either a Set of ISO dates (older callers) or a map of ISO -> count. The map
  // is what lets the dot say how busy rather than merely whether.
  appointmentDates = new Set(),
  countsByDate = null,
}) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    return d;
  });

  // Follow the main calendar into another month.
  //
  // This was set once and never again, so navigating the main view to October
  // left the mini-calendar sitting on August with no indication it had stopped
  // tracking. Keyed on the month so the manual arrows still browse freely
  // within one month without being yanked back.
  useEffect(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    setViewMonth((prev) => (monthKey(prev) === monthKey(d) ? prev : d));
  }, [currentDate]);

  const monthLabel = useMemo(
    () => viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [viewMonth]
  );

  const cells = useMemo(
    () => buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const step = (delta) => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + delta);
    setViewMonth(d);
  };

  const countFor = (iso) => {
    if (countsByDate) return countsByDate[iso] || 0;
    return appointmentDates.has?.(iso) ? 1 : 0;
  };

  // Three steps is all this size can carry: quiet, busy, very busy.
  const dotSize = (n) => (n === 0 ? 0 : n <= 2 ? 3 : n <= 5 ? 4 : 5);

  // The mini-calendar is browsing a month the main view is not on.
  const offMonth = monthKey(viewMonth) !== monthKey(currentDate);

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-600" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => step(1)} className="p-1 rounded hover:bg-gray-100 text-gray-600" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-[10px] font-medium text-gray-400 text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          const inMonth = date.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, currentDate);
          const inCurrentWeek = isSameWeek(date, currentDate);
          const iso = date.toISOString().split("T")[0];
          const count = countFor(iso);
          const size = dotSize(count);

          const dayOfWeek = date.getDay();

          return (
            <div
              key={i}
              /* The week band sits behind the whole row and only rounds at its
                 ends, so it reads as one continuous week rather than seven
                 separate selections. */
              className={`flex justify-center py-0.5 ${
                inCurrentWeek ? "bg-gray-100" : ""
              } ${inCurrentWeek && dayOfWeek === 0 ? "rounded-l-md" : ""} ${
                inCurrentWeek && dayOfWeek === 6 ? "rounded-r-md" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDate(new Date(date))}
                title={
                  count
                    ? `${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} — ${count} appointment${count === 1 ? "" : "s"}`
                    : date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
                }
                className={`relative h-7 w-7 flex items-center justify-center text-[11px] rounded-full transition-colors ${
                  isSelected
                    ? "bg-[#2a276e] text-white font-bold"
                    : isToday
                      ? "ring-1 ring-[#2a276e] text-[#2a276e] font-bold hover:bg-[#2a276e]/5"
                      : inMonth
                        ? "text-gray-700 hover:bg-gray-200"
                        : "text-gray-300 hover:bg-gray-100"
                }`}
              >
                {date.getDate()}
                {/* Kept when the day is selected, inverted to white. Selecting a
                    busy day used to hide the fact that it was busy. */}
                {size > 0 && (
                  <span
                    className={`absolute bottom-0.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-[#2a276e]"
                    }`}
                    style={{ width: `${size}px`, height: `${size}px` }}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Only shown once the two have actually diverged, so it is a way back
          rather than permanent clutter. */}
      {offMonth && (
        <button
          onClick={() => onSelectDate(new Date(currentDate))}
          className="mt-2 w-full text-[11px] font-semibold text-[#2a276e] hover:underline"
        >
          Back to {currentDate.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
        </button>
      )}
    </div>
  );
};

export default MiniCalendar;
