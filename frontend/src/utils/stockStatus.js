import { clinicToday } from "./datetime";

// Days from the clinic's local today to a YYYY-MM-DD date (negative = past).
function daysUntil(dateStr) {
  const toMs = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(dateStr) - toMs(clinicToday())) / 86400000);
}

export const EXPIRY_SOON_DAYS = 30;

// Expiry state for an item, computed in the clinic timezone.
// Returns null when there's no expiry date.
export function expiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = daysUntil(expiryDate);
  if (days < 0) return { status: "expired", days };
  if (days <= EXPIRY_SOON_DAYS) return { status: "expiring", days };
  return { status: "ok", days };
}

export function isLowStock(item) {
  return Number(item.quantity) <= Number(item.min_stock_level || 0);
}
