import React from "react";
import Toggle from "../common/Toggle";

/**
 * Lets the user enter EITHER an age OR a date of birth, switched with a real
 * toggle. When a DOB is entered we show the derived age inline.
 *
 * It used to be two 11px segmented buttons. Nobody read them as a control, and
 * receptionists who wanted a date of birth typed the year into the age box
 * instead. A switch reads as a switch.
 *
 * Controlled via the parent's `age` and `dob` values; emits changes through
 * `onAgeChange` / `onDobChange`. `mode` + `onModeChange` control which input
 * is visible so the parent can persist the choice (e.g. when editing).
 */
export const computeAgeFromDob = (dob) => {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 150 ? age : "";
};

const AgeOrDobField = ({
  mode,
  onModeChange,
  age,
  onAgeChange,
  dob,
  onDobChange,
  error,
  inputClass,
}) => {
  const baseInput =
    inputClass ||
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]";
  const derivedAge = mode === "dob" ? computeAgeFromDob(dob) : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {mode === "dob" ? "Date of Birth" : "Age"} <span className="text-red-500">*</span>
        </label>
        {/* Labelled by what turning it on does, not by the state it is in, so
            the switch never has to be read backwards. */}
        <Toggle
          checked={mode === "dob"}
          onChange={(on) => onModeChange(on ? "dob" : "age")}
          label="Use date of birth"
        />
      </div>

      {mode === "dob" ? (
        <>
          <input
            type="date"
            value={dob || ""}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => onDobChange(e.target.value)}
            className={baseInput}
          />
          {derivedAge !== "" && (
            <p className="mt-1 text-xs text-gray-500">Age: {derivedAge} years</p>
          )}
        </>
      ) : (
        <input
          type="number"
          min="0"
          max="150"
          value={age ?? ""}
          onChange={(e) => onAgeChange(e.target.value)}
          placeholder="Enter age"
          className={baseInput}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default AgeOrDobField;
