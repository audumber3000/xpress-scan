import React from 'react';
import { Infinity as InfinityIcon } from 'lucide-react';
import { METRIC_LABELS, MONTHLY_METRICS } from '../../../utils/plans';

/**
 * What the clinic is using, against what its plan allows.
 *
 * This is the substance of the Current plan card and the evidence behind the
 * upgrade nudge underneath it. Every number is real, straight from
 * `GET /subscriptions/usage`; when that call fails the parent renders nothing
 * here rather than an estimate, because a meter that might be wrong is worse
 * than no meter at all.
 *
 * Colour carries meaning and nothing else does: teal is fine, amber means the
 * limit is close, red means it has been reached. Nothing here is a warning —
 * passing a limit does not stop anything working, and the wording downstream
 * says so.
 */

const barColour = (ratio) => {
  if (ratio >= 1) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-amber-500';
  return 'bg-[#29828a]';
};

const fmt = (value, key) =>
  key === 'storage_gb' ? `${Number(value || 0).toFixed(1)} GB` : Number(value || 0).toLocaleString('en-IN');

const Meter = ({ metricKey, used, limit }) => {
  const unlimited = limit === null || limit === undefined;
  const ratio = unlimited ? 0 : Math.min((used || 0) / limit, 1);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">
          {METRIC_LABELS[metricKey] || metricKey}
          {MONTHLY_METRICS.has(metricKey) && (
            <span className="ml-1 text-[10px] text-gray-400">this month</span>
          )}
        </span>
        <span className="text-xs font-semibold tabular-nums text-gray-700">
          {unlimited ? (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <InfinityIcon size={12} /> Unlimited
            </span>
          ) : (
            <>
              {fmt(used, metricKey)}
              <span className="font-normal text-gray-400"> of {fmt(limit, metricKey)}</span>
            </>
          )}
        </span>
      </div>
      {/* No bar for an unlimited metric: a track with nothing in it implies a
          ceiling that does not exist. */}
      {!unlimited && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${barColour(ratio)}`}
            style={{ width: `${Math.max(ratio * 100, 2)}%` }}
          />
        </div>
      )}
    </div>
  );
};

const UsageMeters = ({ usage }) => {
  if (!usage?.metrics) return null;

  const entries = Object.entries(usage.metrics).filter(([key, m]) => {
    // Every single-clinic account is on 1 of 1 branches. Drawing that as a full
    // bar makes a normal state look like a problem.
    if (key === 'branches' && m.limit === 1 && (m.used || 0) <= 1) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {entries.map(([key, m]) => (
        <Meter key={key} metricKey={key} used={m.used} limit={m.limit} />
      ))}
    </div>
  );
};

export default UsageMeters;
