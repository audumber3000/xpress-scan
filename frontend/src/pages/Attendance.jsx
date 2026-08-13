import React, { useState, useMemo, useEffect } from "react";
import AttendanceHeader from "../components/attendance/AttendanceHeader";
import AttendanceGrid from "../components/attendance/AttendanceGrid";
import EmployeeDetailsPanel from "../components/attendance/EmployeeDetailsPanel";
import AttendanceMarkDrawer from "../components/attendance/AttendanceMarkDrawer";
import AttendanceEmployeeDrawer from "../components/attendance/AttendanceEmployeeDrawer";
import { useHeader } from "../contexts/HeaderContext";
import { api } from "../utils/api";
import TeamTabs from "../components/team/TeamTabs";
import TableToolbar from "../components/common/TableToolbar";

import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, eachDayOfInterval } from "date-fns";
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { notify } from '../utils/notify';

const Attendance = () => {
  const { setTitle } = useHeader();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [searchQuery, setSearchQuery] = useState('');
  const [markDrawer, setMarkDrawer] = useState({ open: false, employee: null, date: null });
  const [savingMark, setSavingMark] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState(null);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
  }, [setTitle, navigate]);

  // Fetch employees and attendance data
  useEffect(() => {
    fetchAttendanceData();
  }, [currentWeekStart]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      
      // Fetch attendance data for the week
      const response = await api.get(`/attendance/week?week_start=${weekStartStr}`);
      
      // Transform data to match component expectations
      const employeesData = response.employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        designation: emp.role, // Use role as designation
        phone: emp.phone || "",
        // Pass the photo through rather than resolving it here — the grid and
        // the details panel both call resolveUserAvatar, and baking a generated
        // URL in at this point would hide a real uploaded one from them.
        avatar_url: emp.avatar_url || null,
        attendance: emp.attendance || {}
      }));
      
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Generate week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    });
  }, [currentWeekStart]);

  // Calculate statistics
  const statistics = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let absent = 0;
    let total = 0;

    employees.forEach((employee) => {
      if (employee.attendance) {
        weekDays.forEach((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const attendance = employee.attendance[dateStr];
          if (attendance) {
            total++;
            if (attendance.status === 'on_time') onTime++;
            else if (attendance.status === 'late') late++;
            else if (attendance.status === 'absent') absent++;
          }
        });
      }
    });

    const totalRecords = total || 1; // Avoid division by zero
    return {
      onTime: Math.round((onTime / totalRecords) * 100),
      late: Math.round((late / totalRecords) * 100),
      absent: Math.round((absent / totalRecords) * 100),
    };
  }, [employees, weekDays]);

  const handleClosePanel = () => {
    setSelectedEmployee(null);
  };

  const handleCellClick = (employee, date) => {
    setMarkDrawer({ open: true, employee, date });
  };

  const handleMarkSave = async ({ employeeId, date, status, reason }) => {
    try {
      setSavingMark(true);
      await api.post('/attendance', {
        user_id: employeeId,
        date: format(date, "yyyy-MM-dd"),
        status,
        reason: reason || null,
      });
      notify.done('Attendance marked');
      setMarkDrawer({ open: false, employee: null, date: null });
      fetchAttendanceData();
    } catch (err) {
      notify.problem('Failed to mark attendance');
    } finally {
      setSavingMark(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  return (
    <TeamTabs active="attendance">
      <TableToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search employees..."
      />

      <>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Week picker + legend */}
        <AttendanceHeader
          currentWeekStart={currentWeekStart}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
          overallStats={statistics}
        />

        {/* Attendance Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#29828a] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading attendance data...</p>
                </div>
              </div>
            ) : (
              <AttendanceGrid
                employees={filteredEmployees}
                weekDays={weekDays}
                onEmployeeProfileClick={setProfileEmployee}
                onCellClick={handleCellClick}
              />
            )}
          </div>
        </div>

        {/* Employee Attendance History Drawer */}
        {profileEmployee && (
          <AttendanceEmployeeDrawer
            employee={profileEmployee}
            onClose={() => setProfileEmployee(null)}
          />
        )}

        {/* Mark Attendance Drawer */}
        {markDrawer.open && (
          <AttendanceMarkDrawer
            employee={markDrawer.employee}
            date={markDrawer.date}
            currentAttendance={
              markDrawer.employee?.attendance?.[format(markDrawer.date, 'yyyy-MM-dd')] || null
            }
            onClose={() => setMarkDrawer({ open: false, employee: null, date: null })}
            onSave={handleMarkSave}
            saving={savingMark}
          />
        )}
        </div>
      </>
    </TeamTabs>
  );
};

export default Attendance;
