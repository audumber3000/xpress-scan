/**
 * The arithmetic a perio chart does for you.
 *
 * Nothing here is entered by hand. Attachment loss is probing depth plus
 * recession, and the percentages are counts over sites recorded — numbers a
 * clinician should never be adding up on paper while a patient waits.
 */
import { ALL_SITES, SEXTANTS } from './perioConstants';

export const emptyChart = () => ({
  mode: 'bpe',
  recorded_at: null,
  bpe: {},
  teeth: {},
  notes: '',
});

/** Snapshots arrive as an object, a JSON string, or nothing at all. */
export const normaliseChart = (raw) => {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!value || typeof value !== 'object') return emptyChart();
  return {
    mode: value.mode === 'full' ? 'full' : 'bpe',
    recorded_at: value.recorded_at || null,
    bpe: value.bpe && typeof value.bpe === 'object' ? value.bpe : {},
    teeth: value.teeth && typeof value.teeth === 'object' ? value.teeth : {},
    notes: typeof value.notes === 'string' ? value.notes : '',
  };
};

export const toothRecord = (chart, tooth) => chart?.teeth?.[String(tooth)] || {};

export const siteDepth = (chart, tooth, site) => {
  const v = toothRecord(chart, tooth).pd?.[site];
  return v === 0 || v ? Number(v) : null;
};

export const siteRecession = (chart, tooth, site) => {
  const v = toothRecord(chart, tooth).rec?.[site];
  return v === 0 || v ? Number(v) : null;
};

/**
 * Clinical attachment loss. Computed, never typed: it is probing depth plus
 * recession by definition, and a chart that lets you enter it separately is a
 * chart that will eventually disagree with itself.
 */
export const siteCal = (chart, tooth, site) => {
  const pd = siteDepth(chart, tooth, site);
  if (pd === null) return null;
  return pd + (siteRecession(chart, tooth, site) ?? 0);
};

export const hasFlag = (chart, tooth, key, site) =>
  Array.isArray(toothRecord(chart, tooth)[key]) && toothRecord(chart, tooth)[key].includes(site);

/** Immutably set one site's value, pruning empties so the snapshot stays sparse. */
export const setSiteValue = (chart, tooth, key, site, value) => {
  const id = String(tooth);
  const tr = { ...(chart.teeth[id] || {}) };
  const group = { ...(tr[key] || {}) };
  if (value === null || value === '' || Number.isNaN(value)) delete group[site];
  else group[site] = value;
  if (Object.keys(group).length) tr[key] = group; else delete tr[key];
  return writeTooth(chart, id, tr);
};

export const toggleSiteFlag = (chart, tooth, key, site) => {
  const id = String(tooth);
  const tr = { ...(chart.teeth[id] || {}) };
  const list = Array.isArray(tr[key]) ? [...tr[key]] : [];
  const at = list.indexOf(site);
  if (at === -1) list.push(site); else list.splice(at, 1);
  if (list.length) tr[key] = list; else delete tr[key];
  return writeTooth(chart, id, tr);
};

export const setToothValue = (chart, tooth, key, value) => {
  const id = String(tooth);
  const tr = { ...(chart.teeth[id] || {}) };
  if (value === null || value === undefined || value === '') delete tr[key];
  else tr[key] = value;
  return writeTooth(chart, id, tr);
};

const writeTooth = (chart, id, record) => {
  const teeth = { ...chart.teeth };
  if (Object.keys(record).length) teeth[id] = record; else delete teeth[id];
  return { ...chart, teeth, recorded_at: new Date().toISOString() };
};

export const setBpe = (chart, sextant, code) => {
  const bpe = { ...chart.bpe };
  if (!code) delete bpe[sextant]; else bpe[sextant] = code;
  return { ...chart, bpe, recorded_at: new Date().toISOString() };
};

/** The number that decides what happens next, ignoring unscorable sextants. */
export const worstBpeCode = (chart) => {
  const scores = SEXTANTS
    .map((s) => chart.bpe?.[s.id])
    .filter(Boolean)
    .map((v) => String(v).replace('*', ''))
    .filter((v) => v !== 'X');
  if (!scores.length) return null;
  return scores.sort().reverse()[0];
};

export const anyFurcationStar = (chart) =>
  SEXTANTS.some((s) => String(chart.bpe?.[s.id] || '').includes('*'));

/**
 * The summary strip. Percentages are over sites actually recorded, not over
 * all 192 possible ones — a partial chart that reported 4% bleeding because
 * most of the mouth was blank would be worse than reporting nothing.
 */
export const chartSummary = (chart) => {
  let recorded = 0, bleeding = 0, plaque = 0, deep = 0, severe = 0, depthSum = 0;
  const teethCharted = new Set();

  Object.entries(chart.teeth || {}).forEach(([tooth, rec]) => {
    ALL_SITES.forEach((site) => {
      const pd = rec.pd?.[site];
      if (pd === 0 || pd) {
        recorded += 1;
        teethCharted.add(tooth);
        const n = Number(pd);
        depthSum += n;
        if (n >= 4) deep += 1;
        if (n >= 6) severe += 1;
      }
      if (Array.isArray(rec.bop) && rec.bop.includes(site)) bleeding += 1;
      if (Array.isArray(rec.plq) && rec.plq.includes(site)) plaque += 1;
    });
  });

  const pct = (n) => (recorded ? Math.round((n / recorded) * 100) : null);

  return {
    recorded,
    teethCharted: teethCharted.size,
    bopPercent: pct(bleeding),
    plaquePercent: pct(plaque),
    sitesDeep: deep,
    sitesSevere: severe,
    meanDepth: recorded ? (depthSum / recorded).toFixed(1) : null,
  };
};

/** A tooth the dental chart says is gone is not probed. */
export const isMissing = (teethData, tooth) =>
  (teethData?.[tooth]?.status || '') === 'missing';
