import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

/**
 * A section that could not load, saying so in its own space.
 *
 * Tier 3 of the feedback rule in `utils/notify.js`. Twenty-two screens used to
 * answer a failed fetch with a red toast, which is the wrong shape twice over:
 * the user did not press anything, so it is not a reply to them; and the toast
 * disappears after a few seconds while the section stays empty forever, so the
 * only explanation on offer times out and leaves a blank panel behind.
 *
 * A failed load is a state, not an event. It belongs in the space the content
 * would have filled, and it stays until the content arrives.
 *
 * Sits in the same slot as EmptyState and looks deliberately similar: same
 * bordered block, no shadow, per the app's card convention. The difference is
 * that this one has something to do about it.
 *
 * Props:
 *   title     what failed, in the user's terms ("Couldn't load patients")
 *   detail    optional extra line, e.g. a permission explanation
 *   onRetry   omit and the button is hidden
 *   retrying  disables the button and spins the icon
 */
const SectionError = ({
  title = "Couldn't load this",
  detail,
  onRetry,
  retrying = false,
  className = '',
}) => (
  <div
    role="alert"
    className={`bg-white border border-gray-200 rounded-xl px-6 py-10 flex flex-col items-center text-center ${className}`}
  >
    <div className="w-11 h-11 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
      <WifiOff size={20} />
    </div>
    <p className="text-sm font-semibold text-gray-900">{title}</p>
    <p className="text-sm text-gray-500 mt-1 max-w-sm">
      {detail || 'This is usually a connection problem. Your data is safe.'}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    )}
  </div>
);

export default SectionError;
