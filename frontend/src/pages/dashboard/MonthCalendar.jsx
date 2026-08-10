import React from 'react';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DOT = {
  appointments: '#2a276e',
  labs: '#9B8CFF',
  dues: '#f59e0b',
};

/**
 * Month grid with a dot per activity type under each day.
 *
 * The dots answer "what does my month look like" without opening the calendar
 * page — Thursday packed, Friday empty. One dot per *type* present, not per
 * item: three dots means appointments + lab work + a due invoice, not three
 * appointments. Counts live in the tooltip.
 */
const MonthCalendar = ({ month, selected, onSelect }) => {
  if (!month?.days?.length) return null;

  const byDate = Object.fromEntries(month.days.map((d) => [d.date, d]));
  const first = new Date(month.year, month.month - 1, 1);
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const leading = first.getDay();

  const iso = (day) =>
    `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    // Capped width: past ~26rem the grid stops reading as a calendar and starts
    // reading as a table of lonely numbers.
    <div className="min-w-0 w-full max-w-[26rem]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">{title}</h4>
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {[
            ['Appts', DOT.appointments],
            ['Lab', DOT.labs],
            ['Dues', DOT.dues],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
              <i className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-400 pb-1">
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;

          const date = iso(day);
          const activity = byDate[date] || {};
          const isToday = date === month.today;
          const isSelected = date === selected;
          const dots = [
            activity.appointments > 0 && DOT.appointments,
            activity.labs > 0 && DOT.labs,
            activity.dues > 0 && DOT.dues,
          ].filter(Boolean);

          const parts = [
            activity.appointments ? `${activity.appointments} appt` : null,
            activity.labs ? `${activity.labs} lab` : null,
            activity.dues ? `${activity.dues} due` : null,
          ].filter(Boolean);

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect?.(isSelected ? null : date)}
              title={parts.length ? `${day}: ${parts.join(', ')}` : String(day)}
              // Fixed height, never aspect-square: in a wide card a square cell
              // becomes ~100px tall and the calendar alone fills the screen.
              // 44px on touch (the tightest target on the page, seven across a
              // 390px phone), 36px once there's a pointer.
              className={`relative h-11 md:h-9 rounded-lg text-[11px] tabular-nums transition-colors grid place-items-center ${
                isSelected
                  ? 'bg-[#2a276e] text-white font-bold'
                  : isToday
                    ? 'ring-1 ring-[#2a276e] text-[#2a276e] font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="leading-none -mt-0.5">{day}</span>
              {dots.length > 0 && (
                <span className="absolute bottom-1 flex items-center gap-[2px]">
                  {dots.map((color) => (
                    <i
                      key={color}
                      className="w-[3px] h-[3px] rounded-full"
                      style={{ background: isSelected ? 'rgba(255,255,255,0.9)' : color }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
