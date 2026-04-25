import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

// Build a 6-row x 7-col grid of Date objects that covers the given month view.
const buildMonthGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
};

const MiniCalendar = ({ currentDate, onSelectDate, appointmentDates = new Set() }) => {
  // Which month the mini-calendar is showing. Starts on current page's month
  // but can be navigated independently with its own arrows.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    return d;
  });

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

  const goPrev = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() - 1);
    setViewMonth(d);
  };
  const goNext = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + 1);
    setViewMonth(d);
  };

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1 rounded hover:bg-gray-100 text-gray-600" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goNext} className="p-1 rounded hover:bg-gray-100 text-gray-600" aria-label="Next month">
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

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          const inMonth = date.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, currentDate);
          const inCurrentWeek = !isSelected && isSameWeek(date, currentDate);
          const iso = date.toISOString().split("T")[0];
          const hasAppt = appointmentDates.has(iso);

          let cls =
            "relative h-7 w-7 mx-auto flex items-center justify-center text-[11px] rounded-full transition-colors cursor-pointer";
          if (isSelected) {
            cls += " bg-[#2a276e] text-white font-semibold";
          } else if (isToday) {
            cls += " ring-1 ring-[#2a276e] text-[#2a276e] font-semibold";
          } else if (inCurrentWeek) {
            cls += " bg-[#9B8CFF]/20 text-[#2a276e]";
          } else if (inMonth) {
            cls += " text-gray-700 hover:bg-gray-100";
          } else {
            cls += " text-gray-300 hover:bg-gray-50";
          }

          return (
            <button
              key={i}
              onClick={() => onSelectDate(new Date(date))}
              className={cls}
              type="button"
            >
              {date.getDate()}
              {hasAppt && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#2a276e]/70"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
