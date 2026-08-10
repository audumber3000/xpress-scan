/**
 * Currency formatting utility.
 *
 * Reads the clinic's currency_symbol from the user object in localStorage.
 * Falls back to ₹ (INR) for existing Indian clinics that don't have the field yet.
 */

export function getCurrencySymbol() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      const clinic = user.clinic || user.clinics?.[0];
      if (clinic?.currency_symbol) return clinic.currency_symbol;
    }
  } catch { /* ignore */ }
  return '₹';
}

/**
 * The clinic's ISO 4217 currency code (e.g. "INR", "USD", "CAD"), for use with
 * Intl.NumberFormat({ style: 'currency' }). Falls back to INR for existing
 * Indian clinics that don't carry the field.
 */
export function getCurrencyCode() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      const clinic = user.clinic || user.clinics?.[0];
      if (clinic?.currency_code) return clinic.currency_code;
    }
  } catch { /* ignore */ }
  return 'INR';
}

/**
 * Format a numeric amount with the clinic's currency symbol.
 * @param {number|string} amount
 * @param {string} [symbol] — override symbol (otherwise auto-detected)
 * @returns {string} e.g. "₹1,200" or "$1,200"
 */
export function formatCurrency(amount, symbol) {
  const s = symbol || getCurrencySymbol();
  const num = Number(amount);
  if (isNaN(num)) return `${s}0`;
  // Use comma-separated thousands (universal). Indian users still see commas,
  // just not the lakh/crore grouping — cleaner for international compatibility.
  return `${s}${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Money short enough to fit a KPI card, in the reader's own number system.
 *
 * Indian clinics read ₹12.4L far faster than ₹1.24M, and the lakh/crore
 * grouping is what appears on every other financial document they handle. Any
 * other currency falls back to K/M. Full precision stays available in the
 * detail drawer — this is for the headline only.
 */
export const formatCompactMoney = (value) => {
  const n = Number(value || 0);
  const sym = getCurrencySymbol();
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  const trim = (num) => String(Number(num.toFixed(1)));

  if (getCurrencyCode() === 'INR') {
    if (abs >= 1e7) return `${sign}${sym}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}${sym}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}${sym}${trim(abs / 1e3)}K`;
    return `${sign}${sym}${Math.round(abs)}`;
  }

  if (abs >= 1e9) return `${sign}${sym}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${sym}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${sym}${trim(abs / 1e3)}K`;
  return `${sign}${sym}${Math.round(abs)}`;
};

/** Full amount with thousands separators, for tooltips and narrative lines. */
export const formatMoney = (value) => {
  const n = Number(value || 0);
  const locale = getCurrencyCode() === 'INR' ? 'en-IN' : 'en-US';
  return `${getCurrencySymbol()}${Math.round(n).toLocaleString(locale)}`;
};

/** Plain integer with separators. */
export const formatCount = (value) =>
  Number(value || 0).toLocaleString(getCurrencyCode() === 'INR' ? 'en-IN' : 'en-US');

