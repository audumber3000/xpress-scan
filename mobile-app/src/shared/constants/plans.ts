/**
 * The subscription catalogue, on the phone.
 *
 * Mirrors `backend/core/plans.py` and `frontend/src/utils/plans.js`. Kept as a
 * static table rather than fetched, because everything the app needs from it is
 * a label or a limit, and a screen that cannot name the current plan until a
 * request comes back is worse than one showing figures a release out of date.
 *
 * ## Why this file exists at all
 *
 * Plan names were string literals scattered across the app, and two of them
 * were load-bearing:
 *
 *   - `FeatureLock` tested `plan === 'professional'`, so the moment a Pro clinic
 *     started being called `pro` it would have locked multi-branch for the
 *     customers actually paying for it
 *   - `PLAN_META` was keyed `free` / `professional`, so a Plus clinic fell
 *     through to the `free` entry and was shown "Free"
 *
 * `LEGACY_ALIASES` is what keeps old rows readable. Production has stored
 * `free`, `professional`, `professional_annual` and `enterprise`, and a phone
 * that has not been opened for a year will still be handed them. Do not remove
 * it.
 *
 * ## Buying does not happen here
 *
 * There is no price-to-checkout path in the app on either platform: see
 * `shared/constants/platform.ts`. These prices exist so the plan screen can
 * describe what each plan costs, not so anything can charge for one.
 */

export type PlanKey = 'plus' | 'pro' | 'growth';
export type BillingCycle = 'monthly' | 'annual';
export type Currency = 'INR' | 'USD';

export interface PlanLimits {
  branches: number | null;
  staff: number | null;
  patients: number | null;
  appointments: number | null;
  storage_gb: number | null;
}

export interface Plan {
  key: PlanKey;
  rank: number;
  label: string;
  tagline: string;
  popular: boolean;
  price: Record<Currency, Record<BillingCycle, number>>;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanKey, Plan> = {
  plus: {
    key: 'plus',
    rank: 1,
    label: 'Plus',
    tagline: 'Everything one clinic needs to run its day',
    popular: true,
    price: { INR: { monthly: 399, annual: 3830 }, USD: { monthly: 4, annual: 38 } },
    limits: { branches: 1, staff: 5, patients: 500, appointments: 500, storage_gb: 100 },
    features: [
      '1 clinic location',
      '5 staff logins',
      '500 new patients and 500 appointments a month',
      '100 GB storage',
      '12 months of report history',
      'WhatsApp and email reminders from the MolarPlus number',
    ],
  },
  pro: {
    key: 'pro',
    rank: 2,
    label: 'Pro',
    tagline: 'For clinics running more than one branch',
    popular: false,
    price: { INR: { monthly: 999, annual: 9590 }, USD: { monthly: 8, annual: 77 } },
    limits: { branches: 5, staff: 10, patients: 1000, appointments: 1000, storage_gb: 150 },
    features: [
      'Everything in Plus, plus:',
      'Up to 5 branches',
      '10 staff logins',
      '1,000 new patients and appointments a month',
      '150 GB storage',
      'WhatsApp from your own number',
      'One inbox for email and WhatsApp',
      'Priority support',
    ],
  },
  growth: {
    key: 'growth',
    rank: 3,
    label: 'Growth',
    tagline: 'For clinic groups scaling without limits',
    popular: false,
    price: { INR: { monthly: 1500, annual: 14400 }, USD: { monthly: 12, annual: 115 } },
    limits: { branches: null, staff: null, patients: null, appointments: null, storage_gb: null },
    features: [
      'Everything in Pro, plus:',
      'Unlimited branches',
      'Unlimited staff logins',
      'Unlimited patients and appointments',
      'Unlimited storage',
      'Cross-branch reporting',
      'A named support contact',
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ['plus', 'pro', 'growth'];

export const INCLUDED_IN_EVERY_PLAN = [
  'Full clinical suite: charting, treatment plans, prescriptions',
  'Invoicing, expenses, inventory, and vendor management',
  'Lab order tracking',
  'E-sign consent forms',
  'Online booking page for patients',
  '12 practice reports, plus attendance and audit logs',
];

export const DEFAULT_PLAN: PlanKey = 'plus';
export const TRIAL_PLAN: PlanKey = 'pro';
export const TRIAL_DAYS = 7;

/** Every plan_name production has ever stored, mapped onto the current three. */
const LEGACY_ALIASES: Record<string, string> = {
  free: 'plus',
  starter: 'plus',
  professional: 'pro',
  professional_annual: 'pro_annual',
  enterprise: 'growth',
};

/**
 * Split any stored plan name into its key and billing cycle.
 *
 * Total by design: an unknown or missing name resolves to the entry plan rather
 * than throwing. This runs on read paths where there is nothing useful to do
 * with an exception, and a screen that crashes is worse than one naming the
 * wrong plan.
 */
export function resolvePlan(planName?: string | null): { key: PlanKey; cycle: BillingCycle } {
  let raw = String(planName || '').trim().toLowerCase();
  raw = LEGACY_ALIASES[raw] || raw;

  let cycle: BillingCycle = 'monthly';
  if (raw.endsWith('_annual')) {
    cycle = 'annual';
    raw = raw.slice(0, -'_annual'.length);
  }
  const key = (PLAN_ORDER as string[]).includes(raw) ? (raw as PlanKey) : DEFAULT_PLAN;
  return { key, cycle };
}

export function planLabel(planName?: string | null): string {
  const { key, cycle } = resolvePlan(planName);
  return cycle === 'annual' ? `${PLANS[key].label}, annual` : PLANS[key].label;
}

export function planRank(planName?: string | null): number {
  return PLANS[resolvePlan(planName).key].rank;
}

export function planLimit(planName: string | null | undefined, field: keyof PlanLimits): number | null {
  return PLANS[resolvePlan(planName).key].limits[field];
}

/**
 * May this plan run more than one clinic?
 *
 * Asked about branches rather than about payment. Under the old
 * free-for-one-clinic model those were the same question; they are not any
 * more, because Plus is a paid plan that still covers exactly one location.
 */
export function planAllowsBranches(planName?: string | null): boolean {
  const max = planLimit(planName, 'branches');
  return max === null || max > 1;
}

/**
 * What a clinic is charged in, and therefore all it is ever shown.
 *
 * India pays in rupees, everywhere else in US dollars. An unknown country
 * counts as India: `clinics.country` defaults to 'IN', and showing rupees to
 * somebody abroad is a smaller mistake than showing dollars to somebody in
 * India, which is the one thing this must never do.
 */
export function billingCurrency(country?: string | null): Currency {
  return String(country || 'IN').toUpperCase() === 'IN' ? 'INR' : 'USD';
}

/** "₹3,830" / "$38". Rupees group the Indian way. */
export function formatPrice(amount: number, currency: Currency = 'INR'): string {
  const value = Number(amount || 0);
  return currency === 'INR'
    ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function planPrice(
  planName: string | null | undefined,
  currency: Currency = 'INR',
): number {
  const { key, cycle } = resolvePlan(planName);
  return PLANS[key].price[currency][cycle];
}

/**
 * What the yearly price works out to per month.
 *
 * Annual figures are the ones that frighten people. "₹14,400" reads as the
 * price of the thing, and somebody comparing it against a ₹399 line has to do
 * the division themselves to find out it is actually cheaper. Quote the yearly
 * option per month, the way the monthly one is quoted, and the comparison
 * becomes ₹1,500 against ₹1,200 instead of ₹1,500 against ₹14,400.
 *
 * Rupees round to whole rupees, dollars to the cent. Rounding means 12 × this
 * is a rupee or two off the real annual total, which is why every place that
 * shows this figure also prints the exact amount that gets charged. The
 * rounding must never be the only number on screen.
 */
export function monthlyEquivalent(
  planName: string | null | undefined,
  currency: Currency = 'INR',
): number {
  const { key } = resolvePlan(planName);
  const annual = PLANS[key].price[currency].annual;
  return currency === 'INR'
    ? Math.round(annual / 12)
    : Math.round((annual / 12) * 100) / 100;
}

/**
 * How much less the yearly option costs, as a percentage.
 *
 * Computed rather than written down, so a price change cannot leave a "save
 * 20%" label attached to a plan that no longer saves anything. The web
 * collateral currently claims 20% on a USD annual price that saves nothing;
 * this is the shape that stops that happening again.
 */
export function annualSavingPercent(
  planName: string | null | undefined,
  currency: Currency = 'INR',
): number {
  const { key } = resolvePlan(planName);
  const { monthly, annual } = PLANS[key].price[currency];
  if (!monthly) return 0;
  return Math.round((1 - annual / (monthly * 12)) * 100);
}
