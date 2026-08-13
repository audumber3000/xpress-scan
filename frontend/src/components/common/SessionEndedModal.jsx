import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';

/**
 * Your session ended, and not because you asked.
 *
 * The clinic owner deactivated this person or blocked the device they are
 * holding, and the backend now refuses every request. Signing them out quietly
 * would drop them on a login screen with no explanation, which reads as the app
 * having crashed or logged them out at random — and the first thing they would
 * do is try their password again and wonder why it "worked" but nothing loaded.
 *
 * So this says what happened, plainly, and cannot be dismissed:
 *   · no backdrop click       there is nothing behind it to go back to
 *   · no ✕, no Escape         closing it would only hide the truth
 *   · scroll locked           it is the whole screen, not a notice on a page
 *
 * One way out, and it is the only one that helps: sign in again.
 *
 * Solid backdrop rather than a translucent one. A see-through overlay implies
 * the app is still there underneath and this is temporary. It is not: that
 * session is over.
 */
const SessionEndedModal = ({ reason, onSignIn }) => {
  // Escape closes every other dialog in this app, which is exactly why it has
  // to be caught here — muscle memory would otherwise dismiss the one message
  // that must be read.
  useEffect(() => {
    const swallow = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', swallow, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', swallow, true);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-ended-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-[#f8fafc]"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#2a276e]/10 text-[#2a276e] flex items-center justify-center mb-5">
          <LogOut size={28} />
        </div>

        <h2 id="session-ended-title" className="text-xl font-bold text-gray-900">
          You have been signed out
        </h2>

        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          {reason || 'Your access to this clinic has changed.'}
        </p>

        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          Nothing you had already saved is affected. To carry on, please sign in again, or speak to
          your clinic owner if you think this is a mistake.
        </p>

        <button
          onClick={onSignIn}
          autoFocus
          className="w-full mt-7 px-5 py-3 bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Sign in again
        </button>
      </div>
    </div>
  );
};

export default SessionEndedModal;
