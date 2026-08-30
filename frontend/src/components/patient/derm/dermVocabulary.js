/**
 * The words a dermatologist actually writes with.
 *
 * Every list here is standard clinical vocabulary, not invented labels. That
 * matters more than it looks: "never use the word 'lesion' alone as your
 * primary descriptor" is the rule this file exists to enforce. A free-text box
 * gets you "rash on arm"; a picked morphology plus a site plus two millimetre
 * measurements gets you a record that reads the same to whoever opens it in
 * two years, and that can be searched and compared across visits.
 *
 * Sources: the standard dermatologic history and examination (NCBI Clinical
 * Methods ch. 106), primary/secondary morphology and ABCDE per current lesion
 * documentation guidance, Fitzpatrick I–VI, Norwood-Hamilton and Ludwig for
 * pattern hair loss, and the usual severity indices (GAGS, MASI, PASI, SCORAD,
 * VASI).
 *
 * Indian practice shaped two choices. Fitzpatrick is prominent rather than
 * buried, because IV–VI is the working range here and it decides laser and peel
 * settings. And melasma gets first-class grading, because it is one of the
 * commonest reasons a woman walks into a skin clinic in this country.
 */

/* ── Skin profile ─────────────────────────────────────────────────────────── */

// Fitzpatrick is a sun-response scale, not a colour chart, so each option
// carries the behaviour that defines it. Getting this wrong on a IV–VI skin is
// how a peel leaves post-inflammatory hyperpigmentation.
export const FITZPATRICK_TYPES = [
  { value: 'I',   label: 'Type I',   hint: 'Always burns, never tans' },
  { value: 'II',  label: 'Type II',  hint: 'Burns easily, tans minimally' },
  { value: 'III', label: 'Type III', hint: 'Burns mildly, tans gradually' },
  { value: 'IV',  label: 'Type IV',  hint: 'Burns minimally, tans well' },
  { value: 'V',   label: 'Type V',   hint: 'Rarely burns, tans profusely' },
  { value: 'VI',  label: 'Type VI',  hint: 'Never burns, deeply pigmented' },
];

export const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'];

/* ── History ──────────────────────────────────────────────────────────────── */

// Duration is the single most important question in a dermatologic history,
// so it is a required-feeling control rather than a line in the notes.
export const ONSET_TYPES = ['Sudden', 'Gradual', 'Insidious'];

export const COURSE_TYPES = [
  'Progressive', 'Stable', 'Relapsing and remitting', 'Improving', 'Fluctuating',
];

export const SYMPTOMS = [
  'Itching', 'Burning', 'Pain', 'Stinging', 'Tightness',
  'Dryness', 'Oiliness', 'Bleeding', 'Discharge', 'Odour', 'None',
];

export const AGGRAVATING_FACTORS = [
  'Sun exposure', 'Sweating', 'Heat', 'Cold and dry weather', 'Humidity',
  'Stress', 'Cosmetics', 'Soaps and detergents', 'Hair oil', 'Hair dye',
  'Shaving', 'Friction', 'Certain foods', 'Menstrual cycle', 'Pregnancy',
  'Medication', 'Occupational exposure', 'Water contact',
];

export const RELIEVING_FACTORS = [
  'Topical steroid', 'Emollient', 'Antihistamine', 'Sun avoidance',
  'Cold compress', 'Stopping a product', 'Rest', 'Nothing helps',
];

// Self-medication with over-the-counter steroid creams is endemic in India and
// changes the whole picture (steroid-modified tinea, rosacea-like dermatitis),
// so it is called out rather than left to be volunteered.
export const PAST_TREATMENTS = [
  'Topical steroid (self-prescribed)', 'Topical steroid (prescribed)',
  'Topical antifungal', 'Topical antibiotic', 'Topical retinoid',
  'Oral antibiotic', 'Oral antifungal', 'Oral isotretinoin',
  'Oral antihistamine', 'Oral steroid',
  'Chemical peel', 'Laser', 'Microneedling', 'PRP',
  'Home remedy', 'Ayurvedic or herbal', 'Homeopathic',
  'No prior treatment',
];

export const TREATMENT_RESPONSE = [
  'Complete clearance', 'Partial improvement', 'No change',
  'Worsened', 'Improved then relapsed', 'Not applicable',
];

// Isotretinoin, hormonal acne, melasma and chloasma all turn on this, and it is
// asked at every derm consult for a woman of reproductive age.
export const MENSTRUAL_STATUS = [
  'Regular cycles', 'Irregular cycles', 'PCOS diagnosed',
  'Pregnant', 'Lactating', 'Postmenopausal', 'Not applicable',
];

/* ── Lesion examination ───────────────────────────────────────────────────── */

export const PRIMARY_MORPHOLOGY = [
  { value: 'macule',  label: 'Macule',  hint: 'Flat, < 1 cm' },
  { value: 'patch',   label: 'Patch',   hint: 'Flat, > 1 cm' },
  { value: 'papule',  label: 'Papule',  hint: 'Raised, < 1 cm' },
  { value: 'plaque',  label: 'Plaque',  hint: 'Raised flat-topped, > 1 cm' },
  { value: 'nodule',  label: 'Nodule',  hint: 'Deeper, > 1 cm' },
  { value: 'vesicle', label: 'Vesicle', hint: 'Fluid filled, < 1 cm' },
  { value: 'bulla',   label: 'Bulla',   hint: 'Fluid filled, > 1 cm' },
  { value: 'pustule', label: 'Pustule', hint: 'Pus filled' },
  { value: 'wheal',   label: 'Wheal',   hint: 'Transient oedematous' },
  { value: 'cyst',    label: 'Cyst',    hint: 'Encapsulated, fluid or semi-solid' },
  { value: 'tumour',  label: 'Tumour',  hint: 'Large mass' },
  { value: 'comedone', label: 'Comedone', hint: 'Open or closed' },
  { value: 'burrow',  label: 'Burrow',  hint: 'Linear tunnel' },
  { value: 'telangiectasia', label: 'Telangiectasia', hint: 'Dilated vessel' },
];

export const SECONDARY_CHANGES = [
  'Scale', 'Crust', 'Erosion', 'Ulcer', 'Fissure', 'Excoriation',
  'Lichenification', 'Atrophy', 'Scar', 'Keloid', 'Sclerosis',
  'Maceration', 'Hyperpigmentation', 'Hypopigmentation', 'Depigmentation',
];

export const CONFIGURATIONS = [
  'Discrete', 'Grouped', 'Confluent', 'Annular', 'Arcuate', 'Linear',
  'Serpiginous', 'Reticulate', 'Targetoid', 'Herpetiform', 'Zosteriform',
];

export const DISTRIBUTIONS = [
  'Localised', 'Generalised', 'Symmetrical', 'Asymmetrical',
  'Photo-exposed', 'Photo-protected', 'Flexural', 'Extensor',
  'Acral', 'Intertriginous', 'Seborrhoeic areas', 'Dermatomal',
  'Follicular', 'Truncal', 'Koebnerised',
];

export const LESION_COLOURS = [
  'Skin coloured', 'Erythematous', 'Pink', 'Violaceous', 'Brown',
  'Hyperpigmented', 'Hypopigmented', 'Depigmented', 'Black',
  'Yellow', 'Grey', 'Blue', 'White', 'Variegated',
];

export const BORDER_TYPES = [
  'Well defined', 'Ill defined', 'Regular', 'Irregular', 'Notched', 'Raised edge',
];

export const PALPATION_FINDINGS = [
  'Soft', 'Firm', 'Hard', 'Mobile', 'Fixed', 'Fluctuant',
  'Tender', 'Non-tender', 'Warm', 'Indurated',
];

// Grouped so the picker can show a scalp-to-sole list without a 60-item wall.
export const BODY_REGIONS = [
  { group: 'Head and neck', sites: [
    'Scalp', 'Forehead', 'Eyebrows', 'Eyelids', 'Cheeks', 'Nose',
    'Perioral', 'Chin', 'Ears', 'Neck', 'Beard area',
  ]},
  { group: 'Trunk', sites: [
    'Upper back', 'Lower back', 'Chest', 'Abdomen', 'Axillae',
    'Breast', 'Groin', 'Buttocks',
  ]},
  { group: 'Upper limb', sites: [
    'Shoulders', 'Upper arms', 'Elbows', 'Forearms',
    'Wrists', 'Hands', 'Palms', 'Fingers', 'Fingernails',
  ]},
  { group: 'Lower limb', sites: [
    'Thighs', 'Knees', 'Shins', 'Calves',
    'Ankles', 'Feet', 'Soles', 'Toes', 'Toenails',
  ]},
  { group: 'Other', sites: [
    'Genitalia', 'Perianal', 'Oral mucosa', 'Generalised',
  ]},
];

export const ALL_SITES = BODY_REGIONS.flatMap((g) => g.sites);

/* ── Scalp and hair ───────────────────────────────────────────────────────── */

// This clinic does hair as well as skin, so pattern staging is first-class
// rather than a note. Norwood for men, Ludwig for women: the two are not
// interchangeable and picking the wrong scale makes the staging meaningless.
export const NORWOOD_STAGES = ['I', 'II', 'IIA', 'III', 'III vertex', 'IV', 'V', 'VI', 'VII'];
export const LUDWIG_GRADES = ['I', 'II', 'III'];

export const HAIR_COMPLAINTS = [
  'Diffuse hair fall', 'Patterned thinning', 'Patchy hair loss',
  'Receding hairline', 'Widening part', 'Breakage', 'Premature greying',
  'Dandruff', 'Itchy scalp', 'Oily scalp', 'Scalp pain', 'Beard patch',
  'Eyebrow loss', 'Eyelash loss',
];

export const PULL_TEST_RESULTS = ['Negative', 'Positive', 'Not performed'];

export const SCALP_FINDINGS = [
  'Normal', 'Scaling', 'Seborrhoeic dermatitis', 'Erythema',
  'Follicular plugging', 'Perifollicular erythema', 'Pustules',
  'Scarring', 'Loss of follicular ostia', 'Exclamation mark hairs',
  'Black dots', 'Yellow dots', 'Broken hairs', 'Miniaturised hairs',
];

export const HAIR_SHAFT_FINDINGS = [
  'Normal calibre', 'Miniaturisation', 'Variability in diameter',
  'Trichorrhexis nodosa', 'Split ends', 'Weathering',
];

/* ── Severity indices ─────────────────────────────────────────────────────── */

// Only the score for the condition in front of you is shown. A form that asks
// for PASI on an acne patient trains people to leave scores blank.
export const SEVERITY_SCALES = [
  {
    id: 'acne_grade',
    label: 'Acne grade',
    hint: 'Global grading, I to IV',
    options: [
      { value: 'I',   label: 'Grade I — comedonal' },
      { value: 'II',  label: 'Grade II — papular' },
      { value: 'III', label: 'Grade III — pustular' },
      { value: 'IV',  label: 'Grade IV — nodulocystic' },
    ],
  },
  {
    id: 'melasma_pattern',
    label: 'Melasma pattern',
    hint: 'Facial distribution',
    options: [
      { value: 'centrofacial', label: 'Centrofacial' },
      { value: 'malar',        label: 'Malar' },
      { value: 'mandibular',   label: 'Mandibular' },
      { value: 'extrafacial',  label: 'Extrafacial' },
    ],
  },
  {
    id: 'melasma_depth',
    label: 'Melasma depth',
    hint: 'On Wood’s lamp — decides what will respond',
    options: [
      { value: 'epidermal', label: 'Epidermal — enhances' },
      { value: 'dermal',    label: 'Dermal — no enhancement' },
      { value: 'mixed',     label: 'Mixed' },
    ],
  },
];

// Free-numeric indices. Kept separate from the pick-lists because they are
// computed at the chairside and compared visit to visit, which is the whole
// reason for recording them at all.
export const SEVERITY_SCORES = [
  { id: 'masi',   label: 'MASI',   hint: 'Melasma area and severity, 0 to 48',  max: 48 },
  { id: 'pasi',   label: 'PASI',   hint: 'Psoriasis area and severity, 0 to 72', max: 72 },
  { id: 'scorad', label: 'SCORAD', hint: 'Atopic dermatitis, 0 to 103',          max: 103 },
  { id: 'vasi',   label: 'VASI',   hint: 'Vitiligo area, 0 to 100',              max: 100 },
  { id: 'bsa',    label: 'BSA %',  hint: 'Body surface area involved',           max: 100 },
];

/* ── Investigations ───────────────────────────────────────────────────────── */

export const INVESTIGATIONS = [
  'Wood’s lamp', 'Dermoscopy', 'Trichoscopy', 'KOH mount',
  'Gram stain', 'Fungal culture', 'Bacterial culture',
  'Skin biopsy', 'Patch test', 'Prick test',
  'Tzanck smear', 'Slit skin smear',
  'CBC', 'Thyroid profile', 'Serum ferritin', 'Vitamin D', 'Vitamin B12',
  'Blood sugar', 'Lipid profile', 'LFT', 'RFT',
  'Hormonal panel (LH, FSH, testosterone, DHEAS)', 'ANA',
];

/* ── Plan ─────────────────────────────────────────────────────────────────── */

export const PROCEDURE_PLAN = [
  'Chemical peel', 'Microdermabrasion', 'Microneedling', 'MNRF',
  'Q-switched Nd:YAG', 'CO2 laser', 'Diode laser hair reduction',
  'Carbon peel', 'Hydrafacial', 'PRP (scalp)', 'PRP (face)',
  'GFC', 'Mesotherapy', 'Intralesional steroid', 'Cryotherapy',
  'Electrocautery', 'RF cautery', 'Comedone extraction',
  'Excision', 'Punch biopsy', 'Hair transplant consult', 'Phototherapy (NBUVB)',
];

export const GENERAL_ADVICE = [
  'Broad-spectrum sunscreen, reapply every 3 hours',
  'Strict sun avoidance',
  'Gentle cleanser only',
  'Regular moisturiser',
  'Stop all self-prescribed creams',
  'Avoid scrubbing and picking',
  'Avoid hair oil and heavy products',
  'Patch test new cosmetics',
  'Cotton clothing, keep the area dry',
  'Diet and lifestyle counselling',
];

/* ── The empty record ─────────────────────────────────────────────────────── */

/**
 * The shape stored in case_papers.derm_findings.
 *
 * Every reader must tolerate a missing key: papers written before a field
 * existed will not have it, and this form is expected to keep growing. Merge
 * against this default rather than assuming any key is present.
 */
export const EMPTY_DERM_FINDINGS = {
  // What is being treated this visit. Drives which assessment blocks appear
  // and which treatments are shortlisted, so it is the first thing recorded.
  conditions: [],
  // Per-condition answers, keyed by condition id: { acne: { grade: 'III' } }
  assessments: {},
  // The treatments she actually selected, and any course she scheduled.
  treatment: { selected: [], sessions: {}, notes: '' },
  profile: {
    fitzpatrick: '',
    skin_type: '',
  },
  history: {
    duration_value: '',
    duration_unit: 'days',
    onset: '',
    course: '',
    symptoms: [],
    itch_severity: 0,
    aggravating: [],
    relieving: [],
    past_treatments: [],
    treatment_response: '',
    menstrual_status: '',
    family_history: '',
    occupation_exposure: '',
  },
  lesions: [],
  hair: {
    is_relevant: false,
    complaints: [],
    scale: '',           // 'norwood' | 'ludwig'
    stage: '',
    pull_test: '',
    pull_test_count: '',
    scalp_findings: [],
    shaft_findings: [],
    trichoscopy_notes: '',
  },
  severity: {
    scales: {},          // { acne_grade: 'II', melasma_depth: 'mixed' }
    scores: {},          // { masi: '12.4' }
  },
  investigations: {
    ordered: [],
    findings: '',
  },
  plan: {
    procedures: [],
    advice: [],
  },
  differential: '',
};

/** One lesion, as added from the site picker. */
export const emptyLesion = (site = '') => ({
  id: `L${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  site,
  morphology: '',
  secondary: [],
  configuration: '',
  distribution: '',
  colour: '',
  border: '',
  palpation: [],
  size_mm: '',
  size_mm_2: '',
  abcde: [],
  notes: '',
});

export const ABCDE_FLAGS = [
  { value: 'A', label: 'Asymmetry' },
  { value: 'B', label: 'Border irregularity' },
  { value: 'C', label: 'Colour variegation' },
  { value: 'D', label: 'Diameter > 6 mm' },
  { value: 'E', label: 'Evolving' },
];

/**
 * Fill in whatever a stored record is missing, without losing what it has.
 * Shallow-merges one level into each section, which is as deep as the shape goes.
 */
export function withDermDefaults(stored) {
  const base = EMPTY_DERM_FINDINGS;
  if (!stored || typeof stored !== 'object') return structuredClone(base);
  const out = structuredClone(base);
  for (const key of Object.keys(base)) {
    const value = stored[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(base[key])) out[key] = Array.isArray(value) ? value : base[key];
    else if (typeof base[key] === 'object') out[key] = { ...base[key], ...value };
    else out[key] = value;
  }
  return out;
}

/** True once anything has actually been recorded — drives the "empty" states. */
export function hasDermContent(f) {
  if (!f) return false;
  return Boolean(
    f.conditions?.length ||
    f.treatment?.selected?.length ||
    f.lesions?.length ||
    f.profile?.fitzpatrick ||
    f.history?.duration_value ||
    f.history?.symptoms?.length ||
    f.hair?.is_relevant ||
    f.investigations?.ordered?.length ||
    f.plan?.procedures?.length
  );
}

/** A lesion in one line, for lists and summaries. */
export function describeLesion(lesion) {
  const size = lesion.size_mm
    ? `${lesion.size_mm}${lesion.size_mm_2 ? ` × ${lesion.size_mm_2}` : ''} mm`
    : '';
  return [
    lesion.colour,
    lesion.morphology,
    lesion.configuration && lesion.configuration !== 'Discrete' ? lesion.configuration.toLowerCase() : '',
    size,
    lesion.site ? `on the ${lesion.site.toLowerCase()}` : '',
  ].filter(Boolean).join(' ');
}
