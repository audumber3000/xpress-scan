import React from "react";

const AttendanceCell = ({ status, reason, isHoliday, holidayName }) => {
  if (isHoliday) {
    return (
      <td className="px-4 py-3 bg-gray-100 border-r border-gray-200 text-center">
        <div className="text-gray-600 text-sm font-medium">Holiday</div>
        {holidayName && (
          <div className="text-xs text-gray-500 mt-1">--- ({holidayName})</div>
        )}
      </td>
    );
  }

  const getStatusStyles = () => {
    switch (status) {
      case "on_time":
        return "bg-[#9B8CFF]/20 text-gray-900";
      case "late":
        return "bg-yellow-100 text-gray-900";
      case "absent":
        return "bg-red-100 text-gray-900";
      default:
        return "bg-white text-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "on_time":
        return "On time";
      case "late":
        return "Late";
      case "absent":
        return "Absent";
      default:
        return "---";
    }
  };

  return (
    <td className={`px-4 py-3 border-r border-gray-200 text-center ${getStatusStyles()}`}>
      <div className="text-sm font-medium">{getStatusText()}</div>
      {reason && (
        <div className="text-xs text-gray-600 mt-1">({reason})</div>
      )}
    </td>
  );
};

export default AttendanceCell;







