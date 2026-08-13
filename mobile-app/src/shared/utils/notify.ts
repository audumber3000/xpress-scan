import { toast } from '../components/toastService';
import { friendlyError, DEFAULT_FALLBACK } from './friendlyError';

/**
 * How this app tells the user something.
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 *   Feedback goes where the user is already looking.
 *   A toast is the last resort, not the default.
 *
 * Four tiers. Work down the list and stop at the first that fits:
 *
 *   1. SILENT          The result is visible. The row updated, the sheet
 *                      closed, the list refreshed. Say nothing. This is the
 *                      right answer for most saves.
 *
 *   2. AT THE CONTROL  They pressed something and it failed. Put the message on
 *                      the thing they pressed — inline text under the button,
 *                      the way MasterPasswordSheet and VerificationScreen do.
 *
 *   3. IN THE SCREEN   A screen failed to load. That is a state, not an event:
 *                      EmptyState with a retry, not a toast that times out
 *                      while the screen stays blank forever.
 *
 *   4. TOAST           This file. Only when the outcome is invisible AND
 *                      detached from where the user now is.
 *
 * ─── Why the names are what they are ─────────────────────────────────────────
 *
 * There is no notify.success() and no notify.error(). Generic names are how the
 * web app reached 502 toast calls across 71 files: `toast.success` asks nothing
 * of you, so it gets reached for on every save, and the one message that
 * mattered ends up buried among forty that did not. Naming the four legitimate
 * cases forces the question "which of these is this?" at the call site, and the
 * honest answer is usually "none of them" — which means tier 1, 2 or 3.
 *
 *   notify.sent()      it left the building     WhatsApp, email, export
 *   notify.done()      background job finished  bulk import, sync
 *   notify.reverted()  optimistic update failed the screen already said yes
 *   notify.problem()   detached failure         nowhere sensible to put it
 *
 * `toast` from toastService is still exported for the screens not yet converted.
 * They keep working; they move over as they are next touched.
 */

export const notify = {
  /** It left the building: WhatsApp sent, export shared, OTP away. */
  sent: (message: string) => toast.success(message),

  /** A background job finished while they were doing something else. */
  done: (message: string) => toast.success(message),

  /**
   * An optimistic update was rolled back. Not optional: the screen showed
   * success and is now silently disagreeing with itself.
   */
  reverted: (message: string) => toast.warning(message),

  /**
   * A failure with nowhere sensible to sit. Before reaching for this, check
   * there really is no control to attach it to (tier 2) and no screen state to
   * put it in (tier 3).
   *
   * Everything goes through friendlyError, strings included. A plain string is
   * not proof a human wrote it — most of them are `(await res.json()).detail`,
   * which is a server exception by another route.
   */
  problem: (error: unknown, fallback: string = DEFAULT_FALLBACK) =>
    toast.error(friendlyError(error, fallback)),
};

export default notify;
