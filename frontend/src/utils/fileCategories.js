/**
 * What a file on a patient's record is, and therefore which tab shows it.
 *
 * Mirrors backend/core/file_categories.py. One list, so Imaging and Documents
 * can never both claim a file or both ignore it — which is exactly what used to
 * happen: every upload landed in Documents and Imaging was permanently empty.
 *
 * The words are the clinic's own and are stored verbatim, never translated on
 * display, so an export and the screen say the same thing.
 */

export const IMAGING_CATEGORIES = [
  'IOPA', 'RVG', 'OPG', 'Bitewing', 'CBCT', 'Photo', 'Scan',
];

export const DOCUMENT_CATEGORIES = [
  'Report', 'Referral', 'Estimate', 'Insurance', 'Consent', 'Other',
];

// What older builds send. Kept because an installed tablet keeps sending its
// own vocabulary for months, and a file filed under a word no screen filters on
// is a file nobody finds.
const ALIASES = {
  'x-ray': 'IOPA',
  xray: 'IOPA',
  'intra-oral': 'Photo',
  intraoral: 'Photo',
  periapical: 'IOPA',
  panoramic: 'OPG',
  // The old hardcoded server value. It means "nobody said", not a kind.
  document: '',
  upload: '',
};

const BY_LOWER = Object.fromEntries(
  [...IMAGING_CATEGORIES, ...DOCUMENT_CATEGORIES].map((c) => [c.toLowerCase(), c])
);

/** One canonical spelling, or '' when nothing usable was stored. */
export const normaliseCategory = (value) => {
  if (typeof value !== 'string') return '';
  const key = value.trim().toLowerCase();
  if (!key) return '';
  if (key in ALIASES) return ALIASES[key];
  return BY_LOWER[key] || '';
};

/** True when this file belongs on the Imaging tab. */
export const isImaging = (value) => IMAGING_CATEGORIES.includes(normaliseCategory(value));

// Tint per imaging type, so a badge and its filter chip cannot drift apart.
export const IMAGING_STYLE = {
  IOPA: 'bg-[#2a276e]/[0.08] text-[#2a276e]',
  RVG: 'bg-sky-50 text-sky-700',
  OPG: 'bg-violet-50 text-violet-700',
  Bitewing: 'bg-blue-50 text-blue-700',
  CBCT: 'bg-amber-50 text-amber-700',
  Photo: 'bg-emerald-50 text-emerald-700',
  Scan: 'bg-gray-100 text-gray-600',
};
