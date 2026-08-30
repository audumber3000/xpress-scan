import React, { useState } from 'react';
import { CheckCircle2, Loader2, ArrowRight, Receipt, BarChart3 } from 'lucide-react';
import { formatPrice, planLabel, resolvePlan, pressuredMetrics } from '../../../utils/plans';
import UsageModal from './UsageModal';
import { openInvoice } from './invoiceHtml';

/**
 * What you are on, what you are using, and what you last paid.
 *
 * Extracted from PlansTab, which was carrying the whole page. The card it
 * replaces showed a name, a price and a date, which is a receipt header rather
 * than a billing screen: it could not answer "am I getting my money's worth" or
 * "what would change if I moved up", which are the only two questions anybody
 * opens this page with.
 *
 * The usage meters answer the first of those, but they are five bars and a
 * coloured nudge, and open by default they pushed the plan cards below the
 * fold. They now sit behind one line: a summary that says whether anything has
 * hit its limit, and a button for the detail.
 */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

const CurrentPlanCard = ({
  subscription, catalogue, usage, lastPayment, clinicName,
  startingTrial, onStartTrial, onChoosePlan, onSeePlans,
}) => {
  // What they can use now, not what they last had. Falling back to plan_name
  // keeps this working against a backend that predates the field.
  const planName = subscription?.effective_plan || subscription?.plan_name;
  const isExpired = subscription?.is_expired === true;
  const isTrial = subscription?.is_trial === true && subscription?.status === 'active' && !isExpired;
  const trialAvailable = subscription?.trial_available === true && !isTrial;
  const isGranted = subscription?.provider === 'migration';
  // A clinic that cannot write does not really "have" a plan. Saying
  // "Current plan: Plus" under a banner reading "We could not renew your Plus
  // plan" is circular, and for a lapsed Plus it is the same word twice.
  const stopped = subscription?.plan_state_blocks === true;
  const lapsedPlan = subscription?.plan_name;

  const plan = catalogue.plans.find((p) => p.key === resolvePlan(planName).key)
    || catalogue.plans[0];
  const renews = fmtDate(subscription?.current_end);

  const [usageOpen, setUsageOpen] = useState(false);
  // Only the metrics actually at or past their limit. That is the one thing
  // worth putting on the closed card; everything else waits for the modal.
  const atCapacity = usage ? pressuredMetrics(usage).filter((m) => m.used >= m.limit) : [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#29828a]/10">
              <CheckCircle2 size={20} className="text-[#29828a]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Current plan</p>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {stopped ? 'No active plan' : planLabel(planName)}
                </h3>
                {isTrial && (
                  <span className="rounded-full bg-[#29828a]/10 px-2 py-0.5 text-[10px] font-bold text-[#29828a]">Trial</span>
                )}
                {isExpired && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Expired</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {stopped && renews
                  ? `Your ${planLabel(lapsedPlan)} ${subscription?.plan_state === 'trial_ended' ? 'trial' : 'plan'} ended ${renews}`
                  : isGranted && renews ? `Included until ${renews}`
                  : renews ? `${isExpired ? 'Ended' : 'Renews'} ${renews}`
                  : 'No renewal date on file'}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            {stopped ? (
              <button
                onClick={onSeePlans}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#29828a] px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-[#1f6b72]"
              >
                Choose a plan <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <p className="text-2xl font-extrabold tabular-nums text-gray-900">
                  {isGranted ? formatPrice(0, plan.currency) : formatPrice(plan.monthly, plan.currency)}
                </p>
                <p className="text-xs text-gray-400">
                  per month{catalogue.tax_label && !isGranted ? ` plus ${catalogue.tax_label}` : ''}
                </p>
              </>
            )}
          </div>
        </div>

        {/* One line, not five bars. Absent entirely when the usage call did
            not answer, rather than showing an estimate. */}
        {usage && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              {atCapacity.length > 0 ? (
                <span className="font-semibold text-amber-700">
                  {atCapacity.length} of your limits {atCapacity.length === 1 ? 'has' : 'have'} been reached
                </span>
              ) : (
                <>Everything is well within your plan</>
              )}
            </p>
            <button
              onClick={() => setUsageOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 min-h-[2.25rem] text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <BarChart3 size={13} /> View usage
            </button>
          </div>
        )}

        {trialAvailable && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#29828a]/20 bg-[#29828a]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Try Pro free for {catalogue.trial_days} days
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                No card needed, and nothing is charged when it ends. You can only do this once.
              </p>
            </div>
            <button
              onClick={onStartTrial}
              disabled={startingTrial}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#29828a] px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-[#1f6b72] disabled:bg-gray-300"
            >
              {startingTrial
                ? <><Loader2 size={14} className="animate-spin" /> Starting</>
                : <>Start free trial <ArrowRight size={14} /></>}
            </button>
          </div>
        )}
      </div>

      {/* Last payment. Absent when nothing was ever charged, rather than an
          empty row saying so. */}
      {lastPayment && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          <p className="text-xs text-gray-500">
            Last payment{' '}
            <strong className="font-semibold text-gray-700">
              {formatPrice(lastPayment.amount, lastPayment.currency)}
            </strong>{' '}
            on {lastPayment.date}
            {lastPayment.coupon_code && (
              <span className="ml-1 text-gray-400">with {lastPayment.coupon_code}</span>
            )}
          </p>
          <button
            onClick={() => openInvoice(lastPayment, clinicName)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#29828a] hover:underline min-h-[2.25rem]"
          >
            <Receipt size={13} /> Invoice
          </button>
        </div>
      )}

      <UsageModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        usage={usage}
        planName={planName}
        onChoosePlan={onChoosePlan}
      />

      {!trialAvailable && (
        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={onSeePlans}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#29828a] hover:underline min-h-[2.25rem]"
          >
            {isExpired ? 'Choose a plan' : 'Compare plans'} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
};

export default CurrentPlanCard;
