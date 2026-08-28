/**
 * Asking desktop users for a Microsoft Store review.
 *
 * The bridge is `window.__MOLARPLUS_DESKTOP__`, injected by the Tauri wrapper
 * (desktop/src-tauri/src/lib.rs). It is absent in every browser, so everything
 * here is a no-op on the web with no branching at the call site.
 *
 * ## Asked at sign-in
 *
 * Sign-in is the one moment nothing is half-finished: no form open, no invoice
 * mid-edit, nothing to lose if a modal steals focus.
 *
 * ## Once they rate, we stop. Permanently.
 *
 * `mp_desktop_review_given` is set by the wrapper when the Store reports the
 * review was actually SUBMITTED — not merely dismissed. Every other outcome
 * (cancelled, network error) leaves it unset, because "not now" is not "never"
 * and a failed request is certainly not a rating.
 *
 * Windows throttles this server-side too, and silently: once someone responds,
 * `RequestRateAndReviewAppAsync` returns without drawing anything. That is a
 * reason to be MORE careful, not less — we cannot see it happen, so a bug that
 * fires constantly would look like nothing in testing and like harassment on a
 * real install.
 */

const KEY = 'mp_desktop_review_v1';

/** Written by the Tauri wrapper on a genuinely submitted review. */
const GIVEN_KEY = 'mp_desktop_review_given';

/**
 * Sign-ins before we ask at all: ask on the second.
 *
 * The first open is someone still finding the menus, so there is nothing to
 * review yet. By the second they have come back on purpose, which is the
 * earliest point the question is a fair one.
 */
const MIN_SIGN_INS = 2;

/**
 * Minimum gap between asks.
 *
 * Seven days is a floor, not the cadence. The binding gate in practice is
 * `askedVersions`: a person is asked AT MOST ONCE per app version, so however
 * short this is, shipping monthly means being asked monthly. This only starts
 * to matter if we ever ship more than once a week.
 *
 * Its real job is the gap between a dismissal and the next release: someone who
 * waved the prompt away on Monday is not asked again on Tuesday just because a
 * hotfix went out.
 */
const DAYS_BETWEEN_ASKS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** True only inside the Tauri desktop wrapper. */
export const isDesktopApp = () =>
  typeof window !== 'undefined' && !!window.__MOLARPLUS_DESKTOP__;

/** Have they already left a review? Then we are done, for good. */
export const hasReviewed = () => {
  try {
    return localStorage.getItem(GIVEN_KEY) === '1';
  } catch {
    // Storage unreachable. Claiming "already reviewed" means we never ask,
    // which is the right way to be wrong about this.
    return true;
  }
};

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { signIns: 0, lastAskedAt: null, askedVersions: [] };
    const parsed = JSON.parse(raw);
    return {
      signIns: Number(parsed.signIns) || 0,
      lastAskedAt: parsed.lastAskedAt || null,
      askedVersions: Array.isArray(parsed.askedVersions) ? parsed.askedVersions : [],
    };
  } catch {
    // Private window, cleared storage, corrupted value. Starting from zero
    // means we ask later than we might have, which is the safe direction.
    return { signIns: 0, lastAskedAt: null, askedVersions: [] };
  }
};

const write = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — we simply never ask */
  }
};

// One ask per session at most, whatever localStorage says.
let askedThisSession = false;

/**
 * Count this sign-in, and ask for a review if the moment qualifies.
 *
 * Call once per successful sign-in. Safe to call anywhere: it returns
 * immediately in a browser, and on desktop it is throttled hard.
 */
export function askForReviewOnSignIn() {
  if (!isDesktopApp() || askedThisSession || hasReviewed()) return;

  // The wrapper currently in the wild (0.1.1) defines __MOLARPLUS_DESKTOP__ but
  // NOT requestReview. Without this check we would run the whole throttle,
  // record the ask, and then call a function that does not exist — spending
  // somebody's prompt on a build that could never have shown it, and locking
  // them out for a week for nothing. Ask only when the bridge can deliver.
  if (typeof window.__MOLARPLUS_DESKTOP__?.requestReview !== 'function') return;

  const version = window.__MOLARPLUS_DESKTOP__?.version || 'unknown';
  const state = read();
  state.signIns += 1;

  const enoughHistory = state.signIns >= MIN_SIGN_INS;
  const notThisVersion = !state.askedVersions.includes(version);
  const longEnoughAgo =
    !state.lastAskedAt ||
    Date.now() - new Date(state.lastAskedAt).getTime() > DAYS_BETWEEN_ASKS * DAY_MS;

  if (!(enoughHistory && notThisVersion && longEnoughAgo)) {
    write(state);
    return;
  }

  askedThisSession = true;
  state.lastAskedAt = new Date().toISOString();
  state.askedVersions = [...state.askedVersions, version];
  // Written BEFORE the prompt, deliberately. If the call throws, or the wrapper
  // is an older build without the bridge, the attempt is still recorded —
  // better to skip one ask than to retry on every sign-in from then on.
  write(state);

  // Let the sign-in finish painting first. A dialog that lands on top of a
  // half-drawn dashboard reads as a crash, not a request.
  setTimeout(() => {
    try {
      window.__MOLARPLUS_DESKTOP__.requestReview?.();
    } catch {
      /* older wrapper without the bridge */
    }
  }, 2500);
}

/**
 * Take them straight to our page in the Store, skipping the in-app dialog.
 *
 * For an explicit "Rate MolarPlus" control, where they have already decided and
 * a dialog that can quietly decline to appear would look broken.
 */
export function openStoreReviewPage() {
  if (!isDesktopApp()) return;
  try {
    window.__MOLARPLUS_DESKTOP__.openStoreReviewPage?.();
  } catch {
    /* older wrapper without the bridge */
  }
}
