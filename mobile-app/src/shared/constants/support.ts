/**
 * How to reach the MolarPlus support team. Mirrors the web build
 * (frontend/src/constants/support.js) — one number, two apps.
 */
export const SUPPORT_EMAIL = 'support@molarplus.com';
export const SUPPORT_PHONE = '+91 9594078777';
export const SUPPORT_PHONE_RAW = '919594078777';

/**
 * When the desk is staffed, in **IST**. The team sits in India, so this is
 * deliberately not the clinic's timezone: a clinic abroad should still see
 * "offline" at 3am Indian time, however reasonable the hour looks to them.
 */
export const SUPPORT_HOURS_IST = { from: 12, to: 21 }; // 12pm–9pm

/** Current hour in India as a decimal (13.5 = 1:30pm), whoever is looking. */
const istHour = (): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // not hour12:false — that yields "24" at midnight on some engines
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return get('hour') + get('minute') / 60;
};

export const isSupportOnline = (): boolean => {
  const h = istHour();
  return h >= SUPPORT_HOURS_IST.from && h < SUPPORT_HOURS_IST.to;
};

/** Two figures, not one average: promising 5–10 at 2am sets up a wait for nobody. */
export const supportResponseTime = (online: boolean = isSupportOnline()): string =>
  (online ? '5–10 minutes' : '20–30 minutes');

/** wa.me link, seeded with who is asking so support can skip a step. */
export const supportWhatsAppLink = (clinicName?: string | null): string => {
  const who = clinicName ? ` I'm from ${clinicName}.` : '';
  const text = encodeURIComponent(`Hi MolarPlus support team, I need help with the app.${who}`);
  return `https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`;
};
