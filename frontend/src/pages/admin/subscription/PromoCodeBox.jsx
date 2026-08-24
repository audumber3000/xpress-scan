import React, { useState } from 'react';
import { Tag, X, CheckCircle2, Loader2 } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';

/**
 * A promo code, entered before the plan is chosen rather than after.
 *
 * It used to live only on Checkout, one screen past the decision, which is the
 * wrong side of it: a discount that appears after somebody has already picked a
 * plan cannot influence which plan they pick, and a code they were emailed is
 * useless if they never reach the screen that accepts it.
 *
 * Collapsed to a quiet link until used. Most clinics do not have a code, and a
 * permanently open input asking for one reads as a page expecting to be haggled
 * with.
 *
 * The server returns the coupon's own terms (`discount_percent` /
 * `discount_flat`), so one validation re-prices all three cards without three
 * round trips. Those figures are display only: `create_checkout_session`
 * re-validates before anything is charged, so a tampered number in the browser
 * changes nothing that reaches Cashfree.
 */

const PromoCodeBox = ({ discount, onApply, onClear, planKeyForQuote = 'pro' }) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setChecking(true);
    setError('');
    try {
      // Quoted against one plan so the server has an amount to work from; the
      // terms that come back are what actually re-price the cards.
      const res = await api.post('/subscriptions/validate-coupon', {
        code: trimmed,
        plan_name: planKeyForQuote,
      });
      if (!res.is_valid) {
        setError(res.message || 'That code is not valid.');
        return;
      }
      onApply({
        code: res.code || trimmed,
        percent: res.discount_percent || null,
        flat: res.discount_flat || null,
        expiresAt: res.expires_at || null,
        usesLeft: res.uses_left ?? null,
      });
      setCode('');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not check that code.'));
    } finally {
      setChecking(false);
    }
  };

  if (discount) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={15} className="shrink-0" />
          <span className="font-mono">{discount.code}</span>
          <span className="font-normal">
            {discount.percent ? `${discount.percent}% off` : 'discount'} applied to every plan
          </span>
        </p>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline min-h-[2.25rem]"
        >
          <X size={12} /> Remove
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-[#29828a] min-h-[2.25rem]"
      >
        <Tag size={13} /> Have a promo code?
      </button>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          autoFocus
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder="Enter code"
          aria-label="Promo code"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide outline-none transition-colors focus:border-[#29828a] sm:max-w-xs"
        />
        <div className="flex gap-2">
          <button
            onClick={apply}
            disabled={checking || !code.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#29828a] px-5 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-[#1f6b72] disabled:bg-gray-200 disabled:text-gray-400 sm:flex-none"
          >
            {checking ? <><Loader2 size={14} className="animate-spin" /> Checking</> : 'Apply'}
          </button>
          <button
            onClick={() => { setOpen(false); setCode(''); setError(''); }}
            aria-label="Cancel"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};

export default PromoCodeBox;
