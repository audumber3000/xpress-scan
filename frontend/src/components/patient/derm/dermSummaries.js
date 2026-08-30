/**
 * The one-line summaries a collapsed section shows.
 *
 * Their own module because a file that exports both a component and a plain
 * function breaks React Fast Refresh, and because these are the part of the
 * screen that has to stay honest: a collapsed section is only acceptable if the
 * line on its header says what is inside it. Keeping them together makes it
 * obvious when one has drifted from the fields it claims to summarise.
 */

/** What has been answered for one condition, e.g. "Grade III · 3 sites". */
export function summariseAssessment(condition, answers = {}) {
  const bits = [];
  for (const field of condition.assess) {
    const v = answers[field.key];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;

    if (field.type === 'score') {
      bits.push(`${field.label} ${v}`);
    } else if (field.type === 'one') {
      const opt = field.options
        .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
        .find((o) => o.value === v);
      bits.push(field.key === 'grade' ? `Grade ${opt?.label ?? v}` : (opt?.label ?? v));
    } else {
      bits.push(v.length === 1 ? v[0] : `${v.length} ${field.label.toLowerCase()}`);
    }
  }
  return bits.join(' · ');
}

/**
 * The patient facts worth seeing without opening anything.
 *
 * Deliberately leads with the three that drive the safety rails — skin type,
 * pregnancy, self-prescribed steroid — so the things that constrain the plan
 * are visible even when the section is shut.
 */
export function summarisePatientFactors(derm) {
  const p = derm.profile || {};
  const h = derm.history || {};
  const bits = [];
  if (p.fitzpatrick) bits.push(`Fitzpatrick ${p.fitzpatrick}`);
  if (p.skin_type) bits.push(p.skin_type);
  if (h.duration_value) bits.push(`${h.duration_value} ${h.duration_unit || 'days'}`);
  if (h.course) bits.push(h.course.toLowerCase());
  if (h.past_treatments?.includes('Topical steroid (self-prescribed)')) {
    bits.push('self-prescribed steroid');
  }
  if (['Pregnant', 'Lactating'].includes(h.menstrual_status)) {
    bits.push(h.menstrual_status.toLowerCase());
  }
  return bits.join(' · ');
}
