import React from 'react';

/**
 * The Google "G", as an inline SVG.
 *
 * Inline rather than an <img>: it is four vector paths, so bundling it costs
 * less than the request would, and it renders at the same instant as the field
 * it sits in instead of popping in a frame later.
 *
 * The four brand hex values are fixed and deliberately not themed. This is
 * somebody else's trademark, and Google's brand guidelines only permit the
 * mark in its own colours or in flat white/black — tinting it to match our
 * palette would be a misuse, so `size` is the only knob offered.
 *
 * The same paths are currently inlined in eight other files (the sign-in
 * buttons, Signup, Login, Mail, GoogleReviews). This component is where they
 * should converge; those call sites are left alone for now because they sit in
 * the auth flow and are not what this change is about.
 */
const GoogleGlyph = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    // Decorative: the adjacent label already says "Find your clinic on Google",
    // so announcing "Google" again is noise to a screen reader.
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default GoogleGlyph;
