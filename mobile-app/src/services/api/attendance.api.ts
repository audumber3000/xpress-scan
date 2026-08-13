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
  is_done_for_today: boolean;
  attendance_id: number | null;
  clock_in_time: string | null;
  clock_out_time: string | null;
  clock_in_distance_m: number | null;
  geofence_set: boolean;
  geofence_radius_m: number;
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

class AttendanceApiService extends BaseApiService {
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
  async clockIn(fix: Fix): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/clock-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy,
      }),
    });
    if (res.status === 403) throw new OutsideGeofenceError(await detailOf(res, 'You are too far from the clinic to clock in'));
    if (!res.ok) throw new Error(await detailOf(res, 'Could not clock you in'));
    return res.json();
  }

  /** Never refused on distance — see the server. */
  async clockOut(fix: Fix): Promise<any> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/attendance-mobile/clock-out`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy,
      }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not clock you out'));
    return res.json();
  }
}

export const attendanceApiService = new AttendanceApiService();
