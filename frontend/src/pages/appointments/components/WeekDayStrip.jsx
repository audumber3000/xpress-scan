import React from "react";

/**
 * The week, as seven tappable days.
 *
 * A seven column time grid on a 390px screen gives each day about 50px, which
 * is not enough for a name, so the week view was unreadable rather than merely
 * cramped. This keeps the week visible as context and lets one day be legible
 * at a time, which is the trade a phone actually wants.
 */
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const WeekDayStrip = ({ dates, selected, countsByDate, onSelect }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-1 mb-3">
      {dates.map((date) => {
        const iso = date.toISOString().split("T")[0];
        const count = countsByDate[iso] || 0;
        const isSelected = date.toDateString() === selected.toDateString();
        const isToday = date.toDateString() === today.toDateString();

        return (
          <button
            key={iso}
            onClick={() => onSelect(new Date(date))}
            className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-colors ${
              isSelected
                ? "bg-[#2a276e] border-[#2a276e] text-white"
                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className={`text-[10px] font-semibold ${isSelected ? "text-white/70" : "text-gray-400"}`}>
              {DOW[date.getDay()]}
            </span>
            <span className={`text-sm font-bold ${isToday && !isSelected ? "text-[#2a276e]" : ""}`}>
              {date.getDate()}
            </span>
            {/* A dot, not a number. At this size the question is "is there
                anything on", and a count would not be readable anyway. */}
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full ${
                count === 0 ? "bg-transparent" : isSelected ? "bg-white" : "bg-[#2a276e]"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default WeekDayStrip;
