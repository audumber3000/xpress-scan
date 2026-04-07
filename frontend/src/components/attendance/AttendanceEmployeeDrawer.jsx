import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../utils/api";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval,
  isSameMonth, isToday, isFuture, getDay, addMonths, subMonths,
  addYears, subYears, addWeeks, subWeeks
} from "date-fns";

const STATUS_CONFIG = {
  on_time: { label: "Present", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  late:    { label: "Late",    dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  absent:  { label: "Absent",  dot: "bg-red-400",     badge: "bg-red-50 text-red-700 border-red-200" },
};

const initials = (name) => name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

/* ─── helpers ─── */
const statusOf = (rec) => {
  if (!rec || !rec.status) return null;
  return rec.status;
};

const DayDot = ({ status, isToday: today, isFuture: future, size = "md" }) => {
  const sz = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  if (future) return <div className={`${sz} rounded-full bg-gray-100 flex items-center justify-center text-gray-300`}>–</div>;
  if (!status) return <div className={`${sz} rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300`}></div>;
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold ${
      today ? "ring-2 ring-offset-1 ring-[#2D9596]" : ""
    } ${
      status === "on_time" ? "bg-emerald-100 text-emerald-700" :
      status === "late"    ? "bg-amber-100 text-amber-700" :
                             "bg-red-100 text-red-600"
    }`}>
      {status === "on_time" ? "✓" : status === "late" ? "!" : "✕"}
    </div>
  );
};

/* ─── Week View ─── */
const WeekView = ({ records, weekStart }) => {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  return (
    <div className="space-y-2">
      {days.map(day => {
        const key = format(day, "yyyy-MM-dd");
        const rec = records[key];
        const status = statusOf(rec);
        const future = isFuture(day) && !isToday(day);
        const cfg = status ? STATUS_CONFIG[status] : null;
        return (
          <div key={key} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
            future ? "bg-gray-50/50 border-gray-100 opacity-50" :
            !status ? "bg-white border-gray-100" :
            status === "on_time" ? "bg-emerald-50/60 border-emerald-100" :
            status === "late"    ? "bg-amber-50/60 border-amber-100" :
                                   "bg-red-50/60 border-red-100"
          }`}>
            <div>
              <p className="text-sm font-semibold text-gray-800">{format(day, "EEEE")}</p>
              <p className="text-xs text-gray-400">{format(day, "d MMM")}{isToday(day) ? " · Today" : ""}</p>
            </div>
            {future ? (
              <span className="text-xs text-gray-400">—</span>
            ) : !status ? (
              <span className="text-xs text-gray-400 italic">Not marked</span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>{cfg.label}</span>
                {rec?.reason && <span className="text-[10px] text-gray-400">{rec.reason}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── Month View ─── */
const MonthView = ({ records, month }) => {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const startDow = (getDay(start) + 6) % 7; // Mon=0
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const rec = records[key];
          const status = statusOf(rec);
          const future = isFuture(day) && !isToday(day);
          return (
            <div key={key} className="flex flex-col items-center gap-0.5 py-1">
              <DayDot status={status} isToday={isToday(day)} isFuture={future} size="sm" />
              <span className={`text-[9px] font-medium ${isToday(day) ? "text-[#2D9596]" : "text-gray-400"}`}>
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 justify-center">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${v.dot}`} />
            <span className="text-[10px] text-gray-500">{v.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border-2 border-dashed border-gray-300" />
          <span className="text-[10px] text-gray-500">Not marked</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Year View ─── */
const YearView = ({ records, year }) => {
  const months = eachMonthOfInterval({
    start: startOfYear(year),
    end: endOfYear(year),
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {months.map(month => {
        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
        let present = 0, late = 0, absent = 0, total = 0;
        days.forEach(day => {
          if (isFuture(day) && !isToday(day)) return;
          const key = format(day, "yyyy-MM-dd");
          const status = statusOf(records[key]);
          if (!status) return;
          total++;
          if (status === "on_time") present++;
          else if (status === "late") late++;
          else if (status === "absent") absent++;
        });
        const pct = total > 0 ? Math.round(((present + late) / total) * 100) : null;
        return (
          <div key={month.toString()} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">{format(month, "MMMM")}</span>
              {pct !== null && (
                <span className={`text-xs font-semibold ${pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-500"}`}>{pct}%</span>
              )}
            </div>
            {total === 0 ? (
              <p className="text-[10px] text-gray-400 italic">No data</p>
            ) : (
              <>
                <div className="flex gap-3 text-[10px] text-gray-500 mb-2">
                  <span className="text-emerald-600 font-semibold">{present}P</span>
                  <span className="text-amber-600 font-semibold">{late}L</span>
                  <span className="text-red-500 font-semibold">{absent}A</span>
                  <span className="text-gray-400">/{total}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-400 h-full" style={{ width: `${(present / total) * 100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${(late / total) * 100}%` }} />
                  <div className="bg-red-400 h-full" style={{ width: `${(absent / total) * 100}%` }} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── Main Drawer ─── */
const AttendanceEmployeeDrawer = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState("week");
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMonth, setViewMonth] = useState(new Date());
  const [viewYear, setViewYear] = useState(new Date());

  useEffect(() => {
    if (!employee) return;
    const fetchRange = async () => {
      setLoading(true);
      try {
        let start, end;
        if (activeTab === "week") {
          start = weekStart;
          end = endOfWeek(weekStart, { weekStartsOn: 1 });
        } else if (activeTab === "month") {
          start = startOfMonth(viewMonth);
          end = endOfMonth(viewMonth);
        } else {
          start = startOfYear(viewYear);
          end = endOfYear(viewYear);
        }
        const data = await api.get(
          `/attendance?start_date=${format(start, "yyyy-MM-dd")}&end_date=${format(end, "yyyy-MM-dd")}&user_id=${employee.id}`
        );
        const map = {};
        (Array.isArray(data) ? data : []).forEach(rec => {
          const key = format(new Date(rec.date), "yyyy-MM-dd");
          map[key] = { status: rec.status, reason: rec.reason || "" };
        });
        setRecords(map);
      } catch (e) {
        setRecords({});
      } finally {
        setLoading(false);
      }
    };
    fetchRange();
  }, [employee, activeTab, weekStart, viewMonth, viewYear]);

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    Object.values(records).forEach(r => {
      if (!r?.status) return;
      if (r.status === "on_time") present++;
      else if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
    });
    return { present, late, absent, total: present + late + absent };
  }, [records]);

  if (!employee) return null;

  const TABS = [
    { key: "week",  label: "This Week" },
    { key: "month", label: "Month" },
    { key: "year",  label: "Year" },
  ];

  const NavBar = () => {
    if (activeTab === "week") {
      return (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <ChevronLeft size={15} className="text-gray-600" />
          </button>
          <span className="text-xs font-semibold text-gray-600">
            {format(weekStart, "d MMM")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM yyyy")}
          </span>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <ChevronRight size={15} className="text-gray-600" />
          </button>
        </div>
      );
    }
    if (activeTab === "month") {
      return (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <ChevronLeft size={15} className="text-gray-600" />
          </button>
          <span className="text-xs font-semibold text-gray-600">{format(viewMonth, "MMMM yyyy")}</span>
          <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <ChevronRight size={15} className="text-gray-600" />
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
        <button onClick={() => setViewYear(subYears(viewYear, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
          <ChevronLeft size={15} className="text-gray-600" />
        </button>
        <span className="text-xs font-semibold text-gray-600">{format(viewYear, "yyyy")}</span>
        <button onClick={() => setViewYear(addYears(viewYear, 1))} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
          <ChevronRight size={15} className="text-gray-600" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#E0F2F2] flex items-center justify-center text-[#2D9596] font-bold text-sm shrink-0">
              {initials(employee.name)}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{employee.name}</p>
              <p className="text-xs text-gray-500 capitalize">{employee.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "Present", value: stats.present, color: "text-emerald-600" },
            { label: "Late",    value: stats.late,    color: "text-amber-600" },
            { label: "Absent",  value: stats.absent,  color: "text-red-500" },
          ].map(s => (
            <div key={s.label} className="py-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-[#2D9596] text-[#2D9596]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Nav bar (date navigation) */}
        <NavBar />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#2D9596] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === "week" ? (
            <WeekView records={records} weekStart={weekStart} />
          ) : activeTab === "month" ? (
            <MonthView records={records} month={viewMonth} />
          ) : (
            <YearView records={records} year={viewYear} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceEmployeeDrawer;
