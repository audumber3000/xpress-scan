import { daysSince } from './state';

/**
 * Which announcement, if any, this device has earned right now.
 *
 * Kept apart from the component and free of React so the rules can be read (and
 * tested) on their own. Getting these wrong is not a rendering bug, it is the
 * difference between a helpful nudge and an app that nags, and that is worth
 * being able to check without a browser.
 */

export const isEligible = (item, state, ctx, now = Date.now()) => {
  const entry = state.entries[item.id] || {};

  // Two permanent answers: said no, or already did the thing.
  if (entry.permanent || entry.actedAt) return false;

  if (item.surfaces && !item.surfaces.includes(ctx.surface)) return false;
  if (item.os && !item.os.includes(ctx.os)) return false;

  if (item.startsAt && now < Date.parse(item.startsAt)) return false;
  if (item.endsAt && now > Date.parse(item.endsAt)) return false;

  // How long this device has had MolarPlus at all. A review ask on day one is
  // a review from somebody with nothing to say yet.
  if (daysSince(state.firstSeenAt, now) < (item.minDaysUsing || 0)) return false;

  if ((entry.shows || 0) >= (item.maxShows ?? 1)) return false;
  if (daysSince(entry.lastShownAt, now) < (item.repeatAfterDays ?? 0)) return false;

  return true;
};

/** The highest-priority eligible item, or null. */
export const pickAnnouncement = (announcements, state, ctx, now = Date.now()) =>
  announcements
    .filter((item) => isEligible(item, state, ctx, now))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
