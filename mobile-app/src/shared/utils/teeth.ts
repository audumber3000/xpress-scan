/**
 * Teeth, the way the web writes and reads them.
 *
 * Storage is Universal (1–32), the key every chart and plan has always used.
 * Doctors read FDI (11–48), the standard in India and most of the world, and
 * the web, the treatment plan PDF and the invoice all show FDI. The phone used
 * to show Universal, so the same tooth was "#3" here and "16" on the plan the
 * patient took home. Convert at display, and at input; never change storage.
 *
 * Mirrors frontend/src/utils/toothNumbering.js and the surface and status
 * helpers in frontend/src/components/patient/dentalConstants.js.
 */

const UNIVERSAL_TO_FDI: Record<number, number> = {
  1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
  9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
  17: 38, 18: 37, 19: 36, 20: 35, 21: 34, 22: 33, 23: 32, 24: 31,
  25: 41, 26: 42, 27: 43, 28: 44, 29: 45, 30: 46, 31: 47, 32: 48,
};

const FDI_TO_UNIVERSAL: Record<number, number> = Object.fromEntries(
  Object.entries(UNIVERSAL_TO_FDI).map(([u, f]) => [f, Number(u)]),
);

/** A stored Universal number as its FDI label. Anything else comes back as given. */
export const toFDI = (universal: number | string | null | undefined): string => {
  const n = Number(universal);
  return String(UNIVERSAL_TO_FDI[n] ?? universal ?? '');
};

/** What a doctor typed (FDI) as the Universal number to store, or null. */
export const fromFDI = (fdi: string | number | null | undefined): number | null => {
  const n = Number(String(fdi ?? '').trim());
  return FDI_TO_UNIVERSAL[n] ?? null;
};

const ANTERIOR = new Set([6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27]);
const isUpper = (t: number) => t >= 1 && t <= 16;

const SURFACE_ORDER = ['M', 'O', 'D', 'B', 'L'];

/** ['D','O'] on tooth 10 -> "ID": named for the tooth, as a dentist writes them. */
export const formatSurfaces = (tooth: number | string | null | undefined, keys?: string[] | null): string => {
  if (!Array.isArray(keys) || !keys.length) return '';
  const t = Number(tooth);
  const short = (k: string) => {
    if (k === 'O' && ANTERIOR.has(t)) return 'I';
    if (k === 'L' && isUpper(t)) return 'P';
    return k;
  };
  const set = new Set(keys.map((k) => String(k).toUpperCase()));
  return SURFACE_ORDER.filter((k) => set.has(k)).map(short).join('');
};

/**
 * The teeth a plan item covers, in FDI, with surfaces when it records them.
 * A per-tooth item carries `tooth`; a combined one (a quadrant scaling) carries
 * `teeth` and a null `tooth`. Neither is "General"; that is work with no tooth.
 */
export const planItemTeeth = (item: any): string => {
  const teeth: any[] = Array.isArray(item?.teeth) && item.teeth.length ? item.teeth : [];
  const anchor = teeth.length ? teeth[0] : item?.tooth;
  if (!teeth.length && (item?.tooth === null || item?.tooth === undefined || item?.tooth === '')) return '';
  const label = teeth.length ? teeth.map(toFDI).join(', ') : toFDI(item.tooth);
  const surfaces = formatSurfaces(anchor, item?.surfaces);
  return surfaces ? `${label} (${surfaces})` : label;
};

/**
 * The web's two axes for a status the phone sets.
 *
 * The web reads `condition`, `work` and `workType` before `status`. Writing
 * only `status` left a tooth edited once on the web unchangeable from here, so
 * the axes are written alongside it, exactly as the web would read that status.
 */
const STATUS_AXES: Record<string, { condition: string; work: string | null; workType: string | null }> = {
  present: { condition: 'sound', work: null, workType: null },
  missing: { condition: 'missing', work: null, workType: null },
  impacted: { condition: 'impacted', work: null, workType: null },
  fractured: { condition: 'fractured', work: null, workType: null },
  planned: { condition: 'sound', work: 'planned', workType: null },
  implant: { condition: 'sound', work: 'existing', workType: 'implant' },
  rootCanal: { condition: 'sound', work: 'existing', workType: 'root_canal' },
  to_extract: { condition: 'sound', work: 'planned', workType: 'extraction' },
  existing: { condition: 'sound', work: 'existing', workType: 'filling' },
  post_core: { condition: 'sound', work: 'existing', workType: 'post_core' },
  crown_porcelain: { condition: 'sound', work: 'existing', workType: 'crown_porcelain' },
  crown_gold: { condition: 'sound', work: 'existing', workType: 'crown_gold' },
  crown_ss: { condition: 'sound', work: 'existing', workType: 'crown_ss' },
  veneer: { condition: 'sound', work: 'existing', workType: 'veneer' },
  bridge: { condition: 'sound', work: 'existing', workType: 'bridge' },
};

export const withStatus = (tooth: any, status: string) => {
  const axes = { ...(STATUS_AXES[status] || STATUS_AXES.present) };
  // A fracture survives being given work: on the web, planned or existing work
  // outranks a fracture on the chart without erasing it, and a crown planned
  // for a fractured tooth is exactly that case. Nothing else coexists with work.
  if (axes.work && tooth?.condition === 'fractured') axes.condition = 'fractured';
  return { ...(tooth || {}), status, ...axes };
};

/**
 * The invoice line for a billed procedure, word for word what the web writes
 * (procedureChargeDesc in frontend/src/components/patient/CasePapersTab.jsx),
 * so a bill reads the same whichever device raised it.
 */
export const procedureChargeDesc = (item: any): string => {
  const anchor = item?.tooth ?? item?.teeth?.[0];
  const surfaces = Array.isArray(item?.surfaces) && item.surfaces.length
    ? `, ${formatSurfaces(anchor, item.surfaces)}`
    : '';
  if (Array.isArray(item?.teeth) && item.teeth.length) {
    return `${item.procedure} (Teeth #${item.teeth.map(toFDI).join(', ')}${surfaces})`;
  }
  return `${item?.procedure} (Tooth #${item?.tooth ? toFDI(item.tooth) : 'General'}${surfaces})`;
};
