/**
 * A session that ended without the user asking.
 *
 * The owner deactivated this person, or blocked the device they are holding.
 * The backend answers 401 on their very next request — but until this existed,
 * nothing on the phone was listening, so the app simply showed failures on
 * every screen while remaining apparently signed in.
 *
 * A handler registry rather than an event emitter, matching toastService and
 * alertService: AuthContext registers on mount and the api layer calls in.
 * A direct import would be a cycle, since AuthContext already imports the api.
 */

export type SessionExpiredReason = string;

type Handler = (reason: SessionExpiredReason) => void;

let _handler: Handler | null = null;

export function registerSessionExpiredHandler(fn: Handler): void {
  _handler = fn;
}

export function unregisterSessionExpiredHandler(): void {
  _handler = null;
}

/**
 * Called by the api layer on a 401 against an authenticated request.
 *
 * Silently ignored when nothing is registered — during tests, or in the moment
 * before the provider mounts. A revoked session with no listener is no worse
 * than the behaviour this replaces.
 */
export function notifySessionExpired(reason: SessionExpiredReason): void {
  _handler?.(reason);
}
