import React from 'react';
import { getCurrencySymbol } from '../../../utils/currency';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Paid against due, as a ring.
 *
 * Inline SVG rather than a chart library: it is two arcs and a label, and
 * pulling in a charting dependency to draw them would cost more than the whole
 * drawer. Two segments only, so `stroke-dasharray` on a circle is the whole
 * technique — no path maths, no layout engine.
 *
 * Emerald for paid, amber for what is left, the same pairing the KPI cards use.
 * The percentages sit in the legend rather than on the ring: at this size a
 * label inside the arc is unreadable, and the figures are what get quoted to a
 * patient anyway.
 */
const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

const PaymentDonut = ({ total = 0, paid = 0, due = 0 }) => {
  const gross = Number(total) || 0;
  // Guard the divide. A ₹0 invoice is legal (a fully discounted bill), and it
  // must not render NaN% or a ring of the wrong colour.
  const paidPct = gross > 0 ? Math.min(100, Math.max(0, (paid / gross) * 100)) : (paid > 0 ? 100 : 0);
  const duePct = gross > 0 ? Math.max(0, 100 - paidPct) : 0;
  const settled = due <= 0 && gross > 0;

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="w-14 h-14 flex-shrink-0 -rotate-90" role="img"
           aria-label={`${Math.round(paidPct)} percent paid`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {duePct > 0 && (
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#f59e0b" strokeWidth="14"
            strokeDasharray={`${(duePct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={-((paidPct / 100) * CIRCUMFERENCE)}
          />
        )}
        {paidPct > 0 && (
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#10b981" strokeWidth="14"
            strokeDasharray={`${(paidPct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeLinecap={settled ? 'butt' : 'butt'}
          />
        )}
      </svg>

      <dl className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <dt className="text-[11px] text-gray-600 flex-1">Paid <span className="text-gray-400">{Math.round(paidPct)}%</span></dt>
          <dd className="text-[11px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{money(paid)}</dd>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${due > 0 ? 'bg-amber-500' : 'bg-gray-200'}`} />
          <dt className="text-[11px] text-gray-600 flex-1">Balance <span className="text-gray-400">{Math.round(duePct)}%</span></dt>
          <dd className="text-[11px] font-bold text-gray-900 tabular-nums whitespace-nowrap">{money(due)}</dd>
        </div>
      </dl>
    </div>
  );
};

export default PaymentDonut;
