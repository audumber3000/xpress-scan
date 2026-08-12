import React from "react";
import { FileText, CheckCircle, AlertCircle, XCircle, CalendarX } from "lucide-react";
import { getAppointmentColor } from "../utils/doctorColors";

const formatTime = (timeString) => {
  if (!timeString) return "";
  const [h, m] = timeString.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
};

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * How long the appointment is, in minutes.
 *
 * This decides how much of the card can be shown, so it falls back to the
 * times rather than trusting `duration` alone: a row written by an import or
 * an older client may have no duration at all, and defaulting that to 0 would
 * collapse the card to its smallest layout.
 */
const durationOf = (appointment) => {
  if (Number(appointment?.duration) > 0) return Number(appointment.duration);
  const span = toMinutes(appointment?.endTime) - toMinutes(appointment?.startTime);
  return span > 0 ? span : 30;
};

/**
 * The lifecycle badge.
 *
 * Read the vocabulary from domains/scheduling/appointment_status.py. This used
 * to test 'accepted', 'checking' and 'rejected', which stopped existing when
 * the statuses were renamed, so every card silently lost its badge.
 */
const StatusBadge = ({ status, small = false }) => {
  // Static class strings. Tailwind scans source text, so an interpolated
  // `w-${size}` is never generated and the badge would render with no size.
  const cls = `${small ? "w-3.5 h-3.5" : "w-4 h-4"} rounded-full flex items-center justify-center flex-shrink-0`;
  if (status === "arrived") {
    return (
      <div className={`${cls} bg-green-500`} title="Arrived">
        <CheckCircle className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div className={`${cls} bg-[#2a276e]`} title="Confirmed">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className={`${cls} bg-emerald-600`} title="Seen">
        <CheckCircle className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (status === "no_show") {
    return (
      <div className={`${cls} bg-amber-500`} title="Did not attend">
        <CalendarX className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className={`${cls} bg-gray-400`} title="Cancelled">
        <XCircle className="w-3 h-3 text-white" />
      </div>
    );
  }
  return null;
};

/**
 * Shared appointment card, used by the week grid, the day grid and the list.
 *
 * variant:
 *   "week"  — absolute-positioned card inside a time grid
 *   "today" — full-width list row
 */
const AppointmentCard = ({ appointment, variant = "week", style, onClick, onDragStart, onDragEnd, isDraggable = false }) => {
  const color = getAppointmentColor(appointment);
  const isUnassigned = color.isUnassigned;
  const closed = ["completed", "no_show", "cancelled"].includes(appointment.status);

  if (variant === "today") {
    return (
      <div
        onClick={onClick}
        className={`bg-white rounded-lg transition-colors cursor-pointer border border-gray-200 border-l-4 ${color.cardBorderLeft} ${isUnassigned ? "ring-1 ring-slate-200" : ""} p-5 hover:border-gray-300`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <div className="flex flex-col items-center bg-gray-50 rounded-lg px-3 py-2 min-w-[92px]">
              <div className="text-lg font-bold text-gray-900">{formatTime(appointment.startTime)}</div>
              <div className="text-[10px] text-gray-500">to</div>
              <div className="text-xs font-medium text-gray-600">{formatTime(appointment.endTime)}</div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 truncate">{appointment.patientName}</h3>
                {isUnassigned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                    <AlertCircle className="w-3 h-3" />
                    Unassigned
                  </span>
                )}
                {appointment.patientId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                    <FileText className="w-3 h-3" />
                    File
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                <span className="font-medium">Doctor:</span>{" "}
                <span className={isUnassigned ? "text-slate-700 font-semibold" : ""}>{appointment.doctor}</span>
                {appointment.patientPhone && <span className="ml-3 text-gray-500">{appointment.patientPhone}</span>}
              </div>
            </div>
          </div>

          <StatusBadge status={appointment.status} />
        </div>
      </div>
    );
  }

  // ── variant === "week" ────────────────────────────────────────────────────
  //
  // The layout adapts to how tall the card actually is. It used to render three
  // fixed lines inside `justify-center` with `overflow-hidden`, so a 30 minute
  // appointment (40px tall in the week grid, minus padding) clipped its own top
  // and bottom and showed only the middle line: the time, with no patient name.
  // Treatments now default to 30 minutes, which made that the common case.
  //
  // The patient's name is the one thing a card must always show, so it is
  // rendered first, anchored to the top, and the other lines are dropped as
  // space runs out rather than pushing it out of view.
  const minutes = durationOf(appointment);
  const tiny = minutes < 30;      // name only
  const short = minutes < 45;     // name + time on one line

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute pointer-events-auto transition-colors rounded border-l-4 overflow-hidden ${color.card} ${color.cardBorderLeft} ${isUnassigned ? "border-dashed ring-1 ring-slate-200" : ""} ${closed ? "opacity-60" : ""} ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      style={style}
      title={`${appointment.patientName} · ${formatTime(appointment.startTime)} to ${formatTime(appointment.endTime)}${appointment.doctor ? ` · ${appointment.doctor}` : ""}`}
    >
      <div
        onClick={onClick}
        className={`h-full flex flex-col justify-start overflow-hidden ${tiny ? "px-1.5 py-0.5" : "px-2 py-1"}`}
      >
        {/* Name and badges share one row so the badges cannot cover the name,
            which is what the absolute-positioned ones used to do on a short
            card. */}
        <div className="flex items-center gap-1 min-w-0">
          {appointment.patientId && (
            <span
              className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"
              title="Patient file exists"
            >
              <FileText className="w-2 h-2 text-white" />
            </span>
          )}
          <span className={`font-semibold truncate min-w-0 ${tiny ? "text-[10px]" : "text-xs"}`}>
            {appointment.patientName}
          </span>
          <span className="ml-auto flex-shrink-0">
            <StatusBadge status={appointment.status} small={tiny} />
          </span>
        </div>

        {!tiny && (
          <div className="text-[10px] opacity-75 truncate">
            {formatTime(appointment.startTime)}
            {!short && ` - ${formatTime(appointment.endTime)}`}
          </div>
        )}

        {!short && (
          <div className={`text-[10px] truncate ${isUnassigned ? "text-slate-600 font-medium" : "opacity-75"}`}>
            {isUnassigned ? "Needs a doctor" : appointment.doctor}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
