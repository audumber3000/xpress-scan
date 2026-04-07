import React from "react";

const AttendanceCell = ({ status, reason, isHoliday, holidayName, isFuture, onClick }) => {
  if (isFuture) {
    return (
      <td className="px-4 py-3 border-r border-gray-100 text-center bg-gray-50/40">
        <span className="text-gray-300 text-xs">—</span>
      </td>
    );
  }

  if (isHoliday) {
    return (
      <td className="px-4 py-3 bg-gray-100 border-r border-gray-200 text-center">
        <div className="text-gray-500 text-xs font-medium">Holiday</div>
        {holidayName && <div className="text-xs text-gray-400 mt-0.5">{holidayName}</div>}
      </td>
    );
  }

  const getStatusStyles = () => {
    switch (status) {
      case "on_time": return "bg-emerald-50 hover:bg-emerald-100";
      case "late":    return "bg-amber-50 hover:bg-amber-100";
      case "absent":  return "bg-red-50 hover:bg-red-100";
      default:        return "bg-white hover:bg-gray-50";
    }
  };

  const getDot = () => {
    switch (status) {
      case "on_time": return "bg-emerald-500";
      case "late":    return "bg-amber-500";
      case "absent":  return "bg-red-400";
      default:        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "on_time": return "Present";
      case "late":    return "Late";
      case "absent":  return "Absent";
      default:        return "Mark";
    }
  };

  const dot = getDot();

  return (
    <td
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      className={`px-4 py-3 border-r border-gray-100 text-center cursor-pointer transition-colors ${getStatusStyles()}`}
    >
      <div className="flex items-center justify-center gap-1.5">
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />}
        <span className="text-xs font-medium text-gray-700">{getStatusText()}</span>
      </div>
      {reason && <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[100px] mx-auto">{reason}</div>}
    </td>
  );
};

export default AttendanceCell;







