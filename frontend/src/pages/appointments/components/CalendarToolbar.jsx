import React from "react";
import { Link } from "react-router-dom";
import useNow from "../hooks/useNow";
import {
  ChevronLeft, ChevronRight, Plus, LayoutGrid, List, ExternalLink,
  CalendarDays, Users, Armchair, Search, X,
  PanelRightOpen, PanelLeftOpen, AlertTriangle,
} from "lucide-react";

/**
 * One row that answers three questions, in this order: where am I, what am I
 * looking at, and what can I do.
 *
 * It used to be eleven separately bordered controls in a line, each drawing as
 * much attention as the next, so nothing read as primary and the row ran out of
 * width. Three things fixed that:
 *
 *   1. Related controls share one border instead of each having their own, so
 *      the eye sees three groups rather than eleven pills.
 *   2. Anything whose icon is unambiguous drops its label. "Booking Link",
 *      "Filters" and "Day list" were spending real estate on words that the
 *      icon plus a tooltip already carry.
 *   3. The clock sits under the title rather than beside it, which costs no
 *      horizontal space at all.
 *
 * The day view is labelled "Day", not "Today". It used to be "Today", which
 * collided with the Today button two controls to its left: one jumps to now,
 * the other changes the view, and they are not the same thing.
 */

// One height and one radius for every control, so the row reads as a row.
const CTL = "h-9 rounded-lg border border-gray-200 text-sm transition-colors";
const ICON_BTN = `${CTL} w-9 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300`;
const SEG = "px-2.5 h-7 rounded-md inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors";

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
  doctorsError = '',
  focusDoctorId = "",
  onSetFocusDoctor,
  // Day view only: columns by person or by room.
  axis = "doctor",
  onSetAxis,
  chairCount = 1,
  showDayRail = true,
  onShowDayRail,
  showSidePanel = true,
  onShowSidePanel,
  // Past appointments nobody closed off. A count and a way in, rather than a
  // banner that pushed the grid down the page every day.
  attentionCount = 0,
  onShowAttention,
  query = '',
  onQueryChange,
}) => {
  // Ticks on the minute. A clinic screen is open all day and "now" is the one
  // thing on it that is always changing.
  const now = useNow();

  const view = (key, Icon, label) => (
    <button
      onClick={() => onSetViewMode(key)}
      className={`${SEG} ${
        viewMode === key ? "bg-[#2a276e] text-white" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">

      {/* ── Where am I ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Arrows and Today are one control: all three move the same thing. */}
        <div className="flex items-center h-9 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          <button onClick={onPrev} disabled={prevDisabled} aria-label="Previous"
                  className="w-8 h-full inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onToday}
                  className="px-3 h-full text-[13px] font-semibold text-gray-700 border-x border-gray-200 hover:bg-gray-50 transition-colors">
            Today
          </button>
          <button onClick={onNext} disabled={nextDisabled} aria-label="Next"
                  className="w-8 h-full inline-flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* The clock lives under the title, which costs no width. */}
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] sm:text-[17px] font-bold text-gray-900 truncate">{title}</div>
          <div className="text-[11px] text-gray-400 tabular-nums truncate">
            {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}
            {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ── What am I looking at, and what can I do ─────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder="Find a patient"
            aria-label="Find a patient on the calendar"
            className={`${CTL} w-36 xl:w-44 pl-8 pr-7 outline-none focus:border-[#2a276e]`}
          />
          {query && (
            <button onClick={() => onQueryChange?.('')} aria-label="Clear the search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-700">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {attentionCount > 0 && (
          <button
            onClick={onShowAttention}
            title={`${attentionCount} past appointments were never closed off`}
            className="h-9 px-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="tabular-nums">{attentionCount}</span>
          </button>
        )}

        {/* View. Day, not Today: the button on the far left is "Today". */}
        <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg h-9">
          {view("month", CalendarDays, "Month")}
          {view("week", LayoutGrid, "Week")}
          {view("today", List, "Day")}
        </div>

        {/* Chairs are a different question from people: "which room is free"
            rather than "who is busy". Day view only, where there are columns
            to swap. */}
        {viewMode === "today" && chairCount > 1 && (
          <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg h-9">
            <button onClick={() => onSetAxis?.("doctor")} title="Columns by doctor"
                    className={`${SEG} ${axis === "doctor" ? "bg-white text-[#2a276e]" : "text-gray-600"}`}>
              <Users className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onSetAxis?.("chair")} title="Columns by chair"
                    className={`${SEG} ${axis === "chair" ? "bg-white text-[#2a276e]" : "text-gray-600"}`}>
              <Armchair className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Says why the picker is missing rather than just omitting it. An
            empty doctor list used to render nothing at all, so a failed
            request and a clinic with no doctors looked identical. */}
        {doctors.length === 0 && doctorsError && (
          <span
            className="inline-flex items-center h-8 px-2.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100"
            title={doctorsError}
          >
            Doctor list unavailable
          </span>
        )}

        {doctors.length > 0 && (
          <select
            value={focusDoctorId}
            onChange={(e) => onSetFocusDoctor?.(e.target.value)}
            className={`${CTL} px-2.5 font-medium text-gray-700 bg-white max-w-[10rem]`}
            aria-label="Which doctor to show"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name || d.email}</option>
            ))}
          </select>
        )}

        {/* Icon only. The label was spending width on something the tooltip
            already says, and these three are rarely used. */}
        {!showSidePanel && (
          <button onClick={onShowSidePanel} className={ICON_BTN}
                  title="Show the mini-calendar and team filters"
                  aria-label="Show the mini-calendar and team filters">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {!showDayRail && (
          <button onClick={onShowDayRail} className={ICON_BTN}
                  title="Show the day list" aria-label="Show the day list">
            <PanelRightOpen className="w-4 h-4" />
          </button>
        )}

        {publicBookingUrl && (
          <Link to={publicBookingUrl} target="_blank" className={ICON_BTN}
                title="Open the public booking page" aria-label="Open the public booking page">
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}

        <button
          onClick={onOpenCreate}
          className="h-9 px-3.5 rounded-lg bg-[#2a276e] text-white hover:bg-[#1a1548] transition-colors inline-flex items-center gap-1.5 text-sm font-semibold flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
};

export default CalendarToolbar;
