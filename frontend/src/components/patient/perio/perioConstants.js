/**
 * The vocabulary of a periodontal chart.
 *
 * Tooth keys are Universal (1-32), the same as teethData and the dental chart,
 * so a tooth marked missing there is the same tooth here. Display is FDI, as
 * everywhere else in the app.
 */
import { UNIVERSAL_UPPER, UNIVERSAL_LOWER } from '../dentalConstants';

/** Six sites per tooth: three from the cheek side, three from the tongue side. */
export const BUCCAL_SITES = ['db', 'b', 'mb'];
export const LINGUAL_SITES = ['dl', 'l', 'ml'];
export const ALL_SITES = [...BUCCAL_SITES, ...LINGUAL_SITES];

export const SITE_LABELS = {
  db: 'Distobuccal', b: 'Buccal', mb: 'Mesiobuccal',
  dl: 'Distolingual', l: 'Lingual', ml: 'Mesiolingual',
};

export const ARCHES = [
  { id: 'upper', label: 'Upper', teeth: UNIVERSAL_UPPER, lingualLabel: 'Palatal' },
  { id: 'lower', label: 'Lower', teeth: UNIVERSAL_LOWER, lingualLabel: 'Lingual' },
];

/**
 * BPE sextants, in stored Universal numbers.
 *
 * Third molars are excluded by convention — they are frequently absent or
 * partially erupted, and scoring them distorts the sextant.
 */
export const SEXTANTS = [
  { id: 's1', label: 'S1', range: '17-14', arch: 'upper', teeth: [2, 3, 4, 5] },
  { id: 's2', label: 'S2', range: '13-23', arch: 'upper', teeth: [6, 7, 8, 9, 10, 11] },
  { id: 's3', label: 'S3', range: '24-27', arch: 'upper', teeth: [12, 13, 14, 15] },
  { id: 's4', label: 'S4', range: '47-44', arch: 'lower', teeth: [28, 29, 30, 31] },
  { id: 's5', label: 'S5', range: '43-33', arch: 'lower', teeth: [22, 23, 24, 25, 26, 27] },
  { id: 's6', label: 'S6', range: '34-37', arch: 'lower', teeth: [18, 19, 20, 21] },
];

/**
 * BPE codes. The colours follow the dental chart's convention rather than
 * inventing a second one: amber is work needed, red is work needed urgently.
 */
export const BPE_CODES = [
  { code: '0', short: 'Healthy',   detail: 'No pockets over 3.5mm, no calculus, no bleeding', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', solid: 'bg-emerald-500' },
  { code: '1', short: 'Bleeding',  detail: 'Bleeding on probing, no calculus, no pockets over 3.5mm', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', solid: 'bg-emerald-500' },
  { code: '2', short: 'Calculus',  detail: 'Calculus or a plaque-retentive factor, no pockets over 3.5mm', tone: 'bg-slate-100 text-slate-700 border-slate-300', solid: 'bg-slate-500' },
  { code: '3', short: '3.5-5.5mm', detail: 'Shallow pocketing, 3.5 to 5.5mm', tone: 'bg-amber-50 text-amber-700 border-amber-200', solid: 'bg-amber-500' },
  { code: '4', short: '6mm+',      detail: 'Deep pocketing, 6mm or more', tone: 'bg-red-50 text-red-700 border-red-200', solid: 'bg-red-500' },
  { code: 'X', short: 'Not scored', detail: 'Fewer than two teeth in this sextant', tone: 'bg-gray-100 text-gray-500 border-gray-200', solid: 'bg-gray-400' },
];

/** Appended to a code, not a code of its own. */
export const FURCATION_STAR = '*';

/** What the worst sextant score means for what happens next. */
export const BPE_GUIDANCE = {
  '0': 'Nothing needed beyond the usual. Keep them on routine recall.',
  '1': 'Oral hygiene instruction. No treatment beyond that.',
  '2': 'Oral hygiene instruction, plus scaling to remove the calculus and correct any plaque-retentive factor.',
  '3': 'Oral hygiene instruction and root surface debridement. Chart the affected sextant in full after an initial course of treatment.',
  '4': 'Chart the whole mouth in full, then oral hygiene instruction and root surface debridement. Consider referral.',
};

export const MOBILITY = [
  { value: 0, label: '0', detail: 'Physiological, up to 0.2mm' },
  { value: 1, label: 'I', detail: 'Up to 1mm horizontally' },
  { value: 2, label: 'II', detail: 'Over 1mm horizontally' },
  { value: 3, label: 'III', detail: 'Horizontal and vertical, depressible' },
];

export const FURCATION = [
  { value: 0, label: '0', detail: 'No furcation involvement' },
  { value: 1, label: 'I', detail: 'Detectable, under a third of the width' },
  { value: 2, label: 'II', detail: 'Over a third, not through' },
  { value: 3, label: 'III', detail: 'Through and through' },
];

/* Only these teeth have furcations to probe: molars, and the upper first
   premolars. Offering the input on an incisor invites a value that cannot exist. */
export const FURCATION_TEETH = new Set([
  1, 2, 3, 5, 12, 14, 15, 16,      // upper molars + upper first premolars
  17, 18, 19, 30, 31, 32,          // lower molars
]);

/** Depth thresholds, and how a cell carrying one is coloured. */
export const DEPTH_WARN = 4;
export const DEPTH_SEVERE = 6;
export const MAX_DEPTH = 15;

export const depthTone = (mm) => {
  if (mm === null || mm === undefined || mm === '') return '';
  const n = Number(mm);
  if (n >= DEPTH_SEVERE) return 'bg-red-50 text-red-700 font-bold';
  if (n >= DEPTH_WARN) return 'bg-amber-50 text-amber-700 font-bold';
  return 'text-gray-900';
};
