import React from "react";
import AttendanceCell from "./AttendanceCell";

const AttendanceGrid = ({ employees, weekDays, onEmployeeClick }) => {
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const formatDayHeader = (date) => {
    const day = date.getDate();
    const dayName = getDayName(date);
    return `${day} ${dayName}`;
  };

  const getEmployeeAttendance = (employeeId, date) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee || !employee.attendance) return null;
    
    const dateStr = date.toISOString().split('T')[0];
    return employee.attendance[dateStr] || null;
  };

  const isHoliday = (date) => {
    // Check if date is a holiday (you can expand this logic)
    const holidays = [
      '2024-09-25', // Example holiday
    ];
    return holidays.includes(date.toISOString().split('T')[0]);
  };

  const getHolidayName = (date) => {
    const holidays = {
      '2024-09-25': 'Annual Book Fair',
    };
    return holidays[date.toISOString().split('T')[0]] || null;
  };

  const defaultAvatar = (name) => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=E5E7EB&color=374151&size=40&rounded=true&bold=true`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[200px]">
              Employee Profile
            </th>
            {weekDays.map((date, index) => (
              <th
                key={index}
                className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[140px]"
              >
                {formatDayHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr
              key={employee.id}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onEmployeeClick(employee)}
            >
              {/* Employee Profile Cell */}
              <td className="px-4 py-3 border-r border-gray-200 sticky left-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <img
                    src={employee.avatar || defaultAvatar(employee.name)}
                    alt={employee.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{employee.name}</div>
                    {employee.designation && (
                      <div className="text-xs text-gray-500">{employee.designation}</div>
                    )}
                  </div>
                </div>
              </td>

              {/* Attendance Cells */}
              {weekDays.map((date, dayIndex) => {
                const attendance = getEmployeeAttendance(employee.id, date);
                const holiday = isHoliday(date);
                const holidayName = getHolidayName(date);

                return (
                  <AttendanceCell
                    key={dayIndex}
                    status={attendance?.status}
                    reason={attendance?.reason}
                    isHoliday={holiday}
                    holidayName={holidayName}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceGrid;


