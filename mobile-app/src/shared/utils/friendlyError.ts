/**
 * Turning anything the server throws into a sentence a dentist would say.
 *
 * Port of the web helper in `frontend/src/utils/api.js`. Kept deliberately in
 * step with it: the same backend answers both clients, so a 500 that reads as
 * "Something went wrong on our end" on a laptop must not read as
 * "(psycopg2.errors.ForeignKeyViolation) update or delete on table…" on a
 * phone.
 *
 * Mobile leaks this more easily than web did, because most of the `*.api.ts`
 * files do `detail = (await res.json())?.detail` and hand it straight to a
 * toast. Everything user-facing should come through here instead.
 */

/**
 * Text that betrays the machinery. Deliberately wide.
 *
 * Half of this backend's handlers end their except block with
 * `detail=f"Error deleting payment: {str(e)}"`, so the give-away is as often
 * "Error deleting" as it is "psycopg". When in doubt this hides: a generic
 * sentence a human wrote beats a specific one a database wrote.
 */
const TECHNICAL = new RegExp([
  'traceback', 'psycopg', 'sqlalchemy', 'pydantic', 'asyncio', 'fastapi',
  'integrity\\s?error', 'unique constraint', 'foreign key', 'duplicate key',
  'relation .* does not exist', 'column .* does not exist', 'undefinedcolumn',
  'null value in column', 'violates', 'constraint',
  'internal server', 'nonetype', 'keyerror', 'typeerror', 'valueerror',
  'attributeerror', 'indexerror', 'not subscriptable', 'object has no attribute',
  'exception', 'stack', '<[a-z]+ object at 0x',
  'http \\d{3}', '\\bstatus code\\b', 'econnrefused', 'enotfound',
  '(error|failed) (creating|updating|deleting|fetching|loading|saving|processing)',
  // Mobile-only: the shape our own fetch wrapper throws on a timeout.
  'request timed out after',
].join('|'), 'i');

/**
 * When the server breaks in a way nobody designed for. Says the three things a
 * person wants to know: not your fault, your data survived, what to do next.
 */
export const SERVER_FAULT =
  "Something went wrong on our end, not yours. Nothing you entered was lost. " +
  "Please try again in a moment, and tell support if it keeps happening.";

export const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

/**
 * @param error   an Error, a string, or anything at all
 * @param fallback what to say when there is nothing safe and specific to say
 *
 * Status is read from `error.status` when the caller attached one. Mobile's api
 * services mostly throw plain `Error(detail)`, so the text path below carries
 * most of the traffic — which is exactly why the regex has to be generous.
 */
export function friendlyError(error: any, fallback: string = DEFAULT_FALLBACK): string {
  if (!error) return fallback;

  const text = typeof error === 'string' ? error : String(error?.message || '');
  const status: number | undefined = typeof error?.status === 'number' ? error.status : undefined;

  // Anything 5xx is our fault and our problem to explain. Whatever string came
  // with it describes our bug, not the user's situation, so it is not read.
  if (status && status >= 500) {
    if (status === 502 || status === 503 || status === 504) {
      return 'The server is busy or restarting. Please wait a few seconds and try again.';
    }
    return SERVER_FAULT;
  }

  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return "You don't have permission to do that. Ask your clinic owner if you need it.";
  if (status === 404) return "That isn't there any more. It may have been deleted or moved.";
  if (status === 409) return 'Somebody else changed this while you had it open. Refresh and try again.';
  if (status === 413) return 'That file is too large. Please use a smaller one.';
  if (status === 429) return 'That was a lot of requests at once. Please wait a moment and try again.';

  // No status to go on: read the words.
  if (/timed out|timeout|abort/i.test(text)) {
    return 'The server took too long to answer. Check your connection and try again.';
  }
  if (/network request failed|failed to fetch|network|offline/i.test(text)) {
    return "We couldn't reach the server. Check your internet connection and try again.";
  }
  // The web client's own 5xx sentence can arrive as a plain string; let it pass.
  if (text.startsWith('Something went wrong on our end')) return text;

  if (!text.trim()) return fallback;
  return TECHNICAL.test(text) ? fallback : text.trim();
}

export default friendlyError;
