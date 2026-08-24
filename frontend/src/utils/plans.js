import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * The subscription catalogue, client side.
 *
 * The server is the source of truth: `GET /subscriptions/plans` returns the
 * three plans already priced in this clinic's own billing currency, and in that
 * currency ONLY. The table below exists so the first paint has something to
 * draw before that request lands, and so a failed request degrades to the right
 * numbers rather than an empty screen.
 *
 * ## The India rule
 *
 * An Indian clinic is never shown a dollar figure. Anywhere. The server
 * enforces this by not sending one, and `fallbackCatalogue()` enforces the same
 * thing here by picking a currency first and only ever reading that column.
 * There is no code path in this module that can put a $ in front of an Indian
 * clinic, and any change that makes one possible is a bug regardless of how it
 * looks on screen.
 *
 * Keep the numbers below in step with `backend/core/plans.py`. They are a
 * fallback, not a second opinion: if the two disagree the server wins, and the
 * only symptom will be a price that flickers on load.
 */

const INR = 'INR';
const USD = 'USD';
const GST_RATE = 0.18;

const FALLBACK_PLANS = [
  {
    key: 'plus',
    label: 'Plus',
    tagline: 'Everything one clinic needs to run its day',
    popular: true,
    rank: 1,
    price: { INR: { monthly: 399, annual: 3830 }, USD: { monthly: 4, annual: 38 } },
    limits: { branches: 1, staff: 5, patients: 500, appointments: 500, storage_gb: 100, report_months: 12 },
    features: [
      '1 clinic location',
      '5 staff logins',
      '500 new patients and 500 appointments a month',
      '100 GB storage',
      '12 months of report history',
      'WhatsApp and email reminders from the MolarPlus number',
      '3 ready-made role presets',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    tagline: 'For clinics running more than one branch',
    popular: false,
    rank: 2,
    price: { INR: { monthly: 999, annual: 9590 }, USD: { monthly: 8, annual: 77 } },
    limits: { branches: 5, staff: 10, patients: 1000, appointments: 1000, storage_gb: 150, report_months: null },
    features: [
      'Everything in Plus, plus:',
      'Up to 5 branches',
      '10 staff logins',
      '1,000 new patients and appointments a month',
      '150 GB storage',
      'WhatsApp from your own number',
      'Per-person permissions across 13 modules',
      'One inbox for email and WhatsApp',
      'Local competitor tracking',
      'Your own clinic website',
      'Unlimited reports and bulk export',
      'Priority support',
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    tagline: 'For clinic groups scaling without limits',
    popular: false,
    rank: 3,
    price: { INR: { monthly: 1500, annual: 14400 }, USD: { monthly: 12, annual: 115 } },
    limits: { branches: null, staff: null, patients: null, appointments: null, storage_gb: null, report_months: null },
    features: [
      'Everything in Pro, plus:',
      'Unlimited branches',
      'Unlimited staff logins',
      'Unlimited patients and appointments',
      'Unlimited storage',
      'Cross-branch reporting',
      'Assisted onboarding and migration',
      'A named support contact',
    ],
  },
];

export const INCLUDED_IN_EVERY_PLAN = [
  'Full clinical suite: charting, treatment plans, prescriptions',
  'Invoicing, expenses, inventory, and vendor management',
  'Lab order tracking',
  'E-sign consent forms',
  'Online booking page for patients',
  'Google Reviews integration',
  '12 practice reports, plus attendance and audit logs',
  'Apps for Web, iOS, Android, and Windows',
];

export const TRIAL_PLAN = 'pro';
export const TRIAL_DAYS = 7;

/** Every legacy plan_name production has ever stored, mapped onto the new three. */
const LEGACY_ALIASES = {
  free: 'plus',
  starter: 'plus',
  professional: 'pro',
  professional_annual: 'pro_annual',
  enterprise: 'growth',
};

/** Split a stored plan name into { key, cycle }. Never throws. */
export function resolvePlan(planName) {
  let raw = String(planName || '').trim().toLowerCase();
  raw = LEGACY_ALIASES[raw] || raw;

  let cycle = 'monthly';
  if (raw.endsWith('_annual')) {
    cycle = 'annual';
    raw = raw.slice(0, -'_annual'.length);
  }
  const known = FALLBACK_PLANS.some((p) => p.key === raw);
  return { key: known ? raw : 'plus', cycle };
}

export function planLabel(planName) {
  const { key, cycle } = resolvePlan(planName);
  const plan = FALLBACK_PLANS.find((p) => p.key === key);
  return cycle === 'annual' ? `${plan.label}, annual` : plan.label;
}

export function planRank(planName) {
  const { key } = resolvePlan(planName);
  return FALLBACK_PLANS.find((p) => p.key === key).rank;
}

/** The cap for one limit on this plan, or null for unlimited. */
export function planLimit(planName, field) {
  const { key } = resolvePlan(planName);
  return FALLBACK_PLANS.find((p) => p.key === key).limits[field] ?? null;
}

/**
 * May this plan run more than one clinic?
 *
 * Asked about branches rather than about payment: under the old
 * free-for-one-clinic model those were the same question, and they are not any
 * more. Plus is a paid plan that still covers exactly one location.
 */
export function planAllowsBranches(planName) {
  const max = planLimit(planName, 'branches');
  return max === null || max > 1;
}

/** The clinic on the cached user object, or null. */
function cachedClinic() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.clinic || user.clinics?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * What this clinic is charged in, and therefore all it is ever shown.
 *
 * An unknown country counts as India, matching the server. That is the safe
 * direction: `clinics.country` defaults to 'IN', and showing rupees to somebody
 * abroad is a smaller mistake than showing dollars to somebody in India.
 */
export function billingCurrency(clinic = cachedClinic()) {
  const country = String(clinic?.country || 'IN').toUpperCase();
  return country === 'IN' ? INR : USD;
}

export const isIndia = (clinic = cachedClinic()) => billingCurrency(clinic) === INR;

/** 18% on Indian invoices, nothing elsewhere. */
export const gstRate = (clinic = cachedClinic()) => (isIndia(clinic) ? GST_RATE : 0);

/** "₹3,830" / "$38". Rupees group the Indian way. */
export function formatPrice(amount, currency = billingCurrency()) {
  const value = Number(amount || 0);
  if (currency === INR) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** The catalogue shape the server sends, built locally for first paint. */
export function fallbackCatalogue(clinic = cachedClinic()) {
  // Currency is decided ONCE, here. Everything below reads that one column, so
  // the other currency never enters the object at all.
  const currency = billingCurrency(clinic);

  return {
    currency,
    tax_rate: gstRate(clinic),
    tax_label: currency === INR ? 'GST' : null,
    trial_plan: TRIAL_PLAN,
    trial_days: TRIAL_DAYS,
    included_in_every_plan: INCLUDED_IN_EVERY_PLAN,
    plans: FALLBACK_PLANS.map((plan) => {
      const { monthly, annual } = plan.price[currency];
      return {
        key: plan.key,
        label: plan.label,
        tagline: plan.tagline,
        popular: plan.popular,
        rank: plan.rank,
        currency,
        monthly,
        annual_total: annual,
        annual_monthly: Math.round((annual / 12) * 100) / 100,
        annual_pct_off: monthly ? Math.round((1 - annual / (monthly * 12)) * 100) : 0,
        limits: plan.limits,
        features: plan.features,
      };
    }),
  };
}

/**
 * Is this actually a catalogue from a backend that knows about the three plans?
 *
 * This check is not paranoia, it is a bug that shipped. The previous version of
 * `GET /subscriptions/plans` returned a two-item list shaped
 * `{name, display_name, price}` — no `currency`, no `monthly`, no `key`. The
 * old guard here was `data?.plans?.length`, which that response satisfies, so a
 * frontend talking to a backend one deploy behind replaced a perfectly good
 * fallback with data it could not read and rendered two nameless plans at
 * "₹0 / month" on the page where people decide whether to pay us.
 *
 * Version skew between the two halves is normal during a deploy. The rule is
 * therefore: only accept a payload that is unambiguously the new shape, and
 * otherwise keep showing the built-in numbers, which are correct.
 */
function isUsableCatalogue(data) {
  if (!data || typeof data.currency !== 'string') return false;
  if (!Array.isArray(data.plans) || data.plans.length === 0) return false;
  return data.plans.every(
    (p) => p && typeof p.key === 'string'
      && Number.isFinite(Number(p.monthly))
      && Number.isFinite(Number(p.annual_total))
  );
}

/**
 * The catalogue, server-first.
 *
 * Renders immediately from the fallback so the plan cards never flash empty,
 * then swaps in the server's answer — but only if that answer is legible.
 */
export function usePlanCatalogue() {
  const [catalogue, setCatalogue] = useState(fallbackCatalogue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api.get('/subscriptions/plans')
      .then((data) => {
        if (!live) return;
        if (isUsableCatalogue(data)) {
          setCatalogue(data);
        } else {
          // Loud on purpose. Silently showing the fallback would hide a real
          // deploy mismatch, and the fallback is only right until prices move.
          console.warn(
            '[plans] /subscriptions/plans returned an unrecognised shape; '
            + 'the backend is probably older than this build. Using built-in prices.',
            data
          );
        }
      })
      .catch(() => { /* the fallback is already on screen */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return { catalogue, loading };
}

/**
 * Is this a usage payload from a backend that knows about plan limits?
 *
 * Same treatment as `isUsableCatalogue`, and for the same reason: a stale
 * backend answering 404 or with an older shape must leave the meters absent
 * rather than draw bars against `undefined`. A meter is only persuasive because
 * it is true, so "no answer" has to render as nothing at all.
 */
function isUsableUsage(data) {
  if (!data || typeof data.metrics !== 'object' || data.metrics === null) return false;
  return Object.values(data.metrics).every(
    (m) => m && Number.isFinite(Number(m.used))
      && (m.limit === null || Number.isFinite(Number(m.limit)))
  );
}

/**
 * What this clinic is using against what its plan allows.
 *
 * Returns `null` until it has a real answer, and stays `null` if the call fails.
 * Callers render nothing in that case — deliberately, because the headroom
 * nudge that hangs off these numbers must never fire off a guess.
 */
export function usePlanUsage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api.get('/subscriptions/usage')
      .then((data) => {
        if (live && isUsableUsage(data)) setUsage(data);
      })
      .catch(() => { /* meters simply do not render */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return { usage, loading };
}

/** How each metric reads in a sentence. Mirrors core/plan_usage.LABELS. */
export const METRIC_LABELS = {
  staff: 'Staff logins',
  patients: 'New patients',
  appointments: 'Appointments',
  branches: 'Branches',
  storage_gb: 'Storage',
};

/**
 * The singular form, for a limit of one.
 *
 * Plus covers exactly one branch, so this is not an edge case: without it the
 * upgrade nudge reads "your 1 branches", which is the kind of sentence that
 * makes the whole screen look unfinished.
 */
export const METRIC_SINGULAR = {
  staff: 'staff login',
  patients: 'new patient',
  appointments: 'appointment',
  branches: 'branch',
  storage_gb: 'GB of storage',
};

export const metricNoun = (key, count) =>
  count === 1
    ? (METRIC_SINGULAR[key] || key)
    : (METRIC_LABELS[key] || key).toLowerCase();

/** Metrics that reset every month. */
export const MONTHLY_METRICS = new Set(['patients', 'appointments']);

/**
 * Metrics at or past 80% of their limit, worst first.
 *
 * Mirrors `core.plan_usage.pressured`, including the rule that a limit of 1 with
 * a usage of 1 is skipped: that is every single-clinic account's branch count,
 * and a full bar reading "1 of 1" looks like a problem rather than a fact.
 */
export function pressuredMetrics(usage) {
  if (!usage?.metrics) return [];
  return Object.entries(usage.metrics)
    .filter(([, m]) => m.limit && !(m.limit === 1 && (m.used || 0) <= 1))
    .map(([key, m]) => ({ key, ...m, ratio: (m.used || 0) / m.limit }))
    .filter((m) => m.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio);
}

/** The cheapest plan that raises `metric` above `currentLimit`, or null. */
export function nextPlanFor(metric, currentPlanName, currentLimit) {
  const rank = planRank(currentPlanName);
  return FALLBACK_PLANS
    .filter((p) => p.rank > rank)
    .sort((a, b) => a.rank - b.rank)
    .find((p) => p.limits[metric] === null || p.limits[metric] > currentLimit) || null;
}

/**
 * The one promo, if any, worth putting in front of every clinic.
 *
 * Returns `null` when there is nothing to show, which is the common case. The
 * server re-checks active / unexpired / uses-left on every request rather than
 * trusting the flag, so a code that ran out overnight stops being advertised
 * immediately: advertising a code that then fails at checkout is worse than
 * never mentioning it.
 */
export function useFeaturedPromo() {
  const [promo, setPromo] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/subscriptions/featured-promo')
      .then((data) => {
        if (live && data?.promo?.code) setPromo(data.promo);
      })
      .catch(() => { /* no banner is the right failure */ });
    return () => { live = false; };
  }, []);

  return promo;
}

/**
 * Whole days until `iso`, or null when there is no date.
 *
 * Only ever used against a coupon's real expiry. Nothing in this product
 * counts down to a deadline it invented.
 */
export function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
