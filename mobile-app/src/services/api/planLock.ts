/**
 * A write refused because the clinic's plan has stopped.
 *
 * When a trial ends or a renewal fails the backend turns the clinic view only:
 * reads still work, every write comes back 402. Until this existed the phone
 * had no idea what that meant — `base.api.ts` threw
 * `HTTP error! status: 402, body: {...}` and each screen showed it as a generic
 * failure, so the user saw a save that would not save and nothing telling them
 * why or what to do.
 *
 * A handler registry rather than an event emitter, matching `session.ts`:
 * AuthContext registers on mount and the api layer calls in. A direct import
 * would be a cycle, since AuthContext already imports the api.
 *
 * The payload is the SERVER's, verbatim. A trial that ended, a renewal that
 * failed and an introductory period that ran out are three different things to
 * the person reading, and `core/plan_state.py` decides which. The phone must
 * never invent its own wording here: telling a paying customer whose card
 * bounced to "start a trial" is exactly the mistake this avoids.
 */

export interface PlanBlockedDetail {
  reason: 'plan_inactive';
  /** 'trial_ended' | 'lapsed' | 'grant_ended' */
  state: string;
  title?: string | null;
  message?: string | null;
  cta?: string | null;
  /** 'info' | 'warning' | 'critical' */
  tone?: string | null;
}

type Handler = (detail: PlanBlockedDetail) => void;

let _handler: Handler | null = null;
let _showing = false;

/**
 * Is the plan-blocked explanation on screen right now?
 *
 * `alertService` and `notify` ask this before saying anything, because a
 * refused write reaches the user twice otherwise. The api layer announces the
 * 402 centrally AND the calling screen catches its own failure, so the first
 * build of this showed the modal with a second dialog stacked on top of it
 * reading `Could not register patient` followed by the raw JSON body.
 *
 * The modal has already said what happened, in the server's words. Anything the
 * screen wants to add while it is up is noise on top of the answer.
 */
export function isPlanBlockedShowing(): boolean {
  return _showing;
}

/** Called by AuthContext when the modal closes. */
export function clearPlanBlocked(): void {
  _showing = false;
}

export function registerPlanBlockedHandler(fn: Handler): void {
  _handler = fn;
}

export function unregisterPlanBlockedHandler(): void {
  _handler = null;
}

/**
 * Called by the api layer on a 402 carrying `reason: 'plan_inactive'`.
 *
 * Silently ignored when nothing is registered — during tests, or in the moment
 * before the provider mounts. A refused write with no listener is no worse than
 * the behaviour this replaces.
 */
export function notifyPlanBlocked(detail: PlanBlockedDetail): void {
  // Set even with no handler registered. The suppression it drives is a
  // "something already explained this" signal, and a refused write with no
  // listener is still not something to shout a raw 402 about.
  _showing = true;
  _handler?.(detail);
}
