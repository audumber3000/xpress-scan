import React from "react";
import { getDoctorColor, UNASSIGNED_STYLE } from "../utils/doctorColors";

const Row = ({ checked, onToggle, swatch, dot, name, count, warning }) => (
  <label className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="w-4 h-4 rounded border-gray-300 text-[#2a276e] focus:ring-[#2a276e]"
    />
    <span className={`w-6 h-4 rounded border ${swatch}`}>
      <span className={`block w-full h-full rounded ${dot} opacity-80`}></span>
    </span>
    <span className={`flex-1 text-sm ${warning ? "text-amber-800 font-medium" : "text-gray-800"} truncate`}>
      {name}
    </span>
    {typeof count === "number" && (
      <span className={`text-xs px-2 py-0.5 rounded-full ${warning ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
        {count}
      </span>
    )}
  </label>
);

const TeamMembersPanel = ({
  doctors,
  countsByDoctorId,
  unassignedCount,
  selectedDoctorIds,
  showUnassigned,
  onToggleDoctor,
  onToggleUnassigned,
  onToggleAll,
  header = null, // optional slot for the mini calendar (rendered above the team list)
}) => {
  const allOn =
    showUnassigned &&
    doctors.every((d) => selectedDoctorIds.has(d.id));

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white h-full flex flex-col">
      {header}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Team members</h3>
        <button
          onClick={onToggleAll}
          className="text-xs text-[#2a276e] hover:text-[#1a1548] font-semibold"
        >
          {allOn ? "Hide all" : "Show all"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {doctors.length === 0 && (
          <p className="text-xs text-gray-500 px-2 py-3">
            No doctors in this clinic yet.
          </p>
        )}

        {doctors.map((doc) => {
          const color = getDoctorColor(doc.id);
          return (
            <Row
              key={doc.id}
              checked={selectedDoctorIds.has(doc.id)}
              onToggle={() => onToggleDoctor(doc.id)}
              swatch={color.swatch}
              dot={color.dot}
              name={doc.name || doc.email || `Doctor #${doc.id}`}
              count={countsByDoctorId[doc.id] || 0}
            />
          );
        })}

        <div className="mt-3 pt-3 border-t border-gray-100">
          <Row
            checked={showUnassigned}
            onToggle={onToggleUnassigned}
            swatch={UNASSIGNED_STYLE.swatch}
            dot={UNASSIGNED_STYLE.dot}
            name="Unassigned"
            count={unassignedCount}
            warning
          />
          {unassignedCount > 0 && (
            <p className="text-[11px] text-amber-700 px-2 mt-1 leading-snug">
              {unassignedCount} booking{unassignedCount === 1 ? "" : "s"} need{unassignedCount === 1 ? "s" : ""} a doctor assigned.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default TeamMembersPanel;
