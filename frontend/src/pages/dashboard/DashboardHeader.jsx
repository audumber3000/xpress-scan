import React from 'react';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const today = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

const DashboardHeader = ({ ownerName, period, onPeriodChange }) => (
  <div className="mb-6 md:mb-8">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#2a276e] tracking-tight">
          {greeting()}{ownerName ? `, ${ownerName}` : ''} 👋
        </h1>
        <div className="text-sm md:text-base text-gray-500 font-medium mt-1">
          {today()} · Here's how your clinic is doing
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#9B8CFF]/50">
          <i className="las la-calendar text-[#9B8CFF] text-lg"></i>
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="text-sm font-bold text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer pr-8"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardHeader;
