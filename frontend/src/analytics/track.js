// Thin, fail-safe wrapper around posthog.capture so every call site is
// consistent and analytics can never break the app. No-ops if posthog isn't
// loaded (e.g. key missing in dev). Import { track } and the EVENTS catalog.
import posthog from 'posthog-js';

export { EVENTS } from './events';

/**
 * Capture a product event.
 * @param {string} event  one of EVENTS.*
 * @param {object} [props] event properties (keep PHI out of these)
 */
export function track(event, props = {}) {
  try {
    if (posthog && typeof posthog.capture === 'function') {
      posthog.capture(event, props);
    }
  } catch {
    // analytics must never throw into product code
  }
}
