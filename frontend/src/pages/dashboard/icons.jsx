import React from 'react';

// MolarPlus support WhatsApp number (digits only, for wa.me links)
export const SUPPORT_WHATSAPP = '919594078777';

// Line Awesome metric icons
export const ToothIcon = () => <i className="las la-tooth text-2xl"></i>;
export const CalendarCheckIcon = () => <i className="las la-calendar-check text-2xl"></i>;
export const ChairIcon = () => <i className="las la-procedures text-2xl"></i>;
export const RevenueIcon = () => <i className="las la-money-bill-wave text-2xl opacity-80"></i>;

export const METRIC_ICONS = {
  tooth: ToothIcon,
  calendar: CalendarCheckIcon,
  chair: ChairIcon,
  revenue: RevenueIcon,
};

// Purple AI Sparkle (two four-pointed stars)
export const AISparkleIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2L13.5 6.5L18 8L13.5 9.5L12 14L10.5 9.5L6 8L10.5 6.5L12 2Z"
      fill="url(#purpleGradient1)"
      stroke="#2a276e"
      strokeWidth="1.5"
    />
    <path
      d="M18 16L18.75 18.25L21 19L18.75 19.75L18 22L17.25 19.75L15 19L17.25 18.25L18 16Z"
      fill="url(#purpleGradient2)"
      stroke="#2a276e"
      strokeWidth="1.5"
    />
    <defs>
      <linearGradient id="purpleGradient1" x1="12" y1="2" x2="12" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9B8CFF" />
        <stop offset="100%" stopColor="#2a276e" />
      </linearGradient>
      <linearGradient id="purpleGradient2" x1="18" y1="16" x2="18" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9B8CFF" />
        <stop offset="100%" stopColor="#2a276e" />
      </linearGradient>
    </defs>
  </svg>
);
