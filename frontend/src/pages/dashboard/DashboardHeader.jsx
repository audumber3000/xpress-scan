import { ChevronDown } from 'lucide-react';
import React from 'react';

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
  { value: '7days', label: 'Last 7 days', short: '7 days' },
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

        {/* Phones: a full-width dropdown, thumb-reachable, no sideways scroll.
            Wider screens: a segmented switcher, every window one click away and
            the current one always visible. */}
        <div className="relative md:hidden">
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            aria-label="Time period"
            className="w-full appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-9 py-2.5 min-h-[2.75rem] text-sm font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="hidden md:block flex-shrink-0">
          <div role="group" aria-label="Time period"
               className="inline-flex items-center gap-0.5 p-[3px] bg-white border border-gray-200 rounded-lg">
            {[...PERIODS].reverse().map((p) => {
              const on = p.value === period;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onPeriodChange(p.value)}
                  aria-pressed={on}
                  className={`px-3 py-1.5 rounded-md text-xs md:text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9B8CFF] ${
                    on ? 'bg-[#2a276e] text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {p.short || p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
