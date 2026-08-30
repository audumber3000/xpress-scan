import React, { useState, useMemo, useEffect, useCallback } from "react";
import AttendanceHeader from "../components/attendance/AttendanceHeader";
import AttendanceGrid from "../components/attendance/AttendanceGrid";
import AttendanceMarkDrawer from "../components/attendance/AttendanceMarkDrawer";
import AttendanceEmployeeDrawer from "../components/attendance/AttendanceEmployeeDrawer";
import AttendanceExportModal from "../components/attendance/AttendanceExportModal";
import { useHeader } from "../contexts/HeaderContext";
import { api } from "../utils/api";
import TeamTabs from "../components/team/TeamTabs";
import TableToolbar from "../components/common/TableToolbar";

import {
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  format, parseISO,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { notify } from "../utils/notify";

/**
 * The attendance register.
 *
 * One period at a time, a week or a month, both served by /attendance/calendar
 * so the two views can never disagree about what a day says. The period is held
 * as a single anchor date plus a view mode rather than as two separate cursors:
 * switching from week to month keeps you looking at the same part of the year,
 * which is what you expect when you have just found the week you were after.
 */

const ISO = "yyyy-MM-dd";

const Attendance = () => {
  const { setTitle } = useHeader();
  const navigate = useNavigate();

  const [view, setView] = useState("week");          // "week" | "month"
  const [anchor, setAnchor] = useState(new Date());  // any day inside the period
  const [employees, setEmployees] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [markDrawer, setMarkDrawer] = useState({ open: false, employee: null, dateKey: null });
  const [savingMark, setSavingMark] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
  }, [setTitle, navigate]);

  // The period the anchor sits in. Weeks start Monday, which is how a clinic
  // rota is read; date-fns defaults to Sunday, so it is set explicitly.
  const { start, end, label } = useMemo(() => {
    if (view === "month") {
      return {
        start: startOfMonth(anchor),
        end: endOfMonth(anchor),
        label: format(anchor, "MMMM yyyy"),
      };
    }
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor, { weekStartsOn: 1 });
    const sameMonth = format(s, "MMM") === format(e, "MMM");
    return {
      start: s,
      end: e,
      label: sameMonth
        ? `${format(s, "d")} – ${format(e, "d MMM yyyy")}`
        : `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`,
    };
  }, [view, anchor]);

  const startKey = format(start, ISO);
  const endKey = format(end, ISO);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const res = await api.get(`/attendance/calendar?start=${startKey}&end=${endKey}`);
      setEmployees(res.employees || []);
      setDays(res.days || []);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setEmployees([]);
      setDays([]);
      // Tier 3: the section says it failed and offers a retry, rather than
      // rendering an empty grid that reads as "nobody works here".
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [startKey, endKey]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // Totals across everyone on screen. Counts, not percentages: the old header
  // showed "on time 67%" of marked days, which quietly changed meaning every
  // time somebody marked one more day.
  const stats = useMemo(() => {
    const seed = { present: 0, late: 0, absent: 0 };
    return employees.reduce((acc, e) => ({
      present: acc.present + (e.summary?.present || 0),
      late: acc.late + (e.summary?.late || 0),
      absent: acc.absent + (e.summary?.absent || 0),
    }), seed);
  }, [employees]);

  const step = (direction) => {
    const move = view === "month"
      ? (direction > 0 ? addMonths : subMonths)
      : (direction > 0 ? addWeeks : subWeeks);
    setAnchor((prev) => move(prev, 1));
  };

  const handleMarkSave = async ({ employeeId, dateKey, status, reason }) => {
    try {
      setSavingMark(true);
      await api.post("/attendance", {
        user_id: employeeId,
        date: dateKey,
        status,
        reason: reason || null,
      });
      setMarkDrawer({ open: false, employee: null, dateKey: null });
      await fetchAttendance();
    } catch (err) {
      notify.problem(err, "Failed to mark attendance");
    } finally {
      setSavingMark(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      e.name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.role?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // The drawer needs the record for the cell that was clicked. Read off the
  // freshly fetched employee rather than the one captured when the cell was
  // clicked, so a save that changes the day is reflected without reopening.
  const drawerDay = useMemo(() => {
    if (!markDrawer.open) return null;
    const emp = employees.find((e) => e.id === markDrawer.employee?.id);
    return emp?.attendance?.[markDrawer.dateKey] || null;
  }, [markDrawer, employees]);

  return (
    <TeamTabs active="attendance">
      <TableToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search employees..."
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AttendanceHeader
          periodLabel={label}
          view={view}
          onViewChange={setView}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
          onToday={() => setAnchor(new Date())}
          onExport={() => setExportOpen(true)}
          stats={stats}
        />

        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#29828a] mx-auto" />
                  <p className="mt-4 text-gray-600">Loading attendance...</p>
                </div>
              </div>
            ) : loadFailed ? (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-600">Could not load attendance for this period.</p>
                <button
                  onClick={fetchAttendance}
                  className="mt-3 px-4 py-2 text-sm font-semibold text-white bg-[#29828a] hover:bg-[#216b71] rounded-lg transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : (
              <AttendanceGrid
                employees={filteredEmployees}
                days={days}
                view={view}
                onEmployeeProfileClick={setProfileEmployee}
                onCellClick={(employee, dateKey) =>
                  setMarkDrawer({ open: true, employee, dateKey })
                }
              />
            )}
          </div>
        </div>

        {profileEmployee && (
          <AttendanceEmployeeDrawer
            employee={profileEmployee}
            onClose={() => setProfileEmployee(null)}
          />
        )}

        {markDrawer.open && (
          <AttendanceMarkDrawer
            employee={markDrawer.employee}
            date={parseISO(markDrawer.dateKey)}
            currentAttendance={drawerDay}
            onClose={() => setMarkDrawer({ open: false, employee: null, dateKey: null })}
            onSave={({ employeeId, status, reason }) =>
              handleMarkSave({ employeeId, dateKey: markDrawer.dateKey, status, reason })
            }
            saving={savingMark}
          />
        )}
      </div>

      <AttendanceExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultStart={startKey}
        defaultEnd={endKey}
        employees={employees}
      />
    </TeamTabs>
  );
};

export default Attendance;
