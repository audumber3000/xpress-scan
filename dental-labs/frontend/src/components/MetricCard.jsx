/**
 * MetricCard — clean dashboard stat card, MolarPlus style.
 *
 * - Numeric values animate with a count-up on mount/change.
 * - When `onClick` is provided the card becomes a button (hover lift + arrow),
 *   so metrics drill into the relevant filtered view instead of being dead ends.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

export default function MetricCard({ icon: Icon, label, value, color = "#6366f1", subtitle, format, onClick }) {
  const isNumber = typeof value === "number";
  const animated = useCountUp(isNumber ? value : 0);
  const display = isNumber
    ? (format ? format(animated) : Math.round(animated).toLocaleString())
    : value;

  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={`relative w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 transition-all duration-200 group ${
        interactive
          ? "hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 cursor-pointer"
          : "hover:shadow-md hover:border-indigo-100"
      }`}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${color}15` }}
      >
        {Icon && <Icon size={28} style={{ color }} />}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight truncate">{display}</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
      {interactive && (
        <ArrowUpRight
          size={16}
          className="absolute top-4 right-4 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:text-[#2a276e] transition-all"
        />
      )}
    </Wrapper>
  );
}
