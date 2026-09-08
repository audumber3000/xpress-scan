/**
 * Which modifier key to name in on-screen hints.
 *
 * The chart accepts both Ctrl and Cmd, so this changes nothing about what
 * works — only what the hint calls it. Telling a Mac user to "hold Ctrl" reads
 * as an instruction that does not apply to them, and they stop reading.
 */
export const isMac = () => {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac/i.test(platform);
};

/** "\u2318" on a Mac, "Ctrl" everywhere else. */
export const modKeyLabel = () => (isMac() ? '\u2318' : 'Ctrl');
