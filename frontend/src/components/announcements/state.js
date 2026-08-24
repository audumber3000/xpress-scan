/**
 * What this browser has already been shown, and when.
 *
 * Everything here is per-device on purpose. An announcement is about the app in
 * front of you (rate the Windows build, get the phone app, here is what changed
 * in the release you just loaded), so a doctor who uses the desktop app at the
 * clinic and Chrome at home should get the right pitch in each place. Putting it
 * on the server would give them one shared "already seen" and the wrong one.
 *
 * The cost of that choice: clearing site data resets the schedule. That is fine.
 * The frequency caps below mean the worst case is being asked once more.
 */

const KEY = 'mp_announcements_v1';

// The single-purpose key this replaced. Read once so anybody who had already
// said "don't show again" to the old device upsell is not asked again by the
// system that absorbed it.
const LEGACY_UPSELL_KEY = 'mp_device_upsell_v1';

const DAY_MS = 24 * 60 * 60 * 1000;

const blank = () => ({ firstSeenAt: Date.now(), entries: {} });

const migrateLegacy = (state) => {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_UPSELL_KEY) || 'null');
  } catch {
    return state;
  }
  if (!legacy || (!legacy.dismissedAt && !legacy.permanent)) return state;

  for (const id of ['get-desktop-app', 'get-mobile-app']) {
    if (state.entries[id]) continue;
    state.entries[id] = {
      shows: 1,
      lastShownAt: legacy.dismissedAt || Date.now(),
      permanent: !!legacy.permanent,
    };
  }
  // The old key also told us roughly how long this device has been in use,
  // which is what the "wait a week before asking for a review" rule needs.
  if (legacy.dismissedAt) state.firstSeenAt = Math.min(state.firstSeenAt, legacy.dismissedAt);
  return state;
};

export const readState = () => {
  if (typeof window === 'undefined') return blank();
  let state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    state = null;
  }
  if (!state || typeof state !== 'object') {
    // Brand new device. Stamp it now so `minDaysUsing` has something to count
    // from, and write it back immediately: a first-run announcement that waits
    // for a week must start that week today, not on the next page load.
    state = migrateLegacy(blank());
    writeState(state);
    return state;
  }
  return { firstSeenAt: state.firstSeenAt || Date.now(), entries: state.entries || {} };
};

export const writeState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private window, or storage full. Losing the schedule means an extra
    // prompt, never a broken page.
  }
};

const patch = (id, changes) => {
  const state = readState();
  state.entries[id] = { ...(state.entries[id] || {}), ...changes };
  writeState(state);
  return state;
};

const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Count a display, but at most one per calendar day for any given item. */
export const recordShown = (id) => {
  const state = readState();
  const entry = state.entries[id] || {};
  if (entry.lastShownAt && isSameDay(entry.lastShownAt, Date.now())) return state;
  return patch(id, { shows: (entry.shows || 0) + 1, lastShownAt: Date.now() });
};

/** Closed without acting. Comes back after the item's own cooling-off period. */
export const recordDismissed = (id) => patch(id, { dismissedAt: Date.now() });

/** Did the thing (rated us, installed the app). Never ask again. */
export const recordActed = (id) => patch(id, { actedAt: Date.now() });

/** Said no, permanently. */
export const recordNever = (id) => patch(id, { permanent: true });

export const daysSince = (ts, now = Date.now()) => (ts ? (now - ts) / DAY_MS : Infinity);
