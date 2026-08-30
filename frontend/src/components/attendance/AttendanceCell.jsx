import React from "react";
import { Smartphone, AlertTriangle } from "lucide-react";

/**
 * One employee, one day.
 *
 * Two densities off the same data. The week view has room to say what actually
 * happened — arrived 09:12, left 18:04, from a phone — and says it, because
 * the whole complaint about this screen was that a green cell told you somebody
 * was present and nothing else. The month view has thirty-one columns to fit,
 * so it shows the mark and the arrival time only, and the rest is one click
 * away in the drawer.
 */

const STATUS = {
  on_time: { label: "Present", cell: "bg-emerald-50 hover:bg-emerald-100", dot: "bg-emerald-500", text: "text-emerald-700" },
  late:    { label: "Late",    cell: "bg-amber-50 hover:bg-amber-100",     dot: "bg-amber-500",   text: "text-amber-700" },
  absent:  { label: "Absent",  cell: "bg-red-50 hover:bg-red-100",         dot: "bg-red-400",     text: "text-red-700" },
  holiday: { label: "Holiday", cell: "bg-gray-100 hover:bg-gray-150",      dot: "bg-gray-400",    text: "text-gray-600" },
};

const EMPTY = { label: "Mark", cell: "bg-white hover:bg-gray-50", dot: null, text: "text-gray-500" };

const fmtDuration = (minutes) => {
  if (!minutes) return null;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

const AttendanceCell = ({ day, isFuture, dense = false, onClick }) => {
  if (isFuture) {
    return (
      <td className={`border-r border-gray-100 text-center bg-gray-50/40 ${dense ? "px-1 py-2" : "px-4 py-3"}`}>
        <span className="text-gray-300 text-xs">—</span>
      </td>
    );
  }

  const marked = day && Object.keys(day).length > 0;
  const tone = (marked && STATUS[day.status]) || EMPTY;
  const fromPhone = marked && day.source === "mobile";
  // Only worth flagging when the phone was genuinely outside the clinic's own
  // radius, error allowance included. A raw distance is not a problem on its own.
  const flagged = marked && day.clock_in?.outside_geofence === true;

  const handle = (e) => {
    e.stopPropagation();
    onClick?.();
  };

  if (dense) {
    return (
      <td
        onClick={handle}
        title={marked ? `${tone.label}${day.check_in ? ` · in ${day.check_in}` : ""}${day.check_out ? ` · out ${day.check_out}` : ""}` : "Not marked"}
        className={`border-r border-gray-100 text-center cursor-pointer transition-colors px-1 py-2 ${tone.cell}`}
      >
        <div className="flex flex-col items-center gap-0.5">
          {tone.dot ? (
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
          ) : (
            <span className="text-gray-300 text-[11px] leading-none">·</span>
          )}
          {day?.check_in && (
            <span className="text-[9px] leading-none text-gray-500 tabular-nums">{day.check_in}</span>
          )}
        </div>
      </td>
    );
  }

  const worked = fmtDuration(day?.worked_minutes);

  return (
    <td
      onClick={handle}
      className={`px-3 py-2.5 border-r border-gray-100 text-center cursor-pointer transition-colors align-top ${tone.cell}`}
    >
      <div className="flex items-center justify-center gap-1.5">
        {tone.dot && <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} shrink-0`} />}
        <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
        {fromPhone && <Smartphone size={11} className="text-gray-400 shrink-0" title="Clocked in from phone" />}
        {flagged && <AlertTriangle size={11} className="text-amber-500 shrink-0" title="Outside the clinic area" />}
      </div>

      {marked && (day.check_in || day.is_open_shift) && (
        <div className="text-[10px] text-gray-600 mt-1 tabular-nums">
          {day.check_in || "—"}
          {day.check_out ? ` – ${day.check_out}` : day.is_open_shift ? " – still in" : ""}
        </div>
      )}

      {worked && <div className="text-[10px] text-gray-400 mt-0.5">{worked}</div>}

      {marked && day.late_by_minutes > 0 && day.status === "late" && (
        <div className="text-[10px] text-amber-600 mt-0.5">{day.late_by_minutes}m late</div>
      )}

      {marked && day.reason && (
        <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[110px] mx-auto" title={day.reason}>
          {day.reason}
        </div>
      )}
    </td>
  );
};

export default AttendanceCell;
