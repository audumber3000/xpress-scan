import React from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

/**
 * Period navigation, the week/month switch, and the legend.
 *
 * The switch drives what the page asks the API for, so the same two arrows step
 * a week or a month depending on which is selected. Keeping one pair of arrows
 * rather than two sets is deliberate: the control the eye lands on is the
 * period label between them, and that label always says exactly what is on
 * screen.
 */

const VIEWS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const LEGEND = [
  { dot: "bg-emerald-500", label: "Present" },
  { dot: "bg-amber-500", label: "Late" },
  { dot: "bg-red-400", label: "Absent" },
  { dot: "bg-gray-400", label: "Holiday" },
];

const AttendanceHeader = ({
  periodLabel,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onExport,
  stats,
}) => (
  <div className="bg-white border-b border-gray-200 p-4">
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`px-3.5 py-2 text-sm font-semibold transition-colors ${
                view === v.id
                  ? "bg-[#29828a] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={`Previous ${view}`}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={onToday}
            className="px-4 py-2 min-w-[190px] bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
            title="Jump to today"
          >
            {periodLabel}
          </button>
          <button
            onClick={onNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={`Next ${view}`}
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={15} />
          Export
        </button>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
            <span className="text-xs text-gray-600">{l.label}</span>
          </div>
        ))}
        {/* Counts, not percentages. "3 late" is a number somebody can act on;
            "12% late" needs the denominator explained before it means anything. */}
        {stats && (
          <span className="text-xs text-gray-500 border-l border-gray-200 pl-5">
            {stats.present} present · {stats.late} late · {stats.absent} absent
          </span>
        )}
      </div>
    </div>
  </div>
);

export default AttendanceHeader;
