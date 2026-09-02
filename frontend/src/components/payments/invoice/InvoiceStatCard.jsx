import React from 'react';

/**
 * One fact from the top of the invoice: a tinted icon tile, a label, a value
 * and the time underneath.
 *
 * Sized to its content rather than to a grid track. These sit inline beside the
 * invoice number, and stretching them across a full row is what made the whole
 * header read as oversized.
 */
const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-500',
};

const InvoiceStatCard = ({ icon: Icon, tone = 'indigo', label, value, sub, subTone = 'text-gray-400' }) => (
  <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2 min-w-[150px] flex-1 sm:flex-none">
    <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${TONES[tone] || TONES.indigo}`}>
      <Icon size={14} />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-gray-500 leading-tight">{label}</p>
      <p className="text-[13px] font-bold text-gray-900 leading-tight truncate" title={typeof value === 'string' ? value : undefined}>
        {value}
      </p>
      {sub && <p className={`text-[10px] leading-tight mt-0.5 ${subTone}`}>{sub}</p>}
    </div>
  </div>
);

export default InvoiceStatCard;
