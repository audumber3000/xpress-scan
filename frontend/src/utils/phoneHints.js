/**
 * Is this number plausible for the country the clinic just picked?
 *
 * Written after a real signup dead-ended on it. A clinic set to US entered
 * `1758203919`; the backend saw ten digits, matched the US national length,
 * prepended the dial code and sent WhatsApp to `11758203919` — area code 175,
 * which does not exist. MSG91 accepted the message, the screen said the code
 * was on its way, and the owner sat there resending. Four sends and twenty-two
 * wrong codes later they left, and the clinic has zero patients to this day.
 *
 * The lesson is not "validate harder". It is that this field feeds a one-way
 * door: nothing downstream can tell an undeliverable number from a number
 * whose owner is slow to check WhatsApp, so the only place it can be caught is
 * before it is accepted.
 *
 * Two tiers, deliberately:
 *
 *   'blocked'  the number cannot exist under its own numbering plan. Only the
 *              NANP area-code rule qualifies, because it is the one case that
 *              is a fact rather than a guess.
 *   'warn'     the length is unusual for this country. Shown, never enforced —
 *              these tables are approximations, and being told your own phone
 *              number is wrong when it is not is worse than a bad OTP.
 *
 * Everything else returns null and gets out of the way.
 */

// Mirrors backend/core/phone.py NATIONAL_LENGTHS, plus the countries whose
// length is 10 and which we therefore know rather than merely default to.
const NATIONAL_LENGTHS = {
  SG: 8, HK: 8, QA: 8, KW: 8, BH: 8, OM: 8,
  AE: 9, SA: 9, AU: 9, FR: 9, ES: 9, KE: 9, ZA: 9, NP: 9,
  CN: 11, BR: 11,
  IN: 10, US: 10, CA: 10, GB: 10, PK: 10, BD: 10, NG: 10,
};

const nationalLength = (country) => NATIONAL_LENGTHS[String(country || 'IN').toUpperCase()] || 10;

/**
 * Do we actually know how long a number is here, or are we falling back to ten?
 *
 * The distinction matters more than it looks. An early version warned on any
 * country, using the backend's default of 10 as if it were a fact, and told a
 * real Lebanese clinic — eight-digit numbers, signed up and verified months
 * ago — that its own phone number looked short. Telling a doctor their number
 * is wrong when it is not is worse than saying nothing, because the one thing
 * a warning has to be is worth reading.
 */
const isKnown = (country) =>
  Object.prototype.hasOwnProperty.call(NATIONAL_LENGTHS, String(country || '').toUpperCase());

/**
 * @param {string} raw      what they typed
 * @param {string} country  ISO-2
 * @param {string} dialCode e.g. "+1", "+91"
 * @returns {{ level: 'blocked'|'warn', message: string } | null}
 */
export function phoneHint(raw, country, dialCode = '') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 4) return null;          // still typing; say nothing yet

  const dial = String(dialCode || '').replace(/\D/g, '');
  const expected = nationalLength(country);

  // Strip a trunk zero or a typed-in country code so the length check below is
  // looking at the subscriber number, the same way the backend does.
  let national = digits;
  if (national.startsWith('00')) national = national.slice(2);
  if (dial && national.startsWith(dial) && national.length > expected) {
    national = national.slice(dial.length);
  }
  if (national.startsWith('0') && national.length > expected) national = national.slice(1);

  // North American Numbering Plan: an area code never begins 0 or 1. This is
  // the rule the US signup above broke, and it is checkable with certainty.
  if (dial === '1' && national.length === 10 && /^[01]/.test(national)) {
    return {
      level: 'blocked',
      message:
        'A US or Canadian number cannot start with a 0 or 1 after the country code. ' +
        'Check the number — this is where your verification code is going.',
    };
  }

  // Past this point we are only guessing at length, so unless the country is
  // one we actually have a number for, say nothing.
  if (!isKnown(country)) return null;

  if (national.length < expected - 1) {
    return {
      level: 'warn',
      message: `That looks short for ${dialCode || 'this country'}. Usually ${expected} digits.`,
    };
  }
  if (national.length > expected + 2) {
    return {
      level: 'warn',
      message: `That looks long for ${dialCode || 'this country'}. Usually ${expected} digits.`,
    };
  }

  return null;
}
