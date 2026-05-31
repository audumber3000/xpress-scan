/**
 * Subscription pricing — currency aware.
 *
 * India is billed in INR; everywhere else we display USD ($10/mo). This is a
 * two-tier display: it does NOT convert to each local currency, it just shows
 * Indian clinics ₹ and international clinics $ (per product decision).
 *
 * NOTE: actual payment is processed by Cashfree (INR). International USD billing
 * needs a USD-capable gateway before checkout can truly charge $ — until then
 * these figures are for display/marketing.
 */

const INDIA = {
  code: 'INR',
  symbol: '₹',
  monthly: 899,
  annualTotal: 8100,
  annualMonthly: 675, // annualTotal / 12
  save: 2688,         // monthly * 12 - annualTotal
  pctOff: 25,         // round(save / (monthly * 12))
};

const INTERNATIONAL = {
  code: 'USD',
  symbol: '$',
  monthly: 10,
  annualTotal: 96,
  annualMonthly: 8,   // annualTotal / 12
  save: 24,           // monthly * 12 - annualTotal
  pctOff: 20,         // round(save / (monthly * 12))
};

function clinicLocale() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const clinic = user.clinic || user.clinics?.[0];
    return { country: clinic?.country, currency: clinic?.currency_code };
  } catch {
    return {};
  }
}

/**
 * Returns the pricing tier for the given country (or the logged-in clinic).
 * Defaults to India when nothing is known (the app's home market).
 * @param {string} [countryOverride] ISO alpha-2 code (used during onboarding,
 *   before a clinic row exists).
 */
export function getSubscriptionPricing(countryOverride) {
  const { country, currency } = clinicLocale();
  const code = String(countryOverride || country || '').toUpperCase();
  const isIndia = code ? code === 'IN' : currency ? currency === 'INR' : true;
  return isIndia ? INDIA : INTERNATIONAL;
}
