import React from 'react';
import GearLoader from '../GearLoader';

/**
 * What is happening right now, said out loud, while somebody signs in.
 *
 * Signing in is not one request any more. Depending on the account it can be
 * a password check, then a second check against the app's own sign-in, then a
 * token exchange, then the dashboard's first load. Each step is fast on a good
 * connection and none of them are on a clinic's waiting-room wifi. The old
 * screen reported all of it as one disabled button reading "Signing in...",
 * which is indistinguishable from a frozen page, and a frozen page gets
 * reloaded halfway through, which is how a sign-in that was working turns into
 * a sign-in that failed.
 *
 * So the phase is named, not boolean, and this strip says which one we are on.
 * It is deliberately plain: one line, one spinner, an optional second line only
 * where the person can actually do something with it (the Google window that
 * opened behind the browser is the case that matters). No progress bar, because
 * we do not know how long any of it takes and a bar that lies is worse than no
 * bar.
 */
/**
 * `strip` decides whether this phase ALSO gets the panel below the heading.
 *
 * The submit button already relabels itself to the phase message, and that is
 * the right place for it: the feedback belongs where the click happened. So a
 * phase that the submit button is already narrating does not get a second copy
 * of the same sentence three inches above it.
 *
 * The panel is for the phases the button cannot speak for: anything started by
 * the Google button or the "last used" card, anything with a hint attached, and
 * the moment after success when the form is on its way out.
 */
export const SIGN_IN_PHASES = {
  checking:          { message: 'Checking your details' },
  appSignIn:         {
    message: 'Still checking',
    hint: 'Your account was created in the mobile app, so this takes a moment longer the first time.',
    strip: true,
  },
  adopting:          { message: 'Setting up your sign-in for this device' },
  googleWindow:      {
    message: 'Waiting for the Google window',
    hint: 'If you cannot see it, look behind this window or check whether pop-ups are blocked.',
    strip: true,
  },
  googleBrowser:     { message: 'Opening your browser to finish with Google', strip: true },
  googleFinishing:   { message: 'Finishing your Google sign-in', strip: true },
  restoring:         { message: 'Welcoming you back', strip: true },
  opening:           { message: 'Opening your dashboard', strip: true },
};

/** Phases driven by the Google button rather than the password form. */
export const GOOGLE_PHASES = new Set(['googleWindow', 'googleBrowser', 'googleFinishing']);

const SignInStatus = ({ phase }) => {
  const state = phase && SIGN_IN_PHASES[phase];
  if (!state || !state.strip) return null;

  return (
    <div
      // Announced politely so a screen reader hears each step rather than
      // being interrupted mid-sentence on every transition.
      role="status"
      aria-live="polite"
      // Concrete hex rather than an opacity modifier on the brand colour:
      // the /04 form resolved to something indistinguishable from white here,
      // which left the panel reading as a disabled row rather than an active one.
      className="flex items-start gap-3 rounded-lg border border-[#c9c7e4] bg-[#f1f0fa] px-4 py-3"
    >
      <span className="mt-0.5 shrink-0 text-[#2a276e]">
        <GearLoader size="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2a276e]">{state.message}</p>
        {state.hint && (
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{state.hint}</p>
        )}
      </div>
    </div>
  );
};

export default SignInStatus;
