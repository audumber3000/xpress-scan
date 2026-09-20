import React from 'react';
import { ChevronDown } from 'lucide-react';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const today = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
];

const periodLabel = (value) => PERIODS.find((p) => p.value === value)?.label || 'All time';

const DashboardHeader = ({ ownerName, period, onPeriodChange }) => {
  return (
    <div className="mb-4 md:mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-bold text-[#2a276e] tracking-tight truncate">
            {greeting()}{ownerName ? `, ${ownerName}` : ''}
          </h1>
          {/* Names the window the cards below are counting. "Here's how your
              clinic is doing" was warm and said nothing, while the filter it
              sits beside silently governs most of the page — and does not
              govern all of it. Better to spend the line on the scope. */}
          <p className="text-xs md:text-sm text-gray-500 font-medium mt-0.5 truncate">
            {today()} · figures below cover {periodLabel(period).toLowerCase()}
          </p>
        </div>

        {/* Full-width and thumb-reachable on a phone, inline on wider screens. */}
        <div className="flex items-stretch gap-2 flex-shrink-0">
          <div className="relative flex-1 md:flex-none">
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              aria-label="Time period"
              className="w-full md:w-auto appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-9 py-2.5 min-h-[2.75rem] text-sm font-semibold text-gray-700 cursor-pointer hover:border-[#2a276e]/40 focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 transition-colors"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
