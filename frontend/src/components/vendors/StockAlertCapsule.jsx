import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { expiryStatus, isLowStock } from "../../utils/stockStatus";

/*
 * Small pill that summarizes stock health for the active tab and opens the full
 * alerts panel on click. Green when everything is fine, red when items are low
 * or expiring/expired.
 */
const StockAlertCapsule = ({ items = [], onClick }) => {
  const low = items.filter(isLowStock).length;
  const expired = items.filter((i) => expiryStatus(i.expiry_date)?.status === "expired").length;
  const expiring = items.filter((i) => expiryStatus(i.expiry_date)?.status === "expiring").length;
  const total = low + expired + expiring;

  const healthy = total === 0;
  const cls = healthy
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-red-50 text-red-700 border-red-200";

  const parts = [];
  if (low) parts.push(`${low} low`);
  if (expired) parts.push(`${expired} expired`);
  if (expiring) parts.push(`${expiring} expiring`);
  const title = healthy ? "All stock healthy" : parts.join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition hover:brightness-95 ${cls}`}
    >
      {healthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {healthy ? "Healthy" : `${total} alert${total === 1 ? "" : "s"}`}
    </button>
  );
};

export default StockAlertCapsule;
