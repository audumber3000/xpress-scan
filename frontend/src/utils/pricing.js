/**
 * Subscription pricing.
 *
 * There is exactly one price: ₹899 a month, ₹8,100 a year. Every clinic pays
 * it, wherever they are, because the gateway raises an INR order
 * (`cashfree_provider.py` hardcodes `order_currency: "INR"`).
 *
 * This module used to declare a second "international" tier at $10/mo that
 * nothing could actually charge, and Checkout separately hardcoded 899 against
 * the clinic's *invoice* currency symbol. Between them a Canadian clinic was
 * quoted $10, then $899, and debited about CA$14.60. One price with a clearly
 * labelled local estimate replaces both.
 */

/** The only real price. Amounts are INR. */
export const PLAN = {
  code: 'INR',
  symbol: '₹',
  monthly: 899,
  annualTotal: 8100,
  get annualMonthly() { return Math.round(this.annualTotal / 12); },      // 675
  get annualSave() { return this.monthly * 12 - this.annualTotal; },      // 2688
  get annualPctOff() {
    return Math.round((this.annualSave / (this.monthly * 12)) * 100);     // 25
  },
};

/**
 * Indicative INR conversion rates, i.e. how many units of the currency one
 * rupee buys.
 *
 * Deliberately static and dated. These exist to answer one question for an
 * overseas clinic: "is this fifteen dollars or nine hundred?" They are never
 * the amount charged, they are never shown without the word "about", and the
 * card network sets the real rate on the day. A rate that drifts a few percent
 * between deploys still answers the question; a live FX call on the payment
 * screen adds a third-party request and a spinner to the one page that must
 * not wobble.
 *
 * Refresh by hand when convenient and move RATES_UPDATED with it.
 */
export const RATES_UPDATED = '2026-08-01';

const PER_INR = {
  USD: 0.0120, EUR: 0.0110, GBP: 0.0094, AED: 0.0441, SAR: 0.0450,
  CAD: 0.0164, AUD: 0.0182, SGD: 0.0155, MYR: 0.0533, NZD: 0.0198,
  ZAR: 0.2160, KES: 1.5500, NGN: 18.900, LKR: 3.5400, NPR: 1.9200,
  BDT: 1.4300, PKR: 3.3400, QAR: 0.0437, KWD: 0.0037, OMR: 0.0046,
  CHF: 0.0097, JPY: 1.8100, THB: 0.3900, PHP: 0.6900, IDR: 195.00,
};

/** Symbols for the currencies above, for the ones Intl renders awkwardly. */
const SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ',
  CAD: 'CA$', AUD: 'A$', SGD: 'S$', MYR: 'RM', NZD: 'NZ$',
  ZAR: 'R', KES: 'KSh', NGN: '₦', LKR: 'Rs ', NPR: 'Rs ',
  BDT: '৳', PKR: 'Rs ', QAR: 'QAR ', KWD: 'KD ', OMR: 'OMR ',
  CHF: 'CHF ', JPY: '¥', THB: '฿', PHP: '₱', IDR: 'Rp',
};

/** The clinic's own currency code, from the cached user object. */
export function clinicCurrencyCode() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const clinic = user.clinic || user.clinics?.[0];
    return (clinic?.currency_code || 'INR').toUpperCase();
  } catch {
    return 'INR';
  }
}

/** True when a conversion line would tell the reader anything. */
export function needsLocalEstimate(code = clinicCurrencyCode()) {
  return code !== 'INR' && Boolean(PER_INR[code]);
}

/**
 * An INR amount expressed roughly in the clinic's currency.
 *
 * Returns null when there is nothing useful to say: an Indian clinic, or a
 * currency with no rate on file. Callers render nothing in that case rather
 * than guessing, because a wrong number here is worse than no number.
 *
 * @param {number} inr
 * @returns {{ text: string, code: string } | null}
 */
export function localEstimate(inr, code = clinicCurrencyCode()) {
  if (!needsLocalEstimate(code)) return null;
  const value = Number(inr || 0) * PER_INR[code];
  if (!Number.isFinite(value) || value <= 0) return null;

  // Two decimals below 100 so small amounts stay meaningful, whole numbers
  // above it where the decimals are noise against an approximation anyway.
  const rounded = value < 100
    ? value.toFixed(2)
    : Math.round(value).toLocaleString('en-US');

  return { text: `${SYMBOLS[code] || `${code} `}${rounded}`, code };
}

/** "about CA$13.10" or null. The word "about" is not optional. */
export function localEstimateLabel(inr, code = clinicCurrencyCode()) {
  const est = localEstimate(inr, code);
  return est ? `about ${est.text}` : null;
}

/** An INR amount formatted the Indian way: ₹8,100 not ₹8100. */
export function inr(amount) {
  return `${PLAN.symbol}${Number(amount || 0).toLocaleString('en-IN')}`;
}

/**
 * Kept so existing callers keep working while the two pricing screens migrate.
 * Everything now resolves to the single INR plan.
 * @deprecated read PLAN directly.
 */
export function getSubscriptionPricing() {
  return {
    code: PLAN.code,
    symbol: PLAN.symbol,
    monthly: PLAN.monthly,
    annualTotal: PLAN.annualTotal,
    annualMonthly: PLAN.annualMonthly,
    save: PLAN.annualSave,
    pctOff: PLAN.annualPctOff,
  };
}
