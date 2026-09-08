/**
 * Everything the board and the table both need to agree on.
 *
 * The two views render the same plan, so any rule about what a status is
 * called, what colour it carries, or how a tooth is written has to live in one
 * place — otherwise the board says "In Progress" in navy and the table says
 * "Active" in blue, and the doctor has to work out that they mean the same
 * thing.
 */
import { universalToFDI } from '../../../utils/toothNumbering';
import { formatSurfaces } from '../dentalConstants';

/** The three columns, and the vocabulary for each. Single source of truth. */
export const STATUS_META = {
  planned: {
    id: 'planned',
    label: 'Planned',
    text: 'text-gray-600',
    chip: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    /* The tint a card's footer button uses to advance INTO this status. */
    action: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  },
  'in-progress': {
    id: 'in-progress',
    label: 'In Progress',
    text: 'text-[#2a276e]',
    chip: 'bg-[#f0f4ff] text-[#2a276e] border-[#e0e7ff]',
    dot: 'bg-[#2a276e]',
    action: 'bg-[#f8f9ff] text-[#2a276e] hover:bg-[#e6eaff]',
  },
  completed: {
    id: 'completed',
    label: 'Completed',
    text: 'text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dot: 'bg-emerald-500',
    action: 'bg-emerald-50/70 text-emerald-600 hover:bg-emerald-100',
  },
};

export const STATUS_ORDER = ['planned', 'in-progress', 'completed'];

/** A plan item with no status has never been moved, so it is still planned. */
export const statusOf = (item) => {
  const s = (item?.status || '').toLowerCase();
  return STATUS_META[s] ? s : 'planned';
};

export const isCompleted = (item) => statusOf(item) === 'completed';

/**
 * How a procedure's teeth are written, everywhere.
 *
 * Three shapes reach this. A per-tooth item carries `tooth` (Universal, stored).
 * A combined item — one quadrant scaling rather than eight separate ones —
 * carries `teeth`, an array, and a null `tooth`. Anything else is general work
 * with no tooth at all. FDI on the way out, because that is what the doctor
 * reads; the stored numbers never change.
 */
export const toothLabel = (item) => {
  if (Array.isArray(item?.teeth) && item.teeth.length) {
    return item.teeth.map(universalToFDI).join(', ');
  }
  if (item?.tooth === 0 || item?.tooth) return String(universalToFDI(item.tooth));
  return '';
};

/** The same thing, as a list, for the views that render one chip per tooth. */
export const toothList = (item) => {
  if (Array.isArray(item?.teeth) && item.teeth.length) return item.teeth;
  if (item?.tooth === 0 || item?.tooth) return [item.tooth];
  return [];
};

export const isCombined = (item) => Array.isArray(item?.teeth) && item.teeth.length > 1;

/**
 * Which surfaces the procedure is on, as a doctor writes them: "MOD", "ID".
 * Named for the tooth, so an anterior composite reads ID rather than OD.
 * Empty string when the procedure records none, which is most of them.
 */
export const surfacesLabel = (item) => {
  if (!Array.isArray(item?.surfaces) || !item.surfaces.length) return '';
  return formatSurfaces(item.tooth ?? item.teeth?.[0], item.surfaces);
};

export const qtyOf = (item) => Number(item?.qty) || 1;

/**
 * The fee for one unit. Deliberately returns null rather than a number when
 * nothing has been entered: the board used to fall back to 600, which printed
 * a fee the clinic never agreed to as though it were real.
 */
export const unitPrice = (item) => {
  const n = Number(item?.cost);
  return Number.isFinite(n) && item?.cost !== null && item?.cost !== '' ? n : null;
};

export const itemTotal = (item) => (unitPrice(item) ?? 0) * qtyOf(item);

export const planTotal = (items = []) =>
  items.reduce((sum, item) => sum + itemTotal(item), 0);

/**
 * The three board columns.
 *
 * `treatmentHistory` is work recorded outside this plan (past payments), which
 * is why completed items are merged and sorted by date while the other two
 * keep the visit order the doctor put them in.
 */
export const deriveColumns = (treatmentPlan = [], treatmentHistory = []) => {
  const byVisit = (a, b) => (a.visit_number || 0) - (b.visit_number || 0);

  const completed = [
    ...treatmentPlan.filter(isCompleted),
    ...treatmentHistory.map((h) => ({ ...h, status: 'completed', isHistory: true })),
  ].sort(
    (a, b) =>
      new Date(b.date || b.appointment_date || 0) - new Date(a.date || a.appointment_date || 0)
  );

  return {
    planned: treatmentPlan.filter((i) => statusOf(i) === 'planned').sort(byVisit),
    'in-progress': treatmentPlan.filter((i) => statusOf(i) === 'in-progress').sort(byVisit),
    completed,
  };
};

/** Table order: planned first, then in progress, then completed. */
export const sortedForTable = (treatmentPlan = []) => {
  const rank = (i) => STATUS_ORDER.indexOf(statusOf(i));
  return [...treatmentPlan].sort(
    (a, b) => rank(a) - rank(b) || (a.visit_number || 0) - (b.visit_number || 0)
  );
};

export const formatDate = (value) => {
  const d = new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
