import React from "react";
import { formatDate } from "../../utils/datetime";
import { expiryStatus } from "../../utils/stockStatus";

const pill = "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border";

// Stock health: low / getting low / healthy (based on reorder level).
export const StockStatusBadge = ({ item }) => {
  const q = Number(item.quantity);
  const min = Number(item.min_stock_level || 0);
  if (q <= min) return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Low Stock</span>;
  if (q <= min * 1.5) return <span className={`${pill} bg-amber-50 text-amber-700 border-amber-200`}>Getting Low</span>;
  return <span className={`${pill} bg-green-50 text-green-700 border-green-200`}>Healthy</span>;
};

// Expiry pill: date + coloured state (expired / expiring soon / ok).
export const ExpiryCell = ({ date }) => {
  if (!date) return <span className="text-xs text-gray-300">—</span>;
  const info = expiryStatus(date);
  const label = formatDate(date);
  if (info?.status === "expired") {
    return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Expired · {label}</span>;
  }
  if (info?.status === "expiring") {
    return <span className={`${pill} bg-amber-50 text-amber-700 border-amber-200`}>{info.days}d · {label}</span>;
  }
  return <span className="text-sm text-gray-600">{label}</span>;
};
