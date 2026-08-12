import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, List, ExternalLink, CalendarDays, Users, Armchair, HelpCircle } from "lucide-react";

const CalendarToolbar = ({
  title,
  viewMode,            // 'month' | 'week' | 'today'
  onPrev,
  onNext,
  onToday,
  onSetViewMode,
  onOpenCreate,
  publicBookingUrl,
  prevDisabled = false,
  nextDisabled = false,
  // Doctor as a layout axis, not just a filter. The day view has always had
  // one column per doctor; week and month only tinted the cards. focusDoctor
  // is what gives those two an all-doctors and a one-doctor mode.
  doctors = [],
  focusDoctorId = "",
  onSetFocusDoctor,
  // Day view only: columns by person or by room.
  axis = "doctor",
  onSetAxis,
  chairCount = 1,
}) => {
  const iconBtn =
    "p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600";
  const viewBtnBase =
    "px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors";

  return (
    <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
      {/* Left cluster: Today / arrows / title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToday}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Today
        </button>
        <button onClick={onPrev} disabled={prevDisabled} className={iconBtn} aria-label="Previous">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={onNext} disabled={nextDisabled} className={iconBtn} aria-label="Next">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="ml-1 sm:ml-2 text-base sm:text-xl font-bold text-gray-900 truncate">{title}</div>
      </div>

      {/* Right cluster: view toggle / booking / new.
          Wraps rather than clipping. At 768 the Booking Link button used to run
          off the edge of the screen. */}
      <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
        {/* View mode segmented control */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => onSetViewMode("month")}
            className={`${viewBtnBase} ${
              viewMode === "month"
                ? "bg-[#2a276e] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Month</span>
          </button>
          <button
            onClick={() => onSetViewMode("week")}
            className={`${viewBtnBase} ${
              viewMode === "week"
                ? "bg-[#2a276e] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Week</span>
          </button>
          <button
            onClick={() => onSetViewMode("today")}
            className={`${viewBtnBase} ${
              viewMode === "today"
                ? "bg-[#2a276e] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Today</span>
          </button>
        </div>

        {/* Who am I looking at. Kept next to the view toggle because it
            answers the same question the view does, and it persists across
            month, week and day so switching keeps the same subject. */}
        {doctors.length > 0 && (
          <select
            value={focusDoctorId}
            onChange={(e) => onSetFocusDoctor?.(e.target.value)}
            className="h-9 px-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white w-full sm:w-auto sm:max-w-[11rem] order-last sm:order-none"
            aria-label="Which doctor to show"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name || d.email}</option>
            ))}
          </select>
        )}

        {/* Chairs are a different question from people: "which room is free"
            rather than "who is busy". Day view only, where there are columns
            to swap. */}
        {viewMode === "today" && chairCount > 1 && (
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => onSetAxis?.("doctor")}
              title="Columns by doctor"
              className={`${viewBtnBase} ${axis === "doctor" ? "bg-white text-[#2a276e] shadow-sm" : "text-gray-600"}`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">By doctor</span>
            </button>
            <button
              onClick={() => onSetAxis?.("chair")}
              title="Columns by chair"
              className={`${viewBtnBase} ${axis === "chair" ? "bg-white text-[#2a276e] shadow-sm" : "text-gray-600"}`}
            >
              <Armchair className="w-4 h-4" />
              <span className="hidden lg:inline">By chair</span>
            </button>
          </div>
        )}

        {publicBookingUrl && (
          <Link
            to={publicBookingUrl}
            target="_blank"
            className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-semibold"
            title="Public booking link"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden xl:inline">Booking Link</span>
          </Link>
        )}

        <button
          onClick={onOpenCreate}
          className="bg-[#2a276e] text-white px-4 py-2 rounded-lg hover:bg-[#1a1548] transition-colors flex items-center gap-2 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
};

export default CalendarToolbar;
