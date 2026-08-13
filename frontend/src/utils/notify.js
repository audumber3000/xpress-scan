import { createElement as h } from 'react';
import { Check, Send, Undo2, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { getFriendlyErrorMessage } from './api';

/**
 * How this app tells the user something.
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 *   Feedback goes where the user is already looking.
 *   A toast is the last resort, not the default.
 *
 * Four tiers, in order of preference. Work down the list and stop at the first
 * one that fits:
 *
 *   1. SILENT          The result is visible. The row updated, the drawer
 *                      closed, the value changed, the list refreshed.
 *                      Say nothing. This is the right answer for most saves.
 *
 *   2. AT THE CONTROL  They pressed something and it failed, or it succeeded
 *                      with no visible change. Put the message on the thing
 *                      they pressed: <InlineFeedback> under the button, or
 *                      LoadingButton's `saved` tick.
 *
 *   3. IN THE SECTION  A region failed to load. They did not ask for this, so
 *                      it is not an interruption, it is a state. The section
 *                      renders <SectionError> with a Retry in place of its
 *                      content.
 *
 *   4. TOAST           This file. Only when the outcome is invisible AND
 *                      detached from where the user now is.
 *
 * ─── Why the names are what they are ─────────────────────────────────────────
 *
 * There is no notify.success() and no notify.error(), and that is deliberate.
 * Generic names are exactly how this app ended up with 502 toast calls across
 * 71 files: `toast.success` asks nothing of you, so it gets reached for on
 * every save, and the one message that mattered ends up buried among forty that
 * did not. Naming the four legitimate cases forces the question "which of these
 * is this?" at the call site, and most of the time the honest answer is "none
 * of them", which means it belongs in tier 1, 2 or 3.
 *
 *   notify.sent()      it left the building     WhatsApp, email, export, OTP
 *   notify.done()      background job finished  bulk import, sync
 *   notify.reverted()  optimistic update failed the screen already said yes
 *   notify.problem()   detached failure         nowhere sensible to put it
 *
 * ─── The mixed state is on purpose ───────────────────────────────────────────
 *
 * Around sixty files still import `toast` from react-toastify directly. They
 * keep working. Rather than one enormous sweep, they get converted as they are
 * next touched, using the tiers above. If you are reading this because you are
 * in one of those files: you are the person who converts it.
 */

// Long enough to read one line without hurrying, short enough that nobody
// reaches for the close button. The old container sat at eight seconds.
const READ_MS = 3500;
// A failure earns longer, because it may need acting on.
const PROBLEM_MS = 6000;

/**
 * One id per message, so a burst collapses to a single toast.
 *
 * The case this exists for is real: a bulk action that fails per-row used to
 * stack one toast per failure down the whole screen. react-toastify treats a
 * repeated toastId as "already showing" and drops the duplicate.
 */
const idFor = (kind, message) =>
  `${kind}:${String(message).slice(0, 80).replace(/\s+/g, ' ')}`;

/**
 * The mark that carries the outcome before a word is read.
 *
 * Colour does the work here, so it is worth being exact about which: green for
 * something that reached its destination, amber for something that was undone,
 * red for something that failed. Each sits in a tinted disc rather than being
 * dropped on white, which is what lets the toast stay a calm white card and
 * still be readable as good or bad news from across the desk.
 */
const MARKS = {
  sent:     { Icon: Send,        cls: 'bg-emerald-50 text-emerald-600' },
  done:     { Icon: Check,       cls: 'bg-emerald-50 text-emerald-600' },
  reverted: { Icon: Undo2,       cls: 'bg-amber-50 text-amber-600' },
  problem:  { Icon: AlertCircle, cls: 'bg-red-50 text-red-600' },
};

// Written with createElement rather than JSX so this file stays a .js util
// alongside every other module in utils/. It is six lines of markup; making a
// utility change extension for it once already cost a broken dev server, when
// the rename left Vite serving a cached graph that still pointed at the old
// path. Not worth paying twice.
const Mark = ({ kind }) => {
  const { Icon, cls } = MARKS[kind] || MARKS.done;
  return h(
    'span',
    { className: `shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${cls}` },
    h(Icon, { size: 14, strokeWidth: 2.5 })
  );
};

const show = (kind, message, options = {}) => {
  const text = String(message ?? '').trim();
  if (!text) return null;
  return toast(
    h(
      'span',
      { className: 'mp-toast-body' },
      h(Mark, { kind }),
      h('span', { className: 'mp-toast-text' }, text)
    ),
    {
      toastId: idFor(kind, text),
      autoClose: kind === 'problem' ? PROBLEM_MS : READ_MS,
      // Only a failure gets a close button. The rest leave on their own, and an
      // ✕ on a message that is already going invites the very clicking we are
      // trying to stop.
      closeButton: kind === 'problem',
      className: `mp-toast mp-toast--${kind}`,
      ...options,
    }
  );
};

export const notify = {
  /** It left the building: WhatsApp sent, email sent, export ready, OTP away. */
  sent: (message, options) => show('sent', message, options),

  /** A background job finished while they were doing something else. */
  done: (message, options) => show('done', message, options),

  /**
   * An optimistic update was rolled back. The screen showed success and now
   * silently disagrees with itself, so this one is not optional: without it the
   * appointment just slides back and nobody knows why.
   */
  reverted: (message, options) => show('reverted', message, options),

  /**
   * A failure with nowhere sensible to sit. Before reaching for this, check
   * that there really is no control to attach it to (tier 2) and no section to
   * put it in (tier 3).
   *
   * Everything goes through getFriendlyErrorMessage, strings included. A plain
   * string is not proof that a human wrote it — half of them are
   * `err?.detail || err?.message`, which is a server exception by another
   * route. Nothing reaches a user without passing the same filter.
   */
  problem: (error, fallback = 'Something went wrong. Please try again.') =>
    show('problem', getFriendlyErrorMessage(error, fallback)),

  /** Escape hatch for a toast that must be dismissed in code. */
  dismiss: (id) => toast.dismiss(id),
};

export default notify;
