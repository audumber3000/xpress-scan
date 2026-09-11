// Universal tooth numbering system
export const UNIVERSAL_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const UNIVERSAL_LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

// Tooth names by number
export const TOOTH_NAMES = {
    1: 'UR 3rd Molar', 2: 'UR 2nd Molar', 3: 'UR 1st Molar', 4: 'UR 2nd Premolar', 5: 'UR 1st Premolar',
    6: 'UR Canine', 7: 'UR Lateral Incisor', 8: 'UR Central Incisor',
    9: 'UL Central Incisor', 10: 'UL Lateral Incisor', 11: 'UL Canine', 12: 'UL 1st Premolar',
    13: 'UL 2nd Premolar', 14: 'UL 1st Molar', 15: 'UL 2nd Molar', 16: 'UL 3rd Molar',
    17: 'LL 3rd Molar', 18: 'LL 2nd Molar', 19: 'LL 1st Molar', 20: 'LL 2nd Premolar',
    21: 'LL 1st Premolar', 22: 'LL Canine', 23: 'LL Lateral Incisor', 24: 'LL Central Incisor',
    25: 'LR Central Incisor', 26: 'LR Lateral Incisor', 27: 'LR Canine', 28: 'LR 1st Premolar',
    29: 'LR 2nd Premolar', 30: 'LR 1st Molar', 31: 'LR 2nd Molar', 32: 'LR 3rd Molar',
};

// Professional clinical color scheme
export const SURFACE_COLORS = {
    none: 'transparent',
    caries: '#3f2b1d',           // Dark brown/black for decay
    filling_existing: '#3b82f6', // Blue for existing filling
    filling_amalgam: '#71717A',  // Gray for amalgam
    filling_temp: '#f97316',     // Orange for temporary
    filling_gold: '#D4AF37',     // Gold
    crown_gold: '#D4AF37',       // Gold crown
    crown_porcelain: '#f8fafc',  // White/Ivory crown
    fracture: '#991B1B',         // Dark red for crack
};

// Condition labels for display
export const CONDITION_LABELS = {
    caries: 'Caries',
    filling_existing: 'Existing Filling',
    filling_amalgam: 'Amalgam Filling',
    filling_temp: 'Temporary Filling',
    filling_gold: 'Gold Filling',
    crown_gold: 'Gold Crown',
    crown_porcelain: 'Porcelain Crown',
    fracture: 'Fracture',
};

// Professional clinical statuses — SINGLE SOURCE OF TRUTH for the dental chart.
// Convention: amber = planned/needed work, blue = existing/completed work,
// red = extracted. `present`/`impacted` carry no fill (handled by anatomy/hatch).
// RealisticDentalChart imports this map directly, so editing here recolours the chart.
export const STATUS_COLORS = {
    present: null,       // healthy — keep natural anatomy
    planned: '#f59e0b',  // amber — planned procedure
    existing: '#3b82f6', // blue — existing work with no symbol of its own
    implant: '#3b82f6',  // blue — an actual implant, drawn with a screw
    rootCanal: '#3b82f6',// blue — existing endodontic work
    missing: '#ef4444',  // red — extracted
    impacted: null,      // slate hatch overlay handles this
};

// Status labels
export const STATUS_LABELS = {
    present: 'Present',
    missing: 'Missing/Extracted',
    implant: 'Dental Implant',
    rootCanal: 'Root Canal',
    impacted: 'Impacted',
    planned: 'Planned Treatment',
    fractured: 'Fractured',
};

// Surface definitions
export const SURFACES = [
    { key: 'M', label: 'Mesial', desc: 'Side toward midline' },
    { key: 'O', label: 'Occlusal', desc: 'Biting surface' },
    { key: 'D', label: 'Distal', desc: 'Side away from midline' },
    { key: 'B', label: 'Buccal', desc: 'Cheek side' },
    { key: 'L', label: 'Lingual', desc: 'Tongue side' },
];


/* ──────────────────────────────────────────────────────────────────────────
   Surfaces are a property of the tooth, not a fixed list
   ──────────────────────────────────────────────────────────────────────────

   `SURFACES` above is the neutral five and stays exported for the cases with
   no single tooth to speak of (a multi-tooth selection). Everywhere a specific
   tooth is in hand, use `surfacesFor(tooth)` instead: an incisor has no
   occlusal surface, and an upper tooth faces the palate rather than the tongue.

   THE STORED KEY NEVER VARIES. `M O D B L` are written to teethData exactly as
   they always have been; only `short` (the letter drawn) and `label` (the word
   read) change per tooth. Same discipline as tooth numbering — store Universal,
   display FDI — so no existing chart data means anything different than it did.
*/

/** Canine to canine, upper and lower. These carry an incisal edge. */
export const ANTERIOR_TEETH = new Set([6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27]);

/** Primary anteriors are the x1/x2/x3 of each quadrant (FDI 51–85). */
const PRIMARY_ANTERIOR = new Set([51, 52, 53, 61, 62, 63, 71, 72, 73, 81, 82, 83]);

export const isAnteriorTooth = (tooth) => {
    const n = Number(tooth);
    return ANTERIOR_TEETH.has(n) || PRIMARY_ANTERIOR.has(n);
};

export const isUpperTooth = (tooth) => {
    const n = Number(tooth);
    return (n >= 1 && n <= 16) || (n >= 51 && n <= 65);
};

/**
 * The five surfaces of one tooth, correctly named for it.
 * `key` is storage, `short` is the button, `label` is the word.
 */
export const surfacesFor = (tooth) => {
    const anterior = isAnteriorTooth(tooth);
    const upper = isUpperTooth(tooth);
    return [
        { key: 'M', short: 'M', label: 'Mesial', desc: 'Side toward the midline' },
        anterior
            ? { key: 'O', short: 'I', label: 'Incisal', desc: 'Biting edge' }
            : { key: 'O', short: 'O', label: 'Occlusal', desc: 'Biting surface' },
        { key: 'D', short: 'D', label: 'Distal', desc: 'Side away from the midline' },
        anterior
            ? { key: 'B', short: 'B', label: 'Labial', desc: 'Lip side' }
            : { key: 'B', short: 'B', label: 'Buccal', desc: 'Cheek side' },
        upper
            ? { key: 'L', short: 'P', label: 'Palatal', desc: 'Palate side' }
            : { key: 'L', short: 'L', label: 'Lingual', desc: 'Tongue side' },
    ];
};

/**
 * The surfaces to offer for a whole selection.
 *
 * The two axes are independent and must be judged separately. Select the upper
 * right quadrant and every tooth is upper — so the palatal surface is certainly
 * P — while 1-5 are posterior and 6-8 anterior, so the biting surface has no
 * single right name. Falling back to the neutral five for any group, as this
 * did, got BOTH wrong: it printed L on teeth that have no lingual surface.
 */
export const surfacesForMany = (teeth = []) => {
    const list = [...new Set(teeth.map(Number).filter(Number.isFinite))];
    if (!list.length) return SURFACES;
    if (list.length === 1) return surfacesFor(list[0]);

    const anteriorAgrees = list.every(isAnteriorTooth) || !list.some(isAnteriorTooth);
    const upperAgrees = list.every(isUpperTooth) || !list.some(isUpperTooth);
    const anterior = anteriorAgrees && isAnteriorTooth(list[0]);
    const upper = upperAgrees && isUpperTooth(list[0]);

    return [
        { key: 'M', short: 'M', label: 'Mesial', desc: 'Side toward the midline' },
        !anteriorAgrees
            ? { key: 'O', short: 'O', label: 'Occlusal / incisal', desc: 'Biting surface — this selection mixes front and back teeth' }
            : anterior
                ? { key: 'O', short: 'I', label: 'Incisal', desc: 'Biting edge' }
                : { key: 'O', short: 'O', label: 'Occlusal', desc: 'Biting surface' },
        { key: 'D', short: 'D', label: 'Distal', desc: 'Side away from the midline' },
        !anteriorAgrees
            ? { key: 'B', short: 'B', label: 'Buccal / labial', desc: 'Cheek or lip side' }
            : anterior
                ? { key: 'B', short: 'B', label: 'Labial', desc: 'Lip side' }
                : { key: 'B', short: 'B', label: 'Buccal', desc: 'Cheek side' },
        !upperAgrees
            ? { key: 'L', short: 'L', label: 'Lingual / palatal', desc: 'This selection mixes upper and lower teeth' }
            : upper
                ? { key: 'L', short: 'P', label: 'Palatal', desc: 'Palate side' }
                : { key: 'L', short: 'L', label: 'Lingual', desc: 'Tongue side' },
    ];
};

/** One surface's word, for saying out loud which one is selected. */
export const surfaceLabel = (tooth, key) =>
    surfacesFor(tooth).find((s) => s.key === key)?.label || key;

/** A set of surface keys as a doctor writes them: ['O','D'] on #22 -> "ID". */
export const formatSurfaces = (tooth, keys = []) =>
    surfacesFor(tooth)
        .filter((s) => keys.includes(s.key))
        .map((s) => s.short)
        .join('');

/**
 * The surface map used to draw a separate facial arch and emit 'F' for it,
 * while the constants only ever defined five surfaces and no 'F'. Facial and
 * buccal are the same surface, so anything recorded on that arch was written to
 * a key nothing else read and quietly vanished.
 *
 * The map emits 'B' now. This folds the old key in on read, which is the right
 * place for it: chart snapshots are JSON blobs spread across every case paper
 * ever saved, and a migration would have to rewrite all of them.
 */
export const normaliseSurfaces = (surfaces) => {
    if (!surfaces || typeof surfaces !== 'object') return {};
    if (!('F' in surfaces)) return surfaces;
    const { F, ...rest } = surfaces;
    const bIsSet = rest.B && rest.B !== 'none';
    return { ...rest, ...(bIsSet ? {} : { B: F }) };
};

/* ── Tooth names, written out ─────────────────────────────────────────────
   "UL" is a code you decode; "Upper Left" is a name you read. */

const QUADRANT_WORDS = {
    UR: 'Upper Right', UL: 'Upper Left', LL: 'Lower Left', LR: 'Lower Right',
};

export const TOOTH_NAMES_FULL = Object.fromEntries(
    Object.entries(TOOTH_NAMES).map(([num, name]) => {
        const [quadrant, ...rest] = name.split(' ');
        return [num, `${QUADRANT_WORDS[quadrant] || quadrant} ${rest.join(' ')}`];
    })
);

const PRIMARY_QUADRANT = { 5: 'Upper Right', 6: 'Upper Left', 7: 'Lower Left', 8: 'Lower Right' };
const PRIMARY_TYPE = { 1: 'Central Incisor', 2: 'Lateral Incisor', 3: 'Canine', 4: '1st Molar', 5: '2nd Molar' };

/** Full name for any tooth we can draw, permanent or primary. */
export const toothFullName = (tooth) => {
    const n = Number(tooth);
    if (TOOTH_NAMES_FULL[n]) return TOOTH_NAMES_FULL[n];
    if (n >= 51 && n <= 85) {
        const q = PRIMARY_QUADRANT[Math.floor(n / 10)];
        const t = PRIMARY_TYPE[n % 10];
        if (q && t) return `${q} Primary ${t}`;
    }
    return '';
};

/* ── Condition and work are two different questions ───────────────────────

   `status` mixed them: `planned` says WHEN, `implant` and `rootCanal` say
   WHAT, and being one list made them mutually exclusive. So "an implant is
   planned for this tooth" could not be recorded, and neither could "root canal
   done elsewhere, last year" as distinct from one we are about to do. Both are
   everyday charting.

   Condition is what the tooth IS. Work is what has been, or will be, done to
   it — `existing` is already in the mouth and bills nothing; `planned` goes on
   the treatment plan.

   Decay is deliberately NOT a condition: it is a finding, and findings have
   their own field. Two places to record the same fact is where they start to
   disagree.

   `status` is still written from these, so the chart, the Overview card, the
   summary PDF and the mobile app read exactly what they always did.
*/

/**
 * The exceptions only.
 *
 * There is no "Sound" button, and there should not be: a healthy tooth is the
 * absence of a mark, not a mark of its own. Charts have always worked that way
 * — an unmarked tooth is a normal tooth — and asking a doctor to affirm the
 * default on all 32 is asking 32 questions whose answer we already have.
 * `'sound'` is still the stored value; nothing writes it by hand.
 *
 * "Sound" was also the wrong word. It is the textbook term for an intact tooth
 * and means nothing to anyone who is not a dentist. Healthy is the word.
 */
export const TOOTH_CONDITIONS = [
    // Impacted leads because it is the one reached most often — a wisdom tooth
    // is the usual reason to touch this control at all. Order only: the default
    // is still no condition, which is a healthy tooth.
    { value: 'impacted', label: 'Impacted' },
    { value: 'missing', label: 'Missing / extracted' },
    // The chart has drawn a zigzag for `fractured` since long before this, and
    // STATUS_LABELS names it — but nothing could ever set it. Dead render code
    // in exactly the way the phantom 'F' surface was.
    { value: 'fractured', label: 'Fractured' },
];

/* ── Clinical conditions ───────────────────────────────────────────────────

   What the tooth HAS, grouped the way a dentist thinks about it. Several at
   once: a tooth can be eroded, sensitive and receding all together, which the
   single `condition` field above can never say.

   Four of these are not new facts, and are deliberately NOT stored twice:

     impacted, fractured, missing  -> `condition`   (they change how the tooth
                                                      is drawn, and exclude each
                                                      other: a tooth cannot be
                                                      both missing and impacted)
     periapical abscess            -> the `abscess` mark (a ring at the apex)

   Picking one of those here writes to where it already lives, so the chart,
   the summary PDF and every chart saved before this keep reading one record.
   Everything else goes in the tooth's own `conditions` list.

   Whole-mouth conditions (bruxism, malocclusion, anodontia) are offered too.
   They are recorded on the teeth they show on — select the teeth first to put
   one on several at once.

   `hint` is the plain-language line under each name, for the member of staff
   who is charting and is not a dentist.
*/
export const CONDITION_GROUPS = [
    {
        id: 'infection',
        label: 'Bacterial & infectious',
        items: [
            { value: 'caries', label: 'Dental caries', hint: 'Damage to enamel and dentin from plaque acids' },
            { value: 'pulpitis', label: 'Pulpitis', hint: 'Inflamed nerve and blood vessels, usually from deep decay' },
            { value: 'periapical_abscess', label: 'Periapical abscess', hint: 'Pus at the root tip from an advanced infection', mark: 'abscess' },
            { value: 'pericoronitis', label: 'Pericoronitis', hint: 'Inflamed gum around a partly erupted tooth' },
            { value: 'root_canal_infection', label: 'Root canal infection', hint: 'Bacteria in the deepest chamber of the tooth' },
        ],
    },
    {
        id: 'damage',
        label: 'Physical damage & wear',
        items: [
            { value: 'fractured', label: 'Cracked or fractured', hint: 'From surface craze lines to a split root', structural: 'fractured' },
            { value: 'erosion', label: 'Erosion', hint: 'Enamel dissolved by dietary acid or reflux' },
            { value: 'attrition', label: 'Attrition', hint: 'Biting surfaces worn by tooth-on-tooth contact' },
            { value: 'abrasion', label: 'Abrasion', hint: 'Wear from external friction, e.g. a hard brush' },
            { value: 'abfraction', label: 'Abfraction', hint: 'Micro-lesions at the gumline from flexing under load' },
            { value: 'bruxism', label: 'Bruxism', hint: 'Clenching or grinding, often in sleep' },
            { value: 'dental_trauma', label: 'Dental trauma', hint: 'Loosened, displaced or knocked out by an impact' },
        ],
    },
    {
        id: 'development',
        label: 'Alignment, growth & development',
        items: [
            { value: 'impacted', label: 'Impacted', hint: 'Trapped under the gum and unable to erupt', structural: 'impacted' },
            { value: 'malocclusion', label: 'Malocclusion', hint: 'Overbite, underbite, crossbite or crowding' },
            { value: 'hyperdontia', label: 'Hyperdontia', hint: 'An extra (supernumerary) tooth' },
            { value: 'hypodontia', label: 'Hypodontia / anodontia', hint: 'Congenitally absent — never formed, not extracted' },
            { value: 'fluorosis', label: 'Dental fluorosis', hint: 'Enamel marked by high fluoride in childhood' },
            { value: 'enamel_hypoplasia', label: 'Enamel hypoplasia', hint: 'Thin, weak or pitted enamel from birth' },
            { value: 'macro_microdontia', label: 'Macrodontia / microdontia', hint: 'Abnormally large or small tooth' },
        ],
    },
    {
        id: 'support',
        label: 'Gum & supporting structures',
        items: [
            { value: 'gingivitis', label: 'Gingivitis', hint: 'Reversible inflammation and bleeding of the gum margin' },
            { value: 'periodontitis', label: 'Periodontitis', hint: 'Infection destroying the bone and ligament' },
            { value: 'gingival_recession', label: 'Gingival recession', hint: 'Gum pulled back, exposing the root' },
            { value: 'tooth_mobility', label: 'Mobility', hint: 'Loose from trauma or bone loss' },
            { value: 'missing', label: 'Missing / extracted', hint: 'Tooth no longer present (edentulous space)', structural: 'missing' },
        ],
    },
    {
        id: 'nerve_aesthetic',
        label: 'Sensitivity & appearance',
        items: [
            { value: 'dentin_hypersensitivity', label: 'Dentin hypersensitivity', hint: 'Sharp pain to hot, cold, sweet or acid' },
            { value: 'intrinsic_discoloration', label: 'Intrinsic discoloration', hint: 'Internal staining from trauma, age or medicines' },
            { value: 'extrinsic_discoloration', label: 'Extrinsic discoloration', hint: 'Surface stain from food, drink or tobacco' },
            { value: 'root_resorption', label: 'Root resorption', hint: 'The body breaking down the tooth, inside or out' },
        ],
    },
];

export const CONDITION_ITEMS = CONDITION_GROUPS.flatMap((g) => g.items);

const CONDITION_BY_VALUE = Object.fromEntries(CONDITION_ITEMS.map((i) => [i.value, i]));

/** A stored condition value, as words. Unknown values come back as written. */
export const conditionLabel = (value) => CONDITION_BY_VALUE[value]?.label || value;

/** The tooth's own list. Anything not an array reads as empty. */
export const conditionsOf = (toothData = {}) =>
    Array.isArray(toothData.conditions) ? toothData.conditions : [];

/**
 * Every condition a tooth carries, from wherever each one is stored — the
 * structural state, the abscess mark and the list — as the picker's values.
 * One reader for all three, so nothing displays a condition the others miss.
 */
export const allConditionsOf = (toothData = {}) => {
    const out = [];
    const { condition } = readToothState(toothData);
    const structural = CONDITION_ITEMS.find((i) => i.structural && i.structural === condition);
    if (structural) out.push(structural.value);
    if (marksOf(toothData).includes('abscess')) out.push('periapical_abscess');
    conditionsOf(toothData).forEach((v) => { if (!out.includes(v)) out.push(v); });
    return out;
};

/**
 * What kind of work, and it is NOT the same list for both stages.
 *
 * Extraction can only ever be planned. Once it has happened the tooth is not
 * "a tooth with an existing extraction on it" — it is Missing, which is a
 * condition. Offering it as existing work invites a record that contradicts
 * itself: a tooth both present and extracted.
 */
const SHARED_WORK_TYPES = [
    { value: 'filling', label: 'Filling' },
    // Crowns are split by material because the standard chart draws each one
    // differently: gold hatched, porcelain outlined, stainless steel lettered.
    { value: 'crown_porcelain', label: 'Porcelain crown' },
    { value: 'crown_gold', label: 'Gold crown' },
    { value: 'crown_ss', label: 'Stainless steel crown' },
    { value: 'veneer', label: 'Veneer' },
    { value: 'bridge', label: 'Bridge' },
    { value: 'root_canal', label: 'Root canal' },
    { value: 'post_core', label: 'Post and core' },
    { value: 'implant', label: 'Implant' },
];

export const WORK_TYPES_BY_STAGE = {
    existing: SHARED_WORK_TYPES,
    planned: [...SHARED_WORK_TYPES, { value: 'extraction', label: 'Extraction' }],
};

/** Every type, for reading a stored value back regardless of stage. */
export const WORK_TYPES = WORK_TYPES_BY_STAGE.planned;

export const workTypeLabel = (value) =>
    WORK_TYPES.find((t) => t.value === value)?.label || '';

/**
 * Existing work, mapped to the symbol the chart actually draws for it.
 *
 * This used to be `workType === 'root_canal' ? 'rootCanal' : 'implant'`, which
 * meant a crown, a veneer, a bridge and a filling all rendered as an IMPLANT —
 * screw and all. A chart that draws a screw where the doctor recorded a crown
 * is not a slightly-wrong chart, it is a false record.
 *
 * Anything with no symbol of its own falls to the plain blue `existing` fill,
 * which says "work already here" without claiming which kind.
 */
const EXISTING_STATUS = {
    root_canal: 'rootCanal',
    post_core: 'post_core',
    implant: 'implant',
    crown_porcelain: 'crown_porcelain',
    crown_gold: 'crown_gold',
    crown_ss: 'crown_ss',
    veneer: 'veneer',
    bridge: 'bridge',
    filling: 'existing',
    // Legacy: 'crown' was one type before materials were split out.
    crown: 'crown_porcelain',
};

/** The legacy single status, derived. Never stored by hand. */
export const deriveStatus = ({ condition, work, workType } = {}) => {
    if (condition === 'missing') return 'missing';
    if (condition === 'impacted') return 'impacted';
    // Work outranks a fracture on purpose. Amber "there is work to do" is the
    // signal a doctor scans the chart for; once a crown is planned for the
    // fractured tooth, the plan is the more useful thing to see. The fracture
    // shows while it is still just an observation.
    // A tooth marked for extraction gets the diagonal line every paper chart
    // uses for it, rather than the same amber as any other planned work.
    if (work === 'planned' && workType === 'extraction') return 'to_extract';
    if (work === 'planned') return 'planned';
    if (work === 'existing') return EXISTING_STATUS[workType] || 'existing';
    if (condition === 'fractured') return 'fractured';
    return 'present';
};

/**
 * The two axes for a tooth, reconstructed from a legacy record when it has
 * only a `status`. Every chart saved before this existed still reads correctly.
 */
export const readToothState = (toothData = {}) => {
    if (toothData.condition || toothData.work) {
        return {
            condition: toothData.condition || 'sound',
            work: toothData.work || null,
            workType: toothData.workType || null,
        };
    }
    switch (toothData.status) {
        case 'missing':   return { condition: 'missing', work: null, workType: null };
        case 'impacted':  return { condition: 'impacted', work: null, workType: null };
        case 'fractured': return { condition: 'fractured', work: null, workType: null };
        case 'planned':   return { condition: 'sound', work: 'planned', workType: null };
        case 'implant':   return { condition: 'sound', work: 'existing', workType: 'implant' };
        case 'rootCanal': return { condition: 'sound', work: 'existing', workType: 'root_canal' };
        case 'to_extract': return { condition: 'sound', work: 'planned', workType: 'extraction' };
        case 'existing':   return { condition: 'sound', work: 'existing', workType: 'filling' };
        default: {
            // Every status that is simply the name of its work type.
            const type = Object.keys(EXISTING_STATUS)
                .find((k) => EXISTING_STATUS[k] === toothData.status && k !== 'crown');
            if (type) return { condition: 'sound', work: 'existing', workType: type };
            return { condition: 'sound', work: null, workType: null };
        }
    }
};

/**
 * Marks that coexist with everything else.
 *
 * A tooth can carry a crown AND a root canal AND an abscess at the same time,
 * and `status` can only ever say one thing. These are separate: they stack as
 * overlays on the chart and are stored as a list on the tooth.
 *
 * Diastema is held per side rather than as a gap between two teeth, so it fits
 * the per-tooth record and needs no new structure — it draws on that edge.
 */
export const TOOTH_MARKS = [
    { value: 'sealant', label: 'Sealant', hint: 'Drawn as S on the biting surface' },
    { value: 'abscess', label: 'Periapical abscess', hint: 'A ring at the root apex' },
    { value: 'drifting', label: 'Drifting', hint: 'An arrow showing which way it has moved' },
    { value: 'diastema_mesial', label: 'Diastema (mesial)', hint: 'A gap on the midline side' },
    { value: 'diastema_distal', label: 'Diastema (distal)', hint: 'A gap on the far side' },
];

export const marksOf = (toothData = {}) =>
    Array.isArray(toothData.marks) ? toothData.marks : [];

export const hasMark = (toothData, mark) => marksOf(toothData).includes(mark);

/* ── Walking the arch ─────────────────────────────────────────────────────
   Charting is sequential: you work along an arch. Upper right to upper left,
   then lower right to lower left, which is the order the chart draws them. */

/* The lower arch is REVERSED here relative to how it is drawn. Drawn order
   would send you from #16 — the far left of the upper arch on screen — clear
   across the mouth to #32 on the far right of the lower one. Reversed, #16
   hands over to #17 directly below it and you walk back the other way: the
   serpentine path a dentist actually charts, and the FDI quadrant order
   (1 -> 2 -> 3 -> 4) besides. */
export const FULL_MOUTH_ORDER = [...UNIVERSAL_UPPER, ...[...UNIVERSAL_LOWER].reverse()];

/** The next or previous tooth, or null at either end. No wrapping: arriving
 *  back at #1 after #17 would be a jump across the mouth, not a step. */
export const stepTooth = (tooth, delta) => {
    const i = FULL_MOUTH_ORDER.indexOf(Number(tooth));
    if (i === -1) return null;
    return FULL_MOUTH_ORDER[i + delta] ?? null;
};
