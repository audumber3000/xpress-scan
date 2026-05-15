import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Compact filter dropdown that sits inline with search bars and action buttons.
 * When a non-default value is selected, the dropdown gets a colored border
 * to indicate an active filter.
 */
const FilterDropdown = ({ label, value, onChange, options, className = '' }) => {
  const isActive = value && value !== '' && value !== 'all';

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === 'all' ? '' : e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 ${
          isActive
            ? 'bg-[#2a276e]/5 border-[#2a276e]/30 text-[#2a276e]'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <option value="all">{label}: All</option>
        {options.map((opt) => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
      <ChevronDown
        size={14}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
          isActive ? 'text-[#2a276e]' : 'text-gray-400'
        }`}
      />
    </div>
  );
};

export default FilterDropdown;
