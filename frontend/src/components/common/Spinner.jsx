import React from 'react';

/**
 * The plain spinner.
 *
 * A ring with one quarter knocked out, in the colour of whatever it sits in.
 * The app had a branded gear for this, which is charming on a full-page load
 * and wrong inside a button: at 16px the teeth turn to mush, and a button that
 * sprouts machinery reads as an error rather than a wait.
 *
 * `currentColor` rather than a colour prop, so it is right on a navy primary,
 * a white outline and a red destructive without any of them being told.
 */
const Spinner = ({ className = 'w-4 h-4' }) => (
  <span
    role="status"
    aria-label="Working"
    className={`inline-block flex-shrink-0 animate-spin rounded-full ${className}`}
    style={{
      borderWidth: 2,
      borderStyle: 'solid',
      borderColor: 'currentColor',
      borderTopColor: 'transparent',
    }}
  />
);

export default Spinner;
