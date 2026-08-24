import React from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { daysUntil } from '../../../utils/plans';

/**
 * The promo the team is currently running, shown to everybody.
 *
 * Codes are handed out in campaigns that most clinics never see, so a code
 * nobody was told about helps nobody. Featuring one in the support tool puts it
 * here instead.
 *
 * The countdown is the only urgency on this page and it is real: it counts to
 * the coupon's own `expiry_date`, and simply is not rendered when the coupon
 * has no expiry. An invented deadline would be the fastest way to make a
 * medical product feel like a timeshare pitch.
 */
const FeaturedPromoBanner = ({ promo, applied, onApply }) => {
  if (!promo || applied) return null;

  const days = daysUntil(promo.expires_at);
  const offer = promo.discount_percent
    ? `${promo.discount_percent}% off`
    : promo.discount_flat
    ? `${promo.discount_flat} off`
    : 'a discount';

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <Sparkles size={16} className="text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            <span className="font-mono text-amber-700">{promo.code}</span> gets you {offer}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>Applies to any plan below.</span>
            {days !== null && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <Clock size={11} />
                {days === 0 ? 'Ends today' : `${days} day${days === 1 ? '' : 's'} left`}
              </span>
            )}
            {promo.uses_left !== null && promo.uses_left <= 10 && (
              <span className="font-medium text-amber-700">
                {promo.uses_left} left
              </span>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={() => onApply(promo)}
        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-amber-700"
      >
        Apply {promo.code}
      </button>
    </div>
  );
};

export default FeaturedPromoBanner;
