// What a dental clinic actually spends money on.
//
// The old list was seven options — Inventory, Salary, Rent, Utilities,
// Maintenance, Marketing, Other — which is a generic small-business list, not a
// clinic's. It could not tell electricity from water, had nowhere to put
// biomedical waste collection (which every Indian clinic pays for by law and by
// the kilo), and filed a ₹2L chair purchase under the same heading as a tap
// washer. "Where is the money going" cannot be answered from a list like that.
//
// Categories are flat on the record — `expenses.category` is still one string —
// and grouped only for display and reporting. That keeps every row ever written
// valid, including the legacy names below, and means adding a category is a
// one-line change here rather than a migration.

/**
 * Groups, in the order a clinic thinks about its costs: the people first,
 * then the place, then the clinical work, then the business around it.
 */
export const CATEGORY_GROUPS = [
  {
    id: 'people',
    short: 'People',
    label: 'People',
    color: '#2a276e',
    categories: [
      'Staff salary',
      'Doctor / consultant fees',
      'Staff welfare',
      'Training & courses',
    ],
  },
  {
    id: 'premises',
    short: 'Premises',
    label: 'Premises & utilities',
    color: '#5b52c9',
    categories: [
      'Rent',
      'Electricity',
      'Water',
      'Internet & phone',
      'Housekeeping',
      'Biomedical waste',
      'Security',
      'Property tax & society',
    ],
  },
  {
    id: 'clinical',
    short: 'Clinical',
    label: 'Clinical',
    color: '#29828a',
    categories: [
      'Dental materials',
      'Lab charges',
      'Medicines & pharmacy',
      'Sterilisation supplies',
      'Imaging & X-ray',
      'Equipment purchase',
      'Equipment repair & AMC',
    ],
  },
  {
    id: 'business',
    short: 'Business',
    label: 'Running the business',
    color: '#9B8CFF',
    categories: [
      'Marketing & ads',
      'Software & subscriptions',
      'Professional fees',
      'Licences & registration',
      'Insurance',
      'Bank charges',
      'Taxes',
      'Loan / EMI',
      'Travel & fuel',
      'Printing & stationery',
      'Other',
    ],
  },
];

/** Every category name, flat, in group order. */
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

/**
 * Categories written before this list existed, and the group each belongs to.
 *
 * Nothing rewrites them. A clinic with four years of rows filed under
 * "Utilities" keeps those rows and keeps that word on screen; it just stops
 * being offered for new entries, and reports know where to file it. Renaming
 * history to tidy a dropdown would silently change what a past month cost.
 *
 * `Lab` and `Consultant` are not user-typed at all — they are what settling a
 * payable writes — so they map rather than disappear.
 */
export const LEGACY_CATEGORIES = {
  Inventory: 'clinical',
  Salary: 'people',
  Consultant: 'people',
  Lab: 'clinical',
  Rent: 'premises',
  Utilities: 'premises',
  Maintenance: 'clinical',
  Marketing: 'business',
  General: 'business',
  Other: 'business',
};

const GROUP_OF = (() => {
  const map = { ...LEGACY_CATEGORIES };
  CATEGORY_GROUPS.forEach((g) => g.categories.forEach((c) => { map[c] = g.id; }));
  return map;
})();

const GROUP_BY_ID = Object.fromEntries(CATEGORY_GROUPS.map((g) => [g.id, g]));

/** Which group a category belongs to. Unknown values fall to the business bucket. */
export const groupIdOf = (category) => GROUP_OF[category] || 'business';

export const groupOf = (category) => GROUP_BY_ID[groupIdOf(category)];

/** The group's colour, so a category keeps the same hue in every chart. */
export const colorOf = (category) => groupOf(category).color;

/**
 * Distinct shades within a group, so a donut of eight categories is readable
 * rather than four pairs of identical wedges. Derived from the group colour by
 * stepping opacity, which keeps a wedge recognisably "clinical" or "people"
 * while still separating it from its neighbours.
 */
export const shadeFor = (category, indexWithinChart = 0) => {
  const base = colorOf(category);
  const steps = [1, 0.78, 0.58, 0.42, 0.3];
  return { fill: base, fillOpacity: steps[indexWithinChart % steps.length] };
};

/**
 * A palette for charts that rank categories against each other rather than
 * grouping them. Ordered so the first few are maximally distinct.
 */
export const CHART_COLORS = [
  '#2a276e', '#29828a', '#9B8CFF', '#f59e0b', '#5b52c9',
  '#0ea5e9', '#ec4899', '#84cc16', '#f97316', '#64748b',
];

/**
 * Options for a `<select>`, with the value currently on the record forced in.
 *
 * Same reason the prescription constants do it: a select can only show what is
 * in its option list, so reopening an expense filed under "Utilities" would
 * show a blank box and saving would silently refile it as whatever sat at the
 * top of the list.
 */
export const groupedOptions = (current) => {
  const groups = CATEGORY_GROUPS.map((g) => ({ label: g.label, options: g.categories }));
  if (current && !ALL_CATEGORIES.includes(current)) {
    return [{ label: 'Currently set', options: [current] }, ...groups];
  }
  return groups;
};
