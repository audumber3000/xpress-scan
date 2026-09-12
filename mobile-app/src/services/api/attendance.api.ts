import { BaseApiService } from './base.api';
import { Fix } from '../../shared/utils/location';

/**
 * Clocking on and off, and the clinic pin it is measured against.
 *
 * The geofence decision is the server's, never this file's. A client that
 * decided for itself whether it was close enough would be trivially defeated by
 * anyone willing to change their phone's location, which rather defeats the
 * point of recording it.
 */

export interface ClockStatus {
  is_clocked_in: boolean;
  /** Whether clocking in right now would be recorded as late, so the screen can
   *  ask why before sending instead of after. Null-ish when the clinic has no
   *  hours set for today, which means no prompt at all. */
  late_now?: boolean;
  late_by_minutes?: number | null;
  opening_time?: string | null;
  grace_minutes?: number;
  is_done_for_today: boolean;
  attendance_id: number | null;
  clock_in_time: string | null;
  clock_out_time: string | null;
  clock_in_distance_m: number | null;
  geofence_set: boolean;
  geofence_radius_m: number;
  /** The pin, so the screen can show where you are against it before you tap. */
  clinic_name?: string | null;
  clinic_latitude?: number | null;
  clinic_longitude?: number | null;
  /** Breaks within today's shift. */
  on_break?: boolean;
  break_started_at?: string | null;
  break_minutes?: number;
  /** What this person themselves did today. The server counts distinct
   *  patients, and deliberately offers both figures: a doctor sees people, a
   *  receptionist books and registers them. */
  today?: {
    patients_seen: number;
    patients_registered: number;
    appointments: number;
  };
}

export interface Geofence {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  is_set: boolean;
  clinic_name: string | null;
}

/**
 * Thrown when the server refuses a clock-in on distance.
 *
 * Its own class because the screen treats it completely differently from a
 * network failure: this one is not an error to apologise for, it is an answer,
 * and it gets the "you look 412 m away" panel rather than a red toast.
 */
export class OutsideGeofenceError extends Error {
  readonly outsideGeofence = true;
  constructor(message: string) {
    super(message);
    this.name = 'OutsideGeofenceError';
  }
}

async function detailOf(res: Response, fallback: string): Promise<string> {
  try {
    const d = (await res.json())?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  } catch { /* non-JSON */ }
  return fallback;
}

/** One day in the month view. Null is the future; an empty object is a day
 *  that came and went without a record. */
export type AttendanceDayCell = null | Record<string, never> | {
  id: number;
  status: string;
  reason: string;
  notes: string;
  check_in: string | null;
  check_out: string | null;
  worked_minutes: number | null;
  break_minutes: number;
  expected_open: string | null;
  late_by_minutes: number | null;
  is_open_shift: boolean;
  source: string;
  marked_by_name: string | null;
  clock_in?: { distance_m: number | null; address: string | null; outside_geofence: boolean | null } | null;
  clock_out?: { distance_m: number | null; address: string | null; outside_geofence: boolean | null } | null;
};

export interface AttendanceMonth {
  /** Every day of the month as YYYY-MM-DD, in order. */
  days: string[];
  attendance: Record<string, AttendanceDayCell>;
  summary: {
    marked_days: number; on_time: number; late: number; absent: number;
    holiday: number; present: number; worked_minutes: number; total_late_minutes: number;
  };
}

export interface AttendanceDay {
  id: number;
  date: string;
  /** on_time | late | absent | holiday */
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  reason: string | null;
}

class AttendanceApiService extends BaseApiService {
  /** This user's own shifts, newest first. */
  async getHistory(limit = 60): Promise<AttendanceDay[]> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(
      `${this.baseURL}/attendance-mobile/history?limit=${limit}`, { headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not load your attendance'));
    return res.json();
  }

  /**
   * One month of your own days, the same loader the owner's grid reads
   * (`/attendance/calendar`), so the two can never disagree about a day.
   *
   * `user_id` is sent for clarity; the server scopes it to you anyway unless you
   * have the Attendance permission.
   */
  async getMonth(month: string, userId: number): Promise<AttendanceMonth> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(
      `${this.baseURL}/attendance/calendar?month=${encodeURIComponent(month)}&user_id=${userId}`,
      { headers },
    );
    if (!res.ok) throw new Error(await detailOf(res, 'Could not load your attendance'));
    const data = await res.json();
    const mine = (data.employees || [])[0];
    return {
      days: data.days || [],
      attendance: mine?.attendance || {},
      summary: mine?.summary || {
        marked_days: 0, on_time: 0, late: 0, absent: 0, holiday: 0,
        present: 0, worked_minutes: 0, total_late_minutes: 0,
      },
    };
  }

  /**
   * The clinic and where you are standing, on a real Google map.
   *
   * A URL plus headers rather than an image: the map is served by our own
   * authenticated endpoint, which holds the Google key. Shipping the key in the
   * app would put it in every APK anybody cares to unzip.
   *
   * `<Image source={{ uri, headers }}>` is understood by both platforms and
   * caches the result, so a screen that redraws does not buy another map.
   */
  async mapSource(fix: Fix | null, width: number, height: number): Promise<{ uri: string; headers: Record<string, string> }> {
    const headers = await this.getAuthHeaders();
    const at = fix
      ? `&lat=${fix.latitude.toFixed(6)}&lng=${fix.longitude.toFixed(6)}`
      : '';
    return {
      uri: `${this.baseURL}/attendance-mobile/map?width=${Math.round(width)}&height=${Math.round(height)}${at}`,
      headers: headers as Record<string, string>,
    };
  }

  async getStatus(): Promise<ClockStatus> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/status`, { headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not check your shift status'));
    return res.json();
  }

  async getGeofence(): Promise<Geofence> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/geofence`, { headers });
    if (!res.ok) throw new Error(await detailOf(res, "Could not read the clinic's location"));
    return res.json();
  }

  /** Owner only. */
  async setGeofence(fix: Fix, radiusM: number): Promise<Geofence> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/geofence`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        latitude: fix.latitude, longitude: fix.longitude, radius_m: radiusM,
      }),
    });
    if (!res.ok) throw new Error(await detailOf(res, "Could not save the clinic's location"));
    return res.json();
  }

  /** 403 here means "too far away", which is a normal answer, not a fault. */
  /**
   * `reason` explains a late arrival, asked for at the moment it happens rather
   * than chased afterwards. The server keeps it only when it independently
   * decides the arrival was late, so sending one on a punctual clock-in is
   * harmless and never lands on the owner's grid.
   */
  async clockIn(fix: Fix, reason?: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/clock-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy,
        ...(reason && reason.trim() ? { reason: reason.trim() } : {}),
      }),
    });
    if (res.status === 403) throw new OutsideGeofenceError(await detailOf(res, 'You are too far from the clinic to clock in'));
    if (!res.ok) throw new Error(await detailOf(res, 'Could not clock you in'));
    return res.json();
  }

  /**
   * Never refused on distance; see the server. `notes` is the shift summary in
   * their own words, saved on the day's record; optional, because a note that
   * blocks the end of a shift is a note people learn to type "." into.
   */
  async clockOut(fix: Fix, notes?: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/clock-out`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy,
        ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
      }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not clock you out'));
    return res.json();
  }

  /** Step away mid-shift. No location: a break is taken wherever you go. */
  async startBreak(): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/break/start`, { method: 'POST', headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not start your break'));
  }

  async endBreak(): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/break/end`, { method: 'POST', headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not end your break'));
  }
}

export const attendanceApiService = new AttendanceApiService();
