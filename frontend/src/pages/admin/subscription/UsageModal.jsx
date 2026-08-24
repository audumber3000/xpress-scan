import React from 'react';
import { X, TrendingUp, ArrowRight } from 'lucide-react';
import {
  planLabel, pressuredMetrics, nextPlanFor, metricNoun, MONTHLY_METRICS,
} from '../../../utils/plans';
import UsageMeters from './UsageMeters';

/**
 * Usage, on request.
 *
 * These meters used to sit open on the Current plan card. Five bars and a
 * coloured nudge is a lot of screen for a question most people are not asking
 * on most visits, and it pushed the plan cards — the thing the page is actually
 * for — below the fold.
 *
 * So the card carries a one-line summary and this opens when somebody wants the
 * detail. Nothing is lost: the summary still says when a limit has been
 * reached, which is the only state worth interrupting for.
 */

const UsageModal = ({ open, onClose, usage, planName, onChoosePlan }) => {
  if (!open || !usage) return null;

  const pressure = pressuredMetrics(usage);
  const worst = pressure[0];
  const better = worst ? nextPlanFor(worst.key, planName, worst.limit) : null;

  const period = usage.period
    ? new Date(`${usage.period.from}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-[1px] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Your usage"
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-2xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">
              Your usage on {planLabel(planName)}
            </h2>
            {period && (
              <p className="mt-0.5 text-xs text-gray-400">
                Patients and appointments count for {period}. Staff, branches and storage are totals.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <UsageMeters usage={usage} />

          {worst && better && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <TrendingUp size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  {worst.used >= worst.limit ? (
                    <>
                      {planLabel(planName)} covers {Number(worst.limit).toLocaleString('en-IN')}{' '}
                      {metricNoun(worst.key, worst.limit)}
                      {MONTHLY_METRICS.has(worst.key) ? ' this month' : ''} and you have{' '}
                      <strong>{Number(worst.used).toLocaleString('en-IN')}</strong>.
                    </>
                  ) : (
                    <>
                      You have used <strong>{Number(worst.used).toLocaleString('en-IN')}</strong> of
                      your {Number(worst.limit).toLocaleString('en-IN')}{' '}
                      {metricNoun(worst.key, worst.limit)}
                      {MONTHLY_METRICS.has(worst.key) ? ' this month' : ''}.
                    </>
                  )}{' '}
                  Nothing has stopped working. <strong>{better.label}</strong> raises this to{' '}
                  {better.limits[worst.key] === null
                    ? 'no limit at all'
                    : Number(better.limits[worst.key]).toLocaleString('en-IN')}.
                </p>
              </div>
              <button
                onClick={() => { onClose(); onChoosePlan(better.key, 'monthly'); }}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 min-h-[2.75rem] text-xs font-semibold text-white transition-colors hover:bg-amber-700"
              >
                See {better.label} <ArrowRight size={13} />
              </button>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
            Going over a limit does not delete anything or stop the clinic working. Monthly counts
            reset on the first of the month, in your own timezone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UsageModal;
