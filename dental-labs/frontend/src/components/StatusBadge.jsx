/**
 * StatusBadge — color-coded case status pill, MolarPlus style.
 */
import { STATUS_CONFIG } from "../utils/constants";

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.received;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border"
      style={{
        color: cfg.color,
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      {cfg.label}
    </span>
  );
}
