import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * The stock / medication list below 768px.
 *
 * Serves both tabs: the shapes differ only in which secondary line is worth
 * showing (category and vendor for consumables, strength and form for
 * medications), so one component takes a `kind` rather than there being two
 * near-identical files.
 */

const StockCardList = ({ items, kind = 'stock', onSelect }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);

  return (
    <div className="divide-y divide-gray-100">
      {items.map((it) => {
        const qty = Number(it.quantity || 0);
        const min = Number(it.min_stock_level || 0);
        const isLow = min > 0 && qty <= min;
        const expiry = it.expiry_date ? new Date(it.expiry_date) : null;
        const expired = expiry && expiry < today;
        const expiringSoon = expiry && !expired && expiry <= soon;

        const secondary = kind === 'medications'
          ? [it.strength, it.form, it.generic_name].filter(Boolean).join(' · ')
          : [it.category, it.vendor_name].filter(Boolean).join(' · ');

        return (
          <button
            key={it.id}
            onClick={() => onSelect?.(it)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[3.5rem] active:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 truncate">{it.name}</span>
                {isLow && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex-shrink-0">
                    Low
                  </span>
                )}
                {expired && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 flex-shrink-0">
                    Expired
                  </span>
                )}
                {expiringSoon && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex-shrink-0">
                    Expiring
                  </span>
                )}
              </div>
              {secondary && <p className="text-[11px] text-gray-400 truncate">{secondary}</p>}
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900 tabular-nums">
                {qty % 1 === 0 ? qty : qty.toFixed(2)}
                <span className="text-[11px] text-gray-400 font-medium ml-1">{it.unit || ''}</span>
              </p>
              {min > 0 && (
                <p className="text-[11px] text-gray-400 tabular-nums">reorder at {min}</p>
              )}
            </div>

            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default StockCardList;
