import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

/**
 * Week-on-week change pill for a summary card.
 *
 * Compares a figure against the same weekday a week earlier, which is the only
 * fair comparison in a clinic — a Saturday's takings say nothing about a
 * Tuesday's. The `comparedTo` label spells out which day, so the number is never
 * a mystery percentage.
 *
 * Renders nothing when there is nothing to say (both figures zero), and shows a
 * neutral "New" pill when last week's figure was zero, since a percentage change
 * from zero is meaningless.
 *
 * Props:
 *   current    — this period's number
 *   previous   — the same weekday last week
 *   comparedTo — e.g. "last Saturday" (used in the tooltip)
 *   invert     — true when a rise is bad (unused today; for expense-style cards)
 */
const TrendBadge = ({ current = 0, previous = 0, comparedTo = "last week", invert = false, loading = false }) => {
  if (loading) return null;

  const curr = Number(current || 0);
  const prev = Number(previous || 0);

  // Nothing either week — a "0%" pill would be noise.
  if (curr === 0 && prev === 0) return null;

  if (prev === 0) {
    return (
      <span
        title={`Nothing recorded ${comparedTo}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#2a276e]/[0.07] text-[#2a276e] whitespace-nowrap"
      >
        New
      </span>
    );
  }

  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;

  if (rounded === 0) {
    return (
      <span
        title={`Same as ${comparedTo}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 whitespace-nowrap"
      >
        0%
      </span>
    );
  }

  const up = rounded > 0;
  const good = invert ? !up : up;
  const tone = good ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600";
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span
      title={`vs ${comparedTo}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tone}`}
    >
      <Icon size={12} strokeWidth={3} />
      {Math.abs(rounded).toFixed(1)}%
    </span>
  );
};

export default TrendBadge;
