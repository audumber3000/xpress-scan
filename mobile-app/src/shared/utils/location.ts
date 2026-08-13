import * as Location from 'expo-location';

/**
 * Reading where the phone is, once, at a moment that needs it.
 *
 * Foreground only, one shot, never a subscription. There is deliberately no
 * background watcher anywhere in this app: Play requires a separate review with
 * a filmed justification for background location and rejects it for apps that
 * do not need it to function, and Apple takes the same line. More to the point,
 * a dental app that follows staff around when it is closed is not a thing we
 * want to have built.
 *
 * Two capture points use this:
 *   · attendance clock in / out — proves the shift started at the clinic
 *   · sign-in and device enrolment — puts a real place in Control Center → Devices
 *
 * Everything here fails soft. A refused permission, a phone with location
 * services off, a basement with no fix — all return null, and every caller is
 * written to carry on without it. Location is evidence, never a gate on getting
 * work done; the one place it can refuse an action is the attendance geofence,
 * and that decision is the server's, not this file's.
 */

export interface Fix {
  latitude: number;
  longitude: number;
  /** The device's own error estimate, in metres. Null when it will not say. */
  accuracy: number | null;
}

/**
 * Ask, if we have not already. Returns false rather than throwing.
 *
 * The OS shows its prompt once per install; after a refusal this resolves false
 * every time without nagging, which is both the platform rule and the decent
 * behaviour.
 */
export async function ensurePermission(): Promise<boolean> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * One fix, or null.
 *
 * `Balanced` accuracy rather than `Highest`: it is roughly 10 to 100 m, arrives
 * in a second or two, and costs a fraction of the battery. Highest spins the
 * GPS chip hunting for sub-10m precision that tells an owner nothing extra
 * about whether someone was at reception — and on the clock-in screen, a fix
 * that takes fifteen seconds is a feature nobody uses twice.
 *
 * @param timeoutMs give up and return null rather than hold up the action
 */
export async function getFix(timeoutMs = 8000): Promise<Fix | null> {
  try {
    if (!(await ensurePermission())) return null;

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!position) return null;

    const { latitude, longitude, accuracy } = position.coords;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { latitude, longitude, accuracy: accuracy ?? null };
  } catch {
    return null;
  }
}

/**
 * A fix without ever prompting.
 *
 * For the background-ish capture points — signing in, enrolling a device —
 * where the location is a nice-to-have on an admin screen. Interrupting a
 * sign-in with a permission dialog to fill in a column nobody asked about is
 * how an app teaches people to tap Deny on everything. If the permission is
 * already there from clocking in, we use it; otherwise we take the miss.
 */
export async function getFixIfAlreadyAllowed(timeoutMs = 5000): Promise<Fix | null> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (!existing.granted) return null;
    return await getFix(timeoutMs);
  } catch {
    return null;
  }
}
