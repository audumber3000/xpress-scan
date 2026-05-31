import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';
import { METRIC_ICONS, ToothIcon } from './icons';

const MetricCard = ({ title, value, change, changeType, onClick, icon }) => {
  const Icon = METRIC_ICONS[icon] || ToothIcon;
  const noChange = !change || Math.abs(change) === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1.5 min-w-0 text-left hover:shadow-md hover:border-[#2a276e]/30 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-[#9B8CFF]/10 rounded-lg text-[#2a276e] flex-shrink-0">
            <Icon />
          </div>
          <span className="text-xs text-gray-500 font-medium truncate">{title}</span>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#2a276e] transition-colors flex-shrink-0" />
      </div>

      <div className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
        {icon === 'revenue' ? getCurrencySymbol() : ''}{Number(value || 0).toLocaleString()}
      </div>

      <div className="text-xs">
        {noChange ? (
          <span className="text-gray-400">— No change vs prev.</span>
        ) : (
          <>
            <span className={changeType === 'up' ? 'text-green-600' : 'text-red-500'}>
              {changeType === 'up' ? '▲' : '▼'} {Math.abs(change)}%
            </span>
            <span className="text-gray-400"> vs prev.</span>
          </>
        )}
      </div>
    </button>
  );
};

export default MetricCard;
