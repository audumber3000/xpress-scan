import React from "react";
import AttendanceCell from "./AttendanceCell";
import { resolveUserAvatar } from "../../utils/avatar";

/**
 * The register: employees down, days across.
 *
 * One grid for both views rather than a week component and a month component.
 * They differ in how many columns there are and how much each cell can say,
 * which is two props, not two files — and a second file is how the month view
 * ends up quietly disagreeing with the week about what "late" means.
 */

const fmtDuration = (minutes) => {
  if (!minutes) return "0h 00m";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

const AttendanceGrid = ({
  employees,
  days,              // ["YYYY-MM-DD", ...] straight from the API
  view = "week",     // "week" | "month"
  onEmployeeProfileClick,
  onCellClick,
}) => {
  const dense = view === "month";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Parsed from the key rather than from a Date the caller passes in, so the
  // column header can never drift from the data keyed under it.
  const headerFor = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString("en-US", { weekday: dense ? "narrow" : "long" });
    return { day: d, weekday, isWeekend: date.getDay() === 0 || date.getDay() === 6 };
  };

  if (!employees.length) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-500">No employees match this view.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-100 sticky left-0 bg-gray-50 z-20 min-w-[200px]">
                Employee
              </th>
              {days.map((key) => {
                const { day, weekday, isWeekend } = headerFor(key);
                const isToday = key === todayKey;
                return (
                  <th
                    key={key}
                    className={`py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-gray-100 ${
                      dense ? "px-1 min-w-[34px]" : "px-3 min-w-[120px]"
                    } ${isToday ? "text-[#29828a]" : isWeekend ? "text-gray-400" : "text-gray-500"}`}
                  >
                    <span className={`block ${dense ? "text-[11px]" : "text-sm"} ${isToday ? "font-bold" : ""}`}>
                      {day}
                    </span>
                    <span className="block text-[9px] font-normal normal-case">{weekday}</span>
                  </th>
                );
              })}
              {/* Totals belong on the row they total, not in a separate report.
                  This is the column an owner actually opens the screen for at
                  the end of a month. */}
              <th className="px-3 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[80px]">
                Present
              </th>
              <th className="px-3 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[90px]">
                Hours
              </th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {employees.map((employee) => (
              <tr key={employee.id} className="border-t border-gray-100">
                <td
                  onClick={() => onEmployeeProfileClick?.(employee)}
                  className="px-6 py-3 border-r border-gray-100 sticky left-0 bg-white hover:bg-gray-50 z-10 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gray-100">
                      <img
                        src={resolveUserAvatar(employee, 36)}
                        alt={employee.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{employee.name}</div>
                      {employee.role && (
                        <div className="text-xs text-gray-500 capitalize truncate">{employee.role}</div>
                      )}
                    </div>
                  </div>
                </td>

                {days.map((key) => {
                  const day = employee.attendance?.[key];
                  // null from the API means the day has not happened yet.
                  const isFuture = day === null || day === undefined;
                  return (
                    <AttendanceCell
                      key={key}
                      day={day}
                      isFuture={isFuture}
                      dense={dense}
                      onClick={isFuture ? undefined : () => onCellClick?.(employee, key)}
                    />
                  );
                })}

                <td className="px-3 py-3 text-center bg-gray-50/60 text-sm font-semibold text-gray-700 tabular-nums">
                  {employee.summary?.present ?? 0}
                  <span className="text-gray-400 font-normal">/{employee.summary?.marked_days ?? 0}</span>
                </td>
                <td className="px-3 py-3 text-center bg-gray-50/60 text-sm font-semibold text-gray-700 tabular-nums">
                  {fmtDuration(employee.summary?.worked_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceGrid;
