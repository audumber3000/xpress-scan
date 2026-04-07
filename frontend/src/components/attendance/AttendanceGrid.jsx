import React from "react";
import AttendanceCell from "./AttendanceCell";
import { format } from "date-fns";

const AttendanceGrid = ({ employees, weekDays, onEmployeeProfileClick, onCellClick }) => {
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
    
    const dateStr = format(date, 'yyyy-MM-dd'); // local date, not UTC
    const val = employee.attendance[dateStr];
    return val !== undefined ? val : null;
  };

  const isHoliday = (date) => {
    // Check if date is a holiday (you can expand this logic)
    const holidays = [
      '2024-09-25', // Example holiday
    ];
    return holidays.includes(format(date, 'yyyy-MM-dd'));
  };

  const getHolidayName = (date) => {
    const holidays = {
      '2024-09-25': 'Annual Book Fair',
    };
    return holidays[format(date, 'yyyy-MM-dd')] || null;
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
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-100 sticky left-0 bg-gray-50 z-20 min-w-[220px]">
                  Employee Profile
                </th>
                {weekDays.map((date, index) => (
                  <th
                    key={index}
                    className="px-4 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-100 min-w-[140px]"
                  >
                    {formatDayHeader(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
          {employees.map((employee, empIndex) => (
            <tr
              key={employee.id}
              className="border-t border-gray-100"
            >
              {/* Employee Profile Cell — click opens attendance history drawer */}
              <td
                onClick={() => onEmployeeProfileClick && onEmployeeProfileClick(employee)}
                className="px-6 py-4 border-r border-gray-100 sticky left-0 bg-white hover:bg-gray-50 z-10 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#E0F2F2] flex items-center justify-center text-[#2D9596] font-semibold text-sm">
                    {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{employee.name}</div>
                    {employee.designation && (
                      <div className="text-xs text-gray-500 capitalize">{employee.designation}</div>
                    )}
                  </div>
                </div>
              </td>

              {/* Attendance Cells */}
              {weekDays.map((date, dayIndex) => {
                const attendance = getEmployeeAttendance(employee.id, date);
                const holiday = isHoliday(date);
                const holidayName = getHolidayName(date);
                // attendance === null means future date — show as disabled
                const isFutureDate = attendance === null;

                return (
                  <AttendanceCell
                    key={dayIndex}
                    status={attendance?.status}
                    reason={attendance?.reason}
                    isHoliday={holiday}
                    holidayName={holidayName}
                    isFuture={isFutureDate}
                    onClick={isFutureDate ? undefined : () => onCellClick && onCellClick(employee, date)}
                  />
                );
              })}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

export default AttendanceGrid;







