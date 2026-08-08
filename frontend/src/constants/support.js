/**
 * How to reach the MolarPlus support team.
 *
 * One source, because these appear in two places now — the header's support
 * card and the Support page — and a phone number that disagrees with itself
 * across two screens is worse than one that's only in a single place.
 */
export const SUPPORT_EMAIL = 'support@molarplus.com';
export const SUPPORT_PHONE = '+91 9594078777';
export const SUPPORT_PHONE_RAW = '919594078777';

/**
 * When the support desk is staffed, in **IST** — the team sits in India, so this
 * is deliberately not the clinic's timezone. A clinic in Dubai should still see
 * "offline" at 3am Indian time, however reasonable the hour looks to them.
 */
export const SUPPORT_HOURS_IST = { from: 12, to: 21 }; // 12pm–9pm

/** Current hour in India as a decimal (13.5 = 1:30pm), whoever is looking. */
const istHour = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // not hour12:false — that yields "24" at midnight in some engines
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return get('hour') + get('minute') / 60;
};

export const isSupportOnline = () => {
  const h = istHour();
  return h >= SUPPORT_HOURS_IST.from && h < SUPPORT_HOURS_IST.to;
};

/**
 * How long a reply takes. Two figures rather than one average: promising 15–30
 * at 2am sets someone up to wait for nobody, and understates how fast the desk
 * actually is during the day.
 */
export const supportResponseTime = (online = isSupportOnline()) =>
  (online ? '5–10 minutes' : '20–30 minutes');

export const SUPPORT_WHATSAPP_TEXT = encodeURIComponent(
  'Hi MolarPlus support team, I need help with the app.'
);

/** wa.me link, optionally seeded with who is asking so support can skip a step. */
export const supportWhatsAppLink = (user) => {
  const who = user?.clinic?.name ? ` I'm from ${user.clinic.name}.` : '';
  const text = encodeURIComponent(`Hi MolarPlus support team, I need help with the app.${who}`);
  return `https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`;
};
