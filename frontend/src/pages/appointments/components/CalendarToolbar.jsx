import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, List, ExternalLink, CalendarDays } from "lucide-react";

const CalendarToolbar = ({
  title,
  viewMode,            // 'week' | 'today'
  onPrev,
  onNext,
  onToday,
  onSetViewMode,
  onOpenCreate,
  publicBookingUrl,
  prevDisabled = false,
  nextDisabled = false,
}) => {
  const iconBtn =
    "p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600";
  const viewBtnBase =
    "px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors";

  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      {/* Left cluster: Today / arrows / title */}
      <div className="flex items-center gap-2">
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
        <div className="ml-2 text-xl font-bold text-gray-900">{title}</div>
      </div>

      {/* Right cluster: view toggle / booking / new */}
      <div className="flex items-center gap-3">
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
            Month
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
            Week
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
            Today
          </button>
        </div>

        {publicBookingUrl && (
          <Link
            to={publicBookingUrl}
            target="_blank"
            className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            Booking Link
          </Link>
        )}

        <button
          onClick={onOpenCreate}
          className="bg-[#2a276e] text-white px-4 py-2 rounded-lg hover:bg-[#1a1548] transition-colors flex items-center gap-2 text-sm font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
};

export default CalendarToolbar;
