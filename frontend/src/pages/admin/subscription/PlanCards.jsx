import React from 'react';
import { Check, ArrowRight, Star } from 'lucide-react';
import { formatPrice, resolvePlan, planRank } from '../../../utils/plans';

/**
 * The three plans, side by side.
 *
 * Prices come from the catalogue, which serves one currency per clinic, so
 * there is no conversion or symbol-picking to do here. An Indian clinic's
 * catalogue has no dollar figure in it at all.
 *
 * Three screens:
 *   mobile   one column, recommended plan first (it is already first in rank order)
 *   tablet   two columns, the third wraps underneath
 *   desktop  all three across
 */

/** What a promo code takes off one price. Mirrors service.validate_coupon. */
const applyDiscount = (amount, discount) => {
  if (!discount) return amount;
  const off = discount.percent ? (amount * discount.percent) / 100 : (discount.flat || 0);
  return Math.max(0, Math.round((amount - Math.min(off, amount)) * 100) / 100);
};

const Feature = ({ text }) => {
  // A leading "Everything in X, plus:" is a heading for the list under it, not
  // a feature, so it does not get a tick.
  const isHeading = text.endsWith('plus:');
  if (isHeading) {
    return (
      <li className="text-xs font-semibold text-gray-500 pt-1">{text}</li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
      <Check size={13} className="text-[#29828a] shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
};

const PlanCard = ({ plan, cycle, isCurrent, isDowngrade, locked, taxLabel, discount, adds, onChoose }) => {
  const annual = cycle === 'annual';
  const listHeadline = annual ? plan.annual_monthly : plan.monthly;
  const headline = applyDiscount(listHeadline, discount);
  const discounted = discount && headline < listHeadline;
  const saving = plan.monthly * 12 - plan.annual_total;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
        plan.popular ? 'border-[#29828a]' : 'border-gray-200'
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-[#29828a] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Star size={10} /> Most popular
        </span>
      )}

      <h3 className="text-base font-bold text-gray-900">{plan.label}</h3>
      <p className="mt-0.5 text-xs text-gray-400 leading-relaxed min-h-[2rem]">{plan.tagline}</p>

      <div className="mt-3">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {/* The old price stays visible beside the new one. A discount nobody
              can see the size of is not much of a discount. */}
          {discounted && (
            <span className="text-base font-semibold text-gray-300 line-through tabular-nums">
              {formatPrice(listHeadline, plan.currency)}
            </span>
          )}
          <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${discounted ? 'text-emerald-600' : 'text-gray-900'}`}>
            {formatPrice(headline, plan.currency)}
          </span>
          <span className="text-xs font-medium text-gray-400">/ month</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          {annual
            ? `${formatPrice(applyDiscount(plan.annual_total, discount), plan.currency)} billed once a year, saving ${formatPrice(saving, plan.currency)}`
            : 'Billed monthly'}
          {taxLabel ? ` · plus ${taxLabel}` : ''}
        </p>
      </div>

      {/* What THIS clinic would gain, rather than the full feature list again.
          The list below answers "what is in it"; this answers "why move". */}
      {adds && !isCurrent && (
        <p className="mt-3 rounded-lg bg-[#29828a]/5 px-3 py-2 text-[11px] font-medium leading-relaxed text-[#1f6b72]">
          {adds}
        </p>
      )}

      <ul className="mt-4 space-y-1.5 flex-1">
        {(plan.features || []).map((f) => <Feature key={f} text={f} />)}
      </ul>

      {/* A paying clinic can only move up. The lower plans stay on the page,
          because seeing what is underneath you is how you understand what you
          are paying for, but they are not buyable: everything in them is
          already included in what the clinic has. */}
      <button
        onClick={() => onChoose(plan.key, cycle)}
        disabled={isCurrent || locked}
        className={`mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[2.75rem] ${
          isCurrent || locked
            ? 'cursor-default border border-gray-200 bg-gray-50 text-gray-400'
            : plan.popular
            ? 'bg-[#29828a] text-white hover:bg-[#1f6b72]'
            : 'border border-[#29828a] text-[#29828a] hover:bg-[#29828a]/5'
        }`}
      >
        {isCurrent
          ? 'Your current plan'
          : locked
          ? 'Included in your plan'
          : <>{isDowngrade ? 'Switch to' : 'Upgrade to'} {plan.label} <ArrowRight size={14} /></>}
      </button>
    </div>
  );
};

/** One sentence naming what `plan` adds over the clinic's current plan. */
const differentiator = (plan, currentPlan) => {
  if (!currentPlan || plan.rank <= currentPlan.rank) return null;
  const bits = [];
  const grew = (key, noun) => {
    const from = currentPlan.limits?.[key];
    const to = plan.limits?.[key];
    if (to === null && from !== null) bits.push(`unlimited ${noun}`);
    else if (typeof to === 'number' && typeof from === 'number' && to > from) {
      bits.push(`${to.toLocaleString('en-IN')} ${noun}`);
    }
  };
  grew('branches', 'branches');
  grew('staff', 'staff logins');
  grew('patients', 'new patients a month');
  if (!bits.length) return null;
  return `Takes you to ${bits.slice(0, 3).join(', ')}.`;
};

const PlanCards = ({ catalogue, currentPlanName, cycle, onCycleChange, onChoose, discount, lockDowngrades }) => {
  const current = resolvePlan(currentPlanName);
  const currentPlan = catalogue.plans.find((p) => p.key === current.key);
  const currentRank = planRank(currentPlanName);
  const pctOff = catalogue.plans[0]?.annual_pct_off || 20;

  return (
    <div>
      {/* Billing toggle. Centred so it reads as belonging to all three cards
          rather than to the first one. */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {[
            { id: 'monthly', label: 'Monthly' },
            { id: 'annual', label: 'Annual' },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => onCycleChange(b.id)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 min-h-[2.25rem] text-xs font-bold transition-colors ${
                cycle === b.id
                  ? 'bg-white text-[#29828a] border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {b.label}
              {b.id === 'annual' && (
                <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                  SAVE {pctOff}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogue.plans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            cycle={cycle}
            taxLabel={catalogue.tax_label}
            discount={discount}
            adds={differentiator(plan, currentPlan)}
            isCurrent={plan.key === current.key && cycle === current.cycle}
            isDowngrade={plan.rank < currentRank}
            locked={!!lockDowngrades && plan.rank < currentRank}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
};

export default PlanCards;
