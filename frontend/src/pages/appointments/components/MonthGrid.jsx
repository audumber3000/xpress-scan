import React, { useMemo } from "react";
import { getAppointmentColor } from "../utils/doctorColors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildMonthCells = (year, month) => {
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

const toMinutes = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const formatTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
};

const MAX_CHIPS = 3;

const MonthGrid = ({ currentDate, appointments, onSelectDate, onSelectAppointment }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  // Bucket appointments by yyyy-mm-dd for O(1) lookup per cell.
  const byDate = useMemo(() => {
    const map = {};
    for (const apt of appointments) {
      if (!apt.date) continue;
      const key = new Date(apt.date).toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    Object.values(map).forEach(list =>
      list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    );
    return map;
  }, [appointments]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-xs font-semibold text-gray-600 text-center uppercase tracking-wide">
            {w}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: "600px" }}>
        {cells.map((date, i) => {
          const inMonth = date.getMonth() === month;
          const isToday = sameDay(date, today);
          const iso = date.toISOString().split("T")[0];
          const dayAppts = byDate[iso] || [];
          const overflow = dayAppts.length - MAX_CHIPS;

          return (
            <div
              key={i}
              onClick={() => onSelectDate(new Date(date))}
              className={`border-r border-b border-gray-100 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col gap-1 min-h-[100px] ${
                inMonth ? "bg-white" : "bg-gray-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    isToday
                      ? "bg-[#2a276e] text-white w-6 h-6 rounded-full flex items-center justify-center"
                      : inMonth
                      ? "text-gray-800"
                      : "text-gray-400"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayAppts.length > 0 && (
                  <span className="text-[10px] text-gray-500">{dayAppts.length}</span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                {dayAppts.slice(0, MAX_CHIPS).map((apt) => {
                  const color = getAppointmentColor(apt);
                  return (
                    <button
                      key={apt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(apt);
                      }}
                      className={`text-left text-[10px] px-1.5 py-0.5 rounded border-l-2 truncate ${color.card} ${color.cardBorderLeft} ${
                        color.isUnassigned ? "border-dashed" : ""
                      } hover:opacity-90`}
                      title={`${formatTime(apt.startTime)} — ${apt.patientName}`}
                    >
                      <span className="font-medium">{formatTime(apt.startTime)}</span>{" "}
                      <span className="truncate">{apt.patientName}</span>
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[10px] text-gray-500 px-1.5">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthGrid;
