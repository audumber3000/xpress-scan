import React, { useEffect, useState } from 'react';
import { Check, ArrowRight, Star } from 'lucide-react';
import { formatPrice, resolvePlan, planRank, monthsFree } from '../../../utils/plans';

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

const PlanCard = ({ plan, cycle: pageCycle, isCurrent: isCurrentFor, isDowngrade, locked, continues: continuesFor, discount, adds, onChoose, className = '' }) => {
  // A card can be flipped to annual on its own ("or ₹3,830/year, 2 months
  // free") without moving the whole page. The page toggle still wins whenever
  // it changes, so the two never disagree for long.
  const [ownCycle, setOwnCycle] = useState(null);
  useEffect(() => { setOwnCycle(null); }, [pageCycle]);
  const cycle = ownCycle || pageCycle;
  const isCurrent = isCurrentFor(cycle);
  const continues = continuesFor(cycle);
  const annual = cycle === 'annual';
  const free = monthsFree(plan);
  const listHeadline = annual ? plan.annual_monthly : plan.monthly;
  const headline = applyDiscount(listHeadline, discount);
  const discounted = discount && headline < listHeadline;
  const saving = plan.monthly * 12 - plan.annual_total;

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white p-5 ${
        plan.popular
          ? 'border-2 border-[#29828a] bg-gradient-to-b from-[#29828a]/[0.06] to-white to-40% lg:-my-2 lg:py-7'
          : 'border border-gray-200'
      } ${className}`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#29828a] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          <Star size={10} /> Most popular
        </span>
      )}

      <h3 className={`font-bold text-gray-900 ${plan.popular ? 'text-lg' : 'text-base'}`}>{plan.label}</h3>
      {/* "Best for ...": the line that lets somebody find their plan without
          reading three feature lists. */}
      <p className={`mt-0.5 text-xs leading-relaxed min-h-[2rem] ${plan.popular ? 'font-semibold text-[#1f6b72]' : 'text-gray-500'}`}>{plan.tagline}</p>

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
            ? `${formatPrice(applyDiscount(plan.annual_total, discount), plan.currency)} once a year${free >= 1 ? `, ${free} months free` : `, saving ${formatPrice(saving, plan.currency)}`}`
            : 'Paid monthly'}
        </p>
        {/* The annual offer where the decision is made, as one tap. A toggle at
            the top of the page is a step most people never take, and "2 months
            free" is something a clinic can picture where "20%" is not. */}
        {!annual && plan.annual_total > 0 && free >= 1 && (
          <button
            type="button"
            onClick={() => setOwnCycle('annual')}
            className="mt-1 text-left text-[11px] font-semibold text-[#29828a] hover:underline"
          >
            or {formatPrice(applyDiscount(plan.annual_total, discount), plan.currency)}/year · {free} months free
          </button>
        )}
        {annual && ownCycle === 'annual' && pageCycle !== 'annual' && (
          <button
            type="button"
            onClick={() => setOwnCycle(null)}
            className="mt-1 text-left text-[11px] font-semibold text-gray-500 hover:underline"
          >
            or pay monthly, {formatPrice(applyDiscount(plan.monthly, discount), plan.currency)}/month
          </button>
        )}
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
          : continues
          ? <>Continue on {plan.label} <ArrowRight size={14} /></>
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

/**
 * `isPaying` is the difference between being ON a plan and having BOUGHT one,
 * and getting it wrong made the entry plan unbuyable.
 *
 * A clinic trialling Plus, or holding the migration grant, resolves to Plus, so
 * the Plus card said "Your current plan" and was disabled. The only things it
 * could actually buy were Pro and Growth. Every clinic on the platform was in
 * that state: 176 on the grant and every new signup on a Plus trial, all of
 * them shown the entry plan greyed out and the two plans above it as the only
 * way to pay. That is the opposite of promoting Plus, and on 30 Sep it would
 * have met 176 clinics at once.
 *
 * Now only a live paid plan marks a card as current. A trial or a grant makes
 * it "Continue on Plus", which is both truthful and the thing we want clicked.
 */
// Desktop order: the plan we most want chosen sits in the middle, with a dearer
// plan either side. Read left to right, ₹999 comes before ₹399 and makes it look
// as small as it is, and the middle of three is the one people lean towards.
// A stacked phone layout has no middle, so there the popular plan goes first.
const DESKTOP_ORDER = ['pro', 'plus', 'growth'];

const PlanCards = ({ catalogue, currentPlanName, cycle, onCycleChange, onChoose, discount, isPaying }) => {
  const current = resolvePlan(currentPlanName);
  const currentPlan = catalogue.plans.find((p) => p.key === current.key);
  const currentRank = planRank(currentPlanName);
  const freeMonths = Math.max(0, ...catalogue.plans.map(monthsFree));
  const ordered = [...catalogue.plans].sort(
    (a, b) => (DESKTOP_ORDER.indexOf(a.key) + 99) % 99 - (DESKTOP_ORDER.indexOf(b.key) + 99) % 99
  );

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
              {b.id === 'annual' && freeMonths >= 1 && (
                <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                  {freeMonths} MONTHS FREE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 pt-2 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            cycle={cycle}
            className={plan.popular ? 'order-first lg:order-none' : ''}
            discount={discount}
            adds={differentiator(plan, currentPlan)}
            isCurrent={(c) => !!isPaying && plan.key === current.key && c === current.cycle}
            isDowngrade={plan.rank < currentRank}
            locked={!!isPaying && plan.rank < currentRank}
            continues={(c) => !isPaying && plan.key === current.key && c === current.cycle}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
};

export default PlanCards;
