import React from "react";
import { FileText, CheckCircle, AlertCircle } from "lucide-react";
import { getAppointmentColor } from "../utils/doctorColors";

const formatTime = (timeString) => {
  if (!timeString) return "";
  const [h, m] = timeString.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
};

const StatusBadge = ({ status }) => {
  if (status === "accepted") {
    return (
      <div className="w-5 h-5 bg-[#2a276e] rounded-full flex items-center justify-center" title="Accepted">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  if (status === "checking") {
    return (
      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center" title="Checked In">
        <CheckCircle className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center" title="Rejected">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  return null;
};

/**
 * Shared appointment card used in both the week grid (absolute-positioned)
 * and the today list (full-width row).
 *
 * variant:
 *   "week"  — compact card for time-grid overlay
 *   "today" — full-width list item
 */
const AppointmentCard = ({ appointment, variant = "week", style, onClick, onDragStart, onDragEnd, isDraggable = false }) => {
  const color = getAppointmentColor(appointment);
  const isUnassigned = color.isUnassigned;

  if (variant === "today") {
    return (
      <div
        onClick={onClick}
        className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4 ${color.cardBorderLeft} ${isUnassigned ? "ring-1 ring-amber-200" : ""} p-5`}
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
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
                <span className={isUnassigned ? "text-amber-700 font-semibold" : ""}>{appointment.doctor}</span>
                {appointment.patientPhone && <span className="ml-3 text-gray-500">{appointment.patientPhone}</span>}
              </div>
            </div>
          </div>

          <StatusBadge status={appointment.status} />
        </div>
      </div>
    );
  }

  // variant === "week"
  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute pointer-events-auto hover:shadow-md transition-shadow rounded border-l-4 ${color.card} ${color.cardBorderLeft} ${isUnassigned ? "border-dashed ring-1 ring-amber-200" : ""} ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      style={style}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col justify-center relative overflow-hidden">
        {appointment.patientId && (
          <div className="absolute top-1 left-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center z-10" title="Patient file exists">
            <FileText className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        <div className="absolute top-1 right-1 z-10">
          <StatusBadge status={appointment.status} />
        </div>

        <div className="text-xs font-semibold truncate pr-6 pl-5">{appointment.patientName}</div>
        <div className={`text-[11px] truncate pl-5 ${isUnassigned ? "text-amber-700 font-medium" : "opacity-75"}`}>
          {isUnassigned ? "Unassigned — needs doctor" : appointment.doctor}
        </div>
        <div className="text-[11px] opacity-75 pl-5">
          {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
        </div>
      </div>
    </div>
  );
};

export default AppointmentCard;
