/**
 * Distance and direction between two points on the ground, for drawing where
 * somebody stands against the clinic's geofence.
 *
 * Display only. Whether a clock-in is allowed is decided by the server
 * (is_within_clinic_radius in attendance_mobile.py); `withinFence` copies its
 * rule so the screen's "Within zone" agrees with what the server will say.
 */

const R = 6371000; // metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two coordinates (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Compass bearing from the first point to the second, 0 = north, clockwise. */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The server's rule: inside the radius, widened by the fix's own error (capped at 200 m). */
export function withinFence(distance: number, radiusM: number, accuracy?: number | null): boolean {
  return distance <= radiusM + Math.min(Number(accuracy) || 0, 200);
}
