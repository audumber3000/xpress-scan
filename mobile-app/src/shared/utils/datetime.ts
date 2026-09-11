/**
 * Small date helpers for the clinic app.
 *
 * The web app resolves "today" in the clinic's stored timezone. On mobile the
 * device is physically in the clinic, so the device-local day is the right
 * default and avoids threading a timezone through every screen. Backends still
 * validate against the clinic's day, so these values are only defaults/display.
 *
 * All ISO values are bare calendar dates (YYYY-MM-DD), matching how the API
 * takes `registered_on`, `paid_on`, `visit_date`, etc.
 */

/** Today as YYYY-MM-DD in the device's local timezone (en-CA yields ISO order). */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** True for a well-formed YYYY-MM-DD that is today or earlier. */
export function isValidPastDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d.getTime()) && s <= todayISO();
}

/** True for any well-formed YYYY-MM-DD. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s + 'T00:00:00').getTime());
}

/**
 * A bare calendar date as "23 Jul 2026". Built from the string parts (not
 * `new Date(iso)`, which reads as UTC midnight and can slip a day west of GMT).
 */
export function formatDisplayDate(value?: string | null): string {
  if (!value) return '';
  const iso = value.length > 10 ? value.slice(0, 10) : value;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** A server timestamp as a Date. Naive values are UTC, as the server writes them. */
export function parseServerTime(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

/** 495 -> "8h 15m", 540 -> "9h", 45 -> "45m". */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.floor(total));
  const h = Math.floor(m / 60);
  if (!h) return `${m}m`;
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** A server timestamp shown as clock time in the device timezone, e.g. "2:30 PM". */
export function formatTime(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** N days before an ISO date, as YYYY-MM-DD. */
export function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
