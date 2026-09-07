/**
 * The field types a clinic can put on a form, and what each one needs.
 *
 * Shared by the editor and the preview so the two cannot drift: if a type is
 * added here with `needsOptions`, the editor asks for options and the preview
 * renders them without either file being touched again. The list mirrors
 * ANSWER_TYPES / LAYOUT_TYPES in backend/domains/forms/routes/forms.py — a type
 * missing on either side is rejected on save rather than rendering as nothing.
 */
export const FIELD_TYPES = [
  { id: 'section',        label: 'Section heading', hint: 'Breaks the form into steps on the patient\'s phone', layout: true },
  { id: 'text',           label: 'Short answer',    hint: 'One line' },
  { id: 'textarea',       label: 'Long answer',     hint: 'A paragraph' },
  { id: 'email',          label: 'Email address',   hint: 'Checked as an email on the phone' },
  { id: 'phone',          label: 'Phone number',    hint: 'Opens the number pad' },
  { id: 'date',           label: 'Date',            hint: 'A date picker' },
  { id: 'single_select',  label: 'Pick one',        hint: 'One answer from a list', needsOptions: true },
  { id: 'multi_select',   label: 'Pick any',        hint: 'Several answers from a short list', needsOptions: true },
  { id: 'checkbox_grid',  label: 'Tick list',       hint: 'A long list of conditions, shown as one question', needsOptions: true },
  { id: 'yes_no_explain', label: 'Yes / No + why',  hint: 'The explain box only appears on Yes' },
  { id: 'boolean',        label: 'Single tick',     hint: 'One box to agree to something' },
  { id: 'declaration',    label: 'Declaration',     hint: 'Wording the patient agrees to, with a tick' },
  { id: 'signature',      label: 'Signature',       hint: 'Signed with a finger' },
];

export const TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((t) => [t.id, t]));

// Types that cannot write onto the patient's file: there is no text in a
// signature or a tick to put in a clinical column. The server refuses these
// too — this is so the editor never offers the choice in the first place.
export const CANNOT_MAP = new Set(['signature', 'declaration', 'boolean', 'section']);

export const isLayout = (type) => !!TYPE_MAP[type]?.layout;
export const needsOptions = (type) => !!TYPE_MAP[type]?.needsOptions;

/** A key the patient's answers are stored under. Derived from the label so a
 *  clinic never has to think about it, and kept unique within the form. */
export const keyFor = (label, taken) => {
  const base = (label || 'question')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'question';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};
