/**
 * Clinic-timezone-aware date/time formatting.
 *
 * The backend stores timestamps in UTC and serializes them WITHOUT a timezone
 * marker (e.g. "2026-07-18T20:00:00"). A bare `new Date(...)` reads that as the
 * viewer's local time and shows the wrong clock. These helpers parse such strings
 * as UTC and format them in the CLINIC's timezone, so every user sees the clinic's
 * local time, not their own browser's.
 *
 * Pure dates (YYYY-MM-DD, e.g. a payment's paid_on) are calendar days with no time
 * of day, so they are formatted as-is without any timezone shifting (which would
 * otherwise roll them to the previous day for timezones behind UTC).
 */

const DEFAULT_TZ = 'Asia/Kolkata';

export function getClinicTimezone() {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      const clinic = user.clinic || user.clinics?.[0];
      if (clinic?.timezone) return clinic.timezone;
    }
  } catch { /* ignore */ }
  return DEFAULT_TZ;
}

const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

// Parse a backend timestamp into a correct instant. Naive strings (no offset) are
// treated as UTC, since that is how the backend stores them.
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

const DATETIME_OPTS = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: true };

// Format a bare calendar date (no timezone shifting).
function formatCalendarDate(value, opts, locale) {
  const [y, m, d] = value.trim().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { timeZone: 'UTC', ...opts });
}

export function formatDateTime(value, opts = DATETIME_OPTS, locale = 'en-IN') {
  if (isDateOnly(value)) return formatCalendarDate(value, opts, locale);
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleString(locale, { timeZone: getClinicTimezone(), ...opts });
}

export function formatDate(value, opts = DATE_OPTS, locale = 'en-IN') {
  if (isDateOnly(value)) return formatCalendarDate(value, opts, locale);
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleDateString(locale, { timeZone: getClinicTimezone(), ...opts });
}

export function formatTime(value, opts = TIME_OPTS, locale = 'en-IN') {
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleTimeString(locale, { timeZone: getClinicTimezone(), ...opts });
}

// The clinic's local "today" as YYYY-MM-DD (for date-picker defaults and
// "is this today" checks). en-CA yields ISO-style output.
export function clinicToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: getClinicTimezone() });
}

// The clinic-local date key (YYYY-MM-DD) for a server timestamp.
export function clinicDateKey(value) {
  if (isDateOnly(value)) return value.trim();
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-CA', { timeZone: getClinicTimezone() });
}

// Relative "time ago" from a correctly-parsed instant.
export function formatRelative(value) {
  const d = parseServerDate(value);
  if (!d) return { relative: 'Never', exact: '' };
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  let relative;
  if (mins < 1) relative = 'Just now';
  else if (mins < 60) relative = `${mins}m ago`;
  else if (hours < 24) relative = `${hours}h ago`;
  else if (days === 1) relative = 'Yesterday';
  else if (days < 7) relative = `${days} days ago`;
  else if (days < 30) relative = `${Math.floor(days / 7)}w ago`;
  else if (days < 365) relative = `${Math.floor(days / 30)}mo ago`;
  else relative = `${Math.floor(days / 365)}y ago`;
  return { relative, exact: formatDateTime(value) };
}

// ─── Editing a timestamp, in the clinic's timezone ──────────────────────────
//
// Reading a time is one direction; typing one is the other, and it is the one
// that goes wrong silently. A <input type="date"> plus <input type="time"> hand
// back the clinic's wall clock, and `new Date("2026-04-12T15:30")` reads that
// as the BROWSER's wall clock — so a receptionist in Dubai back-dating a visit
// for a Mumbai clinic would store it 90 minutes out and nothing would say so.

// How far the timezone is from UTC at a given instant, in minutes. Derived by
// formatting the instant in that zone and reading the answer back, which is the
// only way to get it without shipping a timezone database.
function tzOffsetMinutes(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value])
  );
  const asIfUTC = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second
  );
  // Seconds resolution: the formatter has no milliseconds, so the instant is
  // floored to match before the two are subtracted.
  return (asIfUTC - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
}

/** A server timestamp split into the two values a date + time input want. */
export function clinicInputParts(value) {
  const d = parseServerDate(value);
  if (!d) return { date: '', time: '' };
  const tz = getClinicTimezone();
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: tz }),
    time: d.toLocaleTimeString('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }),
  };
}

/**
 * The reverse: a clinic-local date and time back into a UTC ISO string.
 *
 * The offset is resolved twice on purpose. The first pass uses the offset at
 * roughly the right instant; on the two days a year a zone changes offset that
 * can land on the wrong side of the switch, and the second pass corrects it.
 * India never does this, but the app runs in ~160 countries that do.
 */
export function clinicPartsToServer(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const tz = getClinicTimezone();
  const wallClock = Date.UTC(y, m - 1, d, hh, mm, 0);
  let instant = wallClock - tzOffsetMinutes(new Date(wallClock), tz) * 60000;
  const settled = tzOffsetMinutes(new Date(instant), tz);
  instant = wallClock - settled * 60000;
  return new Date(instant).toISOString();
}
