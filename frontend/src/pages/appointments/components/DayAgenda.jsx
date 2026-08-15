import React, { useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";
import AppointmentCard from "./AppointmentCard";

/**
 * One day as a list, for phones.
 *
 * A column grid divides the width by the number of doctors. On a 390px screen
 * with four dentists that is under 30px each, which renders a coloured sliver
 * and a truncated name: it answers nothing. Below the breakpoint the question
 * changes from "who is busy when" to "who is coming next", and a list answers
 * that better than any grid could at that size.
 *
 * Same AppointmentCard, its `today` variant, so a card looks and behaves the
 * same wherever it appears and there is no separate mobile calendar to drift.
 */

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const DayAgenda = ({ date, appointments, onAppointmentClick, onCreate }) => {
  const targetDateStr = date.toISOString().split("T")[0];

  const forDay = useMemo(
    () =>
      appointments
        .filter((a) => {
          const d = a.date ? new Date(a.date).toISOString().split("T")[0] : null;
          return d === targetDateStr;
        })
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [appointments, targetDateStr]
  );

  // Group by hour so a long day stays scannable without a time axis.
  const groups = useMemo(() => {
    const map = new Map();
    forDay.forEach((a) => {
      const hour = Math.floor(toMinutes(a.startTime) / 60);
      if (!map.has(hour)) map.set(hour, []);
      map.get(hour).push(a);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [forDay]);

  const label = (hour) => {
    const period = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${period}`;
  };

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (forDay.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white py-14 px-6 text-center">
        <CalendarDays size={26} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-semibold text-gray-700">Nothing booked</p>
        <p className="text-xs text-gray-500 mt-0.5 mb-4">
          {isToday ? "Nobody is expected today yet." : "This day is clear."}
        </p>
        {onCreate && (
          <button
            onClick={() =>
              onCreate({
                date: targetDateStr,
                startTime: "10:00",
                endTime: "10:30",
                duration: 30,
                doctorId: null,
                chairNumber: null,
                available: true,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-[#2a276e] text-white text-sm font-bold"
          >
            <Plus size={15} /> Book someone in
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([hour, list]) => {
        // The hour the clock is currently inside, so "where are we" survives
        // the loss of the time axis.
        const current = isToday && nowMinutes >= hour * 60 && nowMinutes < (hour + 1) * 60;
        return (
          <div key={hour}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  current ? "text-red-600" : "text-gray-400"
                }`}
              >
                {label(hour)}
              </span>
              <span className={`flex-1 h-px ${current ? "bg-red-200" : "bg-gray-100"}`} />
              {current && <span className="text-[10px] font-bold text-red-600">NOW</span>}
            </div>
            <div className="space-y-2">
              {list.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  variant="today"
                  onClick={() => onAppointmentClick(apt, apt.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DayAgenda;
