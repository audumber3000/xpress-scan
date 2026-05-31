/**
 * Subscription pricing — currency aware (mirrors the web app's pricing util).
 *
 * India is shown in INR; everywhere else we display USD ($10/mo). This is a
 * two-tier DISPLAY: it does not convert to each local currency.
 *
 * NOTE: the actual in-app payment (Android, Cashfree) still charges INR — this
 * util only drives what price is *shown*. True international billing needs a
 * USD-capable gateway. iOS shows no in-app price at all (managed on the web).
 */

export interface PricingTier {
  code: string;
  symbol: string;
  monthly: number;
  annualTotal: number;
  annualMonthly: number;
  save: number;
  pctOff: number;
}

const INDIA: PricingTier = {
  code: 'INR',
  symbol: '₹',
  monthly: 899,
  annualTotal: 8100,
  annualMonthly: 675,
  save: 2688,
  pctOff: 25,
};

const INTERNATIONAL: PricingTier = {
  code: 'USD',
  symbol: '$',
  monthly: 10,
  annualTotal: 96,
  annualMonthly: 8,
  save: 24,
  pctOff: 20,
};

interface ClinicLike {
  country?: string;
  currency_code?: string;
  currency_symbol?: string;
}

/**
 * Returns the pricing tier for the given clinic. Defaults to India when nothing
 * is known (the app's home market).
 */
export function getSubscriptionPricing(clinic?: ClinicLike): PricingTier {
  const country = String(clinic?.country || '').toUpperCase();
  const isIndia = country
    ? country === 'IN'
    : clinic?.currency_code
    ? clinic.currency_code === 'INR'
    : clinic?.currency_symbol
    ? clinic.currency_symbol === '₹'
    : true;
  return isIndia ? INDIA : INTERNATIONAL;
}
