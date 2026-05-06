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
