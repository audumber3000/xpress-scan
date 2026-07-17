/**
 * Tooth numbering: internal storage is the Universal system (1–32), but doctors
 * read the FDI / ISO system (11–18, 21–28, 31–38, 41–48), which is the standard
 * in India and most of the world.
 *
 * We keep Universal as the stored key — every existing patient record uses it —
 * and convert to FDI only for display. Do NOT change what gets stored; only
 * wrap a number in `universalToFDI` at the point it is shown to the user.
 */

// Universal (1–32) -> FDI two-digit number.
const UNIVERSAL_TO_FDI = {
  1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
  9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
  17: 38, 18: 37, 19: 36, 20: 35, 21: 34, 22: 33, 23: 32, 24: 31,
  25: 41, 26: 42, 27: 43, 28: 44, 29: 45, 30: 46, 31: 47, 32: 48,
};

const FDI_TO_UNIVERSAL = Object.fromEntries(
  Object.entries(UNIVERSAL_TO_FDI).map(([u, f]) => [f, Number(u)])
);

/**
 * Convert a stored Universal tooth number to its FDI label for display.
 * Accepts number or numeric string. Anything not a valid 1–32 Universal number
 * (e.g. a free-text lab-order entry the doctor typed) is returned unchanged, so
 * this is always safe to apply at a display site.
 */
export const universalToFDI = (universal) => {
  const n = Number(universal);
  return UNIVERSAL_TO_FDI[n] ?? universal;
};

/** FDI -> Universal, for the rare case of mapping user FDI input back to storage. */
export const fdiToUniversal = (fdi) => {
  const n = Number(fdi);
  return FDI_TO_UNIVERSAL[n] ?? fdi;
};

/** True when `n` is a valid Universal tooth number (1–32). */
export const isUniversalTooth = (n) => Number(n) in UNIVERSAL_TO_FDI;
