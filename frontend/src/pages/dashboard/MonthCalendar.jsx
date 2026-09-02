import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
 *
 * The green corner badge is the count of patients registered that day. It is
 * the number a day of appointments is ultimately for, and it is green because
 * unlike the other three it is unambiguously good news.
 *
 * Takes year/month/today as separate values rather than one payload so the grid
 * can be drawn for a month whose activity has not arrived yet. Pressing an
 * arrow redraws the dates immediately and the dots fill in behind them, instead
 * of the calendar blanking out for the length of a request.
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
  if (!year || !month) return null;

  const byDate = Object.fromEntries((days || []).map((d) => [d.date, d]));
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
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

  const navBtn = 'w-7 h-7 grid place-items-center rounded-lg text-gray-400 cursor-pointer hover:text-[#2a276e] hover:bg-gray-100 transition-colors';

  return (
    // Capped width: past ~26rem the grid stops reading as a calendar and starts
    // reading as a table of lonely numbers.
    <div className="min-w-0 w-full max-w-[26rem]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-0.5 min-w-0">
          <button type="button" onClick={() => onNavigate?.(-1)} className={navBtn} aria-label="Previous month" title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-sm font-bold text-gray-800 tracking-tight whitespace-nowrap px-0.5">{title}</h4>
          <button type="button" onClick={() => onNavigate?.(1)} className={navBtn} aria-label="Next month" title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Only offered when it would do something. A Today button on today is
            a button that does nothing, which teaches people not to trust them. */}
        {!onCurrentMonth && (
          <button
            type="button"
            onClick={() => onToday?.()}
            className="text-[11px] font-bold text-[#2a276e] px-2 py-1 rounded-lg cursor-pointer hover:bg-[#2a276e]/[0.07] transition-colors whitespace-nowrap"
          >
            Today
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap mb-2">
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
        <span className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
          <i className="w-3 h-3 rounded-full bg-emerald-500 grid place-items-center text-[7px] font-bold text-white not-italic">
            1
          </i>
          New patients
        </span>
      </div>

      <div className={`grid grid-cols-7 gap-0.5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-400 pb-1">
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;

          const date = iso(day);
          const activity = byDate[date] || {};
          const isToday = date === today;
          const isSelected = date === selected;
          const registered = activity.patients || 0;
          const dots = [
            activity.appointments > 0 && DOT.appointments,
            activity.labs > 0 && DOT.labs,
            activity.dues > 0 && DOT.dues,
          ].filter(Boolean);

          const parts = [
            activity.appointments ? `${activity.appointments} appt` : null,
            activity.labs ? `${activity.labs} lab` : null,
            activity.dues ? `${activity.dues} due` : null,
            registered ? `${registered} new ${registered === 1 ? 'patient' : 'patients'}` : null,
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
              className={`relative h-11 md:h-9 rounded-lg text-[11px] tabular-nums transition-colors grid place-items-center cursor-pointer ${
                isSelected
                  ? 'bg-[#2a276e] text-white font-bold'
                  : isToday
                    ? 'ring-1 ring-[#2a276e] text-[#2a276e] font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="leading-none -mt-0.5">{day}</span>
              {registered > 0 && (
                // Filled rather than tinted so it survives the navy of a
                // selected day without needing a second treatment.
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-emerald-500 text-white text-[9px] font-bold leading-none grid place-items-center">
                  {registered}
                </span>
              )}
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
