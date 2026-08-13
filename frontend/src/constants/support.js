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
 * The person on the other end.
 *
 * A named face rather than a headset icon, because "Talk to support" is a
 * department and a department is something you brace yourself to contact.
 * Someone with a name is somebody you message. The details live here so the
 * header card and the Support page cannot introduce two different people.
 */
export const SUPPORT_AGENT = {
  name: 'Rohit Kale',
  role: 'Customer Success Lead',
  initials: 'RK',
  /**
   * Every trait is pinned rather than left to the seed. The generic avatar
   * helper randomises hair, clothing and features from whatever string it is
   * given, which can hand a support agent named Rohit a face that reads as
   * somebody else entirely — the one thing a card meant to feel like a real
   * person cannot afford. Spelling the options out makes the face fixed, so it
   * is the same man every time anyone opens the card, on any device.
   */
  avatarUrl:
    'https://api.dicebear.com/9.x/avataaars/svg?seed=rohit-kale' +
    '&top=shortFlat&hairColor=2c1b18' +
    '&facialHair=beardLight&facialHairProbability=100&facialHairColor=2c1b18' +
    '&skinColor=d08b5b&eyes=default&eyebrows=default&mouth=default' +
    '&clothing=blazerAndShirt&clothesColor=3c4f5c&accessoriesProbability=0' +
    '&backgroundColor=ffffff&radius=50&size=96',
};

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
  (online ? '2 to 5 minutes' : '20 to 30 minutes');

/** "12pm to 9pm IST", built from the hours above so the two cannot disagree. */
const hour12 = (h) => {
  const suffix = h >= 12 ? 'pm' : 'am';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
};
export const supportHoursLabel = () =>
  `${hour12(SUPPORT_HOURS_IST.from)} to ${hour12(SUPPORT_HOURS_IST.to)} IST`;

/**
 * What Rohit says when the card opens. First person, and addressed to whoever
 * is looking when we know their name, because the whole point of the card is
 * that it reads like a message rather than a contact listing.
 *
 * Says what he can help WITH, not how fast he replies. A reply time in the
 * greeting turns the first thing he says into a service-level promise, which
 * is the tone of a ticket queue. The time still appears, once, in the footer
 * where it belongs as a fact rather than an opening line.
 */
export const supportGreeting = (user, online = isSupportOnline()) => {
  const first = (user?.name || '').trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first}` : 'Hi';
  const what = 'any error, setting up your clinic, or anything you are stuck on';
  return online
    ? `${hi}, I'm here to help with ${what}. Just text me, and please don't be shy to ask.`
    : `${hi}, I'm off the desk right now. For ${what}, text me anyway and I'll pick it up first thing when I'm back.`;
};

export const SUPPORT_WHATSAPP_TEXT = encodeURIComponent(
  `Hi ${SUPPORT_AGENT.name.split(' ')[0]}, I need help with MolarPlus.`
);

/** wa.me link, optionally seeded with who is asking so support can skip a step. */
export const supportWhatsAppLink = (user) => {
  const who = user?.clinic?.name ? ` I'm from ${user.clinic.name}.` : '';
  const text = encodeURIComponent(
    `Hi ${SUPPORT_AGENT.name.split(' ')[0]}, I need help with MolarPlus.${who}`
  );
  return `https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`;
};
