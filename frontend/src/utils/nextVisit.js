/**
 * Next-visit vocabulary and calendar maths, shared by the picker modal, the
 * case paper action bar, and the case paper cards.
 *
 * A case paper stores two things: the recommendation the doctor chose
 * (`next_visit_recommendation`) and the calendar day it resolves to
 * (`next_visit_date`). The phrase is what was decided; the date is what the
 * front desk can act on. Options that have no date by nature (SOS, discharged)
 * store a null date.
 *
 * The label strings below match the old dropdown exactly, so case papers
 * written before the picker existed still read correctly.
 */
import { formatDate } from './datetime';

export const NOT_SPECIFIED = 'Not specified';
export const CUSTOM_DATE_LABEL = 'Specific Date';

// Calendar maths on YYYY-MM-DD, anchored to UTC so a clinic behind or ahead of
// the browser never rolls a day. Feed these clinicToday(), which is already
// clinic-local.
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

export const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + n);
  // 31 Jan + 1 month is 28 Feb, not 3 Mar. setUTCMonth overflows; pull it back.
  if (dt.getUTCDate() !== d) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
};

export const daysBetween = (fromIso, toIso) => {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

export const weekday = (iso) => formatDate(iso, { weekday: 'short' });

export const NEXT_VISIT_INTERVALS = [
  { label: 'Review After 3 Days',   short: '3 days',   add: (t) => addDays(t, 3) },
  { label: 'Review After 1 Week',   short: '1 week',   add: (t) => addDays(t, 7) },
  { label: 'Review After 15 Days',  short: '15 days',  add: (t) => addDays(t, 15) },
  { label: 'Review After 1 Month',  short: '1 month',  add: (t) => addMonths(t, 1) },
  { label: 'Review After 3 Months', short: '3 months', add: (t) => addMonths(t, 3) },
  { label: 'Review After 6 Months', short: '6 months', add: (t) => addMonths(t, 6) },
];

export const NEXT_VISIT_OPEN_ENDED = [
  {
    label: 'SOS (If Pain/Swelling)',
    title: 'Only if it hurts',
    hint: 'Come back on pain or swelling, no booked review',
    icon: 'siren',
    tone: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'No Further Treatment',
    title: 'Treatment complete',
    hint: 'Nothing pending, no return needed',
    icon: 'check',
    tone: 'bg-green-50 text-green-600',
  },
  {
    label: NOT_SPECIFIED,
    title: 'Decide later',
    hint: 'Leave the next visit open for now',
    icon: 'help',
    tone: 'bg-gray-100 text-gray-500',
  },
];

/**
 * One line describing a saved next visit. A real date beats a phrase, so the
 * date wins whenever there is one; older papers that only carry a phrase fall
 * back to a short form of it.
 */
export const nextVisitSummary = (label, date) => {
  if (date) return formatDate(date);
  if (!label || label === NOT_SPECIFIED) return NOT_SPECIFIED;
  const interval = NEXT_VISIT_INTERVALS.find((i) => i.label === label);
  return interval ? `In ${interval.short}` : label;
};
