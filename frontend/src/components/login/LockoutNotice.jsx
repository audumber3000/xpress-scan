import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

/**
 * The wait after too many wrong passwords, shown as a wait rather than a wall.
 *
 * The backend now cools an account down after repeated failures, and almost
 * everybody who trips that is the rightful owner misremembering their own
 * password rather than anybody attacking anything. A bare "too many attempts"
 * reads to that person as being locked out for good, and the reasonable
 * response to being locked out for good is to stop trying to use the product.
 *
 * A number they can watch tick down reads as a queue instead. The way out is
 * offered right here too, because resetting the password is both faster than
 * waiting and the thing that actually solves their problem.
 *
 * `until` is a timestamp, not a countdown held in state, so a re-render or a
 * remount resumes the clock instead of restarting it.
 */
const format = (seconds) => {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `${seconds}s`;
};

const LockoutNotice = ({ until, message, onExpire }) => {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return undefined;
    }
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  if (remaining <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <Clock size={15} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Try again in <span className="tabular-nums">{format(remaining)}</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
            {message || 'Too many sign-in attempts for this account.'}
          </p>
          <Link
            to="/forgot-password"
            className="mt-2 inline-block text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Reset your password to sign in straight away
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LockoutNotice;
