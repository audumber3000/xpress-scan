/**
 * Currency formatting utility.
 * Reads the lab's currency_symbol from localStorage (set at login).
 */

export function getCurrencySymbol() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user.lab?.currency_symbol) return user.lab.currency_symbol;
    }
  } catch { /* ignore */ }
  return "₹";
}

export function formatCurrency(amount, symbol) {
  const s = symbol || getCurrencySymbol();
  const num = Number(amount);
  if (isNaN(num)) return `${s}0`;
  return `${s}${num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
