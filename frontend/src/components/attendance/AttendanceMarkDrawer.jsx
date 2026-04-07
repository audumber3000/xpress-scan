import React, { useState, useEffect } from "react";
import { X, CheckCircle2, Clock, XCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  {
    value: "on_time",
    label: "Present",
    icon: CheckCircle2,
    bg: "bg-emerald-50 border-emerald-200",
    activeBg: "bg-emerald-100 border-emerald-500",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    value: "late",
    label: "Late",
    icon: Clock,
    bg: "bg-amber-50 border-amber-200",
    activeBg: "bg-amber-100 border-amber-500",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  {
    value: "absent",
    label: "Absent",
    icon: XCircle,
    bg: "bg-red-50 border-red-200",
    activeBg: "bg-red-100 border-red-500",
    text: "text-red-700",
    dot: "bg-red-500",
  },
];

const AttendanceMarkDrawer = ({ employee, date, currentAttendance, onClose, onSave, saving }) => {
  const [status, setStatus] = useState(currentAttendance?.status || "on_time");
  const [reason, setReason] = useState(currentAttendance?.reason || "");

  useEffect(() => {
    setStatus(currentAttendance?.status || "on_time");
    setReason(currentAttendance?.reason || "");
  }, [employee, date, currentAttendance]);

  if (!employee || !date) return null;

  const handleSave = () => {
    onSave({ employeeId: employee.id, date, status, reason });
  };

  const dateLabel = format(date, "EEEE, d MMMM yyyy");
  const initials = employee.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Mark Attendance</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Employee Info */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-11 h-11 rounded-full bg-[#E0F2F2] flex items-center justify-center text-[#2D9596] font-bold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{employee.name}</p>
              <p className="text-xs text-gray-500 capitalize">{employee.role}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={15} className="text-[#2D9596]" />
            <span className="font-medium">{dateLabel}</span>
          </div>

          {/* Status Selection */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status</p>
            <div className="space-y-2.5">
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      isSelected ? opt.activeBg : `${opt.bg} hover:opacity-80`
                    }`}
                  >
                    <Icon size={18} className={opt.text} />
                    <span className={`font-semibold text-sm ${opt.text}`}>{opt.label}</span>
                    {isSelected && (
                      <div className={`ml-auto w-2 h-2 rounded-full ${opt.dot}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason (shown for late/absent) */}
          {(status === "late" || status === "absent") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Reason <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={status === "late" ? "e.g. Traffic, personal work..." : "e.g. Sick leave, emergency..."}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2D9596]/30 focus:border-[#2D9596] resize-none bg-gray-50 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-[#2D9596] hover:bg-[#1F6B72] rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMarkDrawer;
