import React from 'react';

/**
 * A switch.
 *
 * The pattern it replaces was a pair of tiny segmented buttons, which reads as
 * two things you could press rather than one state you are changing, and at
 * 11px neither of them looked pressable at all. A switch says "this is on or
 * off" at a glance and gives a 40px target instead of a 24px one.
 *
 * Rendered as a real `role="switch"` button so a keyboard and a screen reader
 * both get the same story the eye does.
 */
const Toggle = ({ checked, onChange, label, id, disabled = false, className = '' }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`inline-flex items-center gap-2 select-none ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${className}`}
  >
    {label && (
      <span className={`text-[11px] font-semibold transition-colors ${checked ? 'text-[#2a276e]' : 'text-gray-400'}`}>
        {label}
      </span>
    )}
    <span
      className={`relative inline-block w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-[#2a276e]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

export default Toggle;
