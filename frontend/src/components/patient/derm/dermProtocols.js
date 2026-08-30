/**
 * What she is treating, what to ask about it, and what the options are.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 *
 * The first version of this case paper put every vocabulary on screen at once:
 * fourteen morphologies, fifteen secondary changes, eighteen aggravating
 * factors, twenty-four investigations. About two hundred chips for a consult
 * that needs fifteen of them. That is a form, not a tool, and a form that long
 * gets filled in badly or not at all.
 *
 * A dermatology clinic sees the same dozen conditions all day. So the screen
 * starts from the condition and everything else follows: pick "Acne" and you
 * get the four questions acne actually needs, and a shortlist of treatments
 * that matches the grade you just chose. The full vocabulary is still there for
 * the undiagnosed rash, one section down, searchable.
 *
 * ── What the plan side is, and is not ────────────────────────────────────────
 *
 * `plan` is a SHORTLIST SHE PICKS FROM, not a recommendation engine and not a
 * prescription. Nothing here is auto-selected and nothing is auto-prescribed.
 * The value is that the twelve options worth considering for grade III acne are
 * on screen instead of the twenty-two procedures the clinic offers in total,
 * and each carries a one-line note saying where it sits.
 *
 * `safety` flags are the part that earns its keep. They are checks a busy
 * clinic can miss on a Friday evening, and every one of them is standard,
 * well-established, and phrased as "check this" rather than a block.
 *
 * ── Sources ──────────────────────────────────────────────────────────────────
 *
 *  Acne      AAD Guidelines of care for the management of acne vulgaris (2024)
 *            https://www.jaad.org/article/S0190-9622(23)03389-3/pdf
 *            Expert consensus on the management of acne in India
 *  Melasma   Evidence-Based Treatment for Melasma: Expert Opinion and a Review
 *            https://pmc.ncbi.nlm.nih.gov/articles/PMC4257945/
 *  AGA       AEDV Spanish Hair Disorders Group consensus on AGA management
 *            PRP for AGA: review of the literature and proposed protocol
 *            https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6374694/
 *  Isotret.  Standard Guidelines of Care: Performing Procedures in Patients on
 *            or Recently Administered with Isotretinoin (IADVL)
 *            plus the newer split-face trials revisiting the 6-month interval
 *
 * These are references for the clinician, not instructions to her. Doses are
 * deliberately absent except where a concentration IS the recommendation
 * (Kligman's formula), because a dose belongs on a prescription she writes.
 */

/* ── Assessment field types ───────────────────────────────────────────────────
 * Each condition declares only the handful of fields it needs. `one` is a
 * single choice, `many` is a multi-select, `score` is a number.
 */

export const CONDITIONS = [
  {
    id: 'acne',
    label: 'Acne',
    blurb: 'Comedonal to nodulocystic',
    assess: [
      {
        key: 'grade', type: 'one', label: 'Grade',
        options: [
          { value: 'I', label: 'I', hint: 'Comedonal' },
          { value: 'II', label: 'II', hint: 'Papular' },
          { value: 'III', label: 'III', hint: 'Pustular' },
          { value: 'IV', label: 'IV', hint: 'Nodulocystic' },
        ],
      },
      {
        key: 'lesions', type: 'many', label: 'Lesions present',
        options: ['Open comedones', 'Closed comedones', 'Papules', 'Pustules',
                  'Nodules', 'Cysts', 'Sinus tracts'],
      },
      {
        key: 'sites', type: 'many', label: 'Sites',
        options: ['Forehead', 'Cheeks', 'Nose', 'Chin and jawline', 'Chest', 'Upper back', 'Shoulders'],
      },
      {
        key: 'scarring', type: 'many', label: 'Scarring',
        options: ['None', 'Post-inflammatory erythema', 'PIH', 'Ice-pick',
                  'Boxcar', 'Rolling', 'Hypertrophic', 'Keloidal'],
      },
      {
        key: 'hormonal', type: 'many', label: 'Hormonal pointers',
        options: ['Jawline distribution', 'Premenstrual flare', 'Irregular cycles',
                  'Hirsutism', 'Weight gain', 'Known PCOS'],
      },
    ],
    plan: [
      { group: 'Topical', items: [
        { label: 'Benzoyl peroxide', note: 'Strongly recommended. Backbone, and limits antibiotic resistance' },
        { label: 'Topical retinoid (adapalene / tretinoin)', note: 'Strongly recommended for comedonal and maintenance', flags: ['pregnancy'] },
        { label: 'Fixed combination retinoid + BPO', note: 'Strongly recommended. Two mechanisms, one tube', flags: ['pregnancy'] },
        { label: 'Fixed combination antibiotic + BPO', note: 'Strongly recommended. Never antibiotic alone' },
        { label: 'Azelaic acid', note: 'Conditional. Useful when there is PIH as well' },
        { label: 'Clascoterone', note: 'Conditional. Topical anti-androgen' },
        { label: 'Salicylic acid', note: 'Conditional' },
      ]},
      { group: 'Oral', items: [
        { label: 'Doxycycline', note: 'Strongly recommended systemic. Always with topical BPO', flags: ['pregnancy'] },
        { label: 'Minocycline / sarecycline', note: 'Conditional alternative tetracycline', flags: ['pregnancy'] },
        { label: 'Combined oral contraceptive', note: 'Conditional. For hormonal patterns in women' },
        { label: 'Spironolactone', note: 'Conditional. Hormonal acne in women', flags: ['pregnancy'] },
        { label: 'Oral isotretinoin', note: 'Strongly recommended for severe, scarring, or failed standard therapy', flags: ['pregnancy', 'isotretinoin'] },
      ]},
      { group: 'Procedural', items: [
        { label: 'Comedone extraction', note: 'Adjunct for comedonal disease' },
        { label: 'Intralesional steroid', note: 'Good practice for large painful nodules' },
        { label: 'Chemical peel (salicylic / glycolic)', note: 'Adjunct, and helps the PIH', flags: ['darkskin'] },
        { label: 'Microneedling for scars', note: 'After the active disease is controlled', flags: ['isotretinoin'] },
        { label: 'Fractional CO2 for scars', note: 'Atrophic scarring, once quiescent', flags: ['isotretinoin', 'darkskin'] },
      ]},
    ],
  },

  {
    id: 'melasma',
    label: 'Melasma',
    blurb: 'Symmetrical facial pigmentation',
    assess: [
      {
        key: 'pattern', type: 'one', label: 'Pattern',
        options: ['Centrofacial', 'Malar', 'Mandibular', 'Extrafacial'],
      },
      {
        key: 'depth', type: 'one', label: 'Depth on Wood’s lamp',
        options: [
          { value: 'epidermal', label: 'Epidermal', hint: 'Enhances — responds best' },
          { value: 'dermal', label: 'Dermal', hint: 'No enhancement — stubborn' },
          { value: 'mixed', label: 'Mixed', hint: 'Partial enhancement' },
        ],
      },
      { key: 'masi', type: 'score', label: 'MASI', hint: '0 to 48. Record it every visit or it tells you nothing', max: 48 },
      {
        key: 'triggers', type: 'many', label: 'Triggers',
        options: ['Sun exposure', 'Pregnancy', 'Oral contraceptive', 'Thyroid disorder',
                  'Cosmetics', 'Heat exposure', 'Family history'],
      },
    ],
    plan: [
      { group: 'First line', items: [
        { label: 'Broad-spectrum sunscreen SPF 30+ with ZnO / TiO2', note: 'Not optional. Everything else fails without it' },
        { label: 'Modified Kligman’s (HQ 2–4% + tretinoin 0.05% + fluocinolone 0.01%)', note: 'First line for up to 12 weeks', flags: ['pregnancy'] },
        { label: 'Hydroquinone 2–4%', note: 'Keep to 2–4% in darker skin; avoid 5%', flags: ['pregnancy', 'darkskin'] },
        { label: 'Azelaic acid', note: 'Non-HQ alternative, safe in pregnancy' },
        { label: 'Kojic acid', note: 'Non-HQ alternative' },
      ]},
      { group: 'Second line', items: [
        { label: 'Glycolic acid peel 20–35%', note: 'Series of sessions. Start low in darker skin', flags: ['darkskin'] },
        { label: 'Salicylic acid peel 20–30%', note: 'Alternative superficial peel', flags: ['darkskin'] },
        { label: 'Oral tranexamic acid', note: 'Adjunct. Screen for thrombotic risk first' },
        { label: 'Topical tranexamic acid', note: 'Adjunct' },
      ]},
      { group: 'Third line', items: [
        { label: 'Low-fluence Q-switched Nd:YAG (laser toning)', note: 'Last resort. Unpredictable, relapses often', flags: ['darkskin'] },
        { label: 'Fractional non-ablative laser', note: 'Last resort' },
      ]},
      { group: 'Maintenance', items: [
        { label: 'Intermittent triple combination, twice weekly or less', note: 'Melasma relapses. Plan maintenance from day one' },
        { label: 'Non-HQ maintenance product', note: 'For long-term use between courses' },
        { label: 'Monthly review', note: 'Compliance, tolerance and MASI' },
      ]},
    ],
  },

  {
    id: 'aga',
    label: 'Pattern hair loss',
    blurb: 'Androgenetic alopecia',
    hair: true,
    assess: [
      {
        key: 'scale', type: 'one', label: 'Staging scale',
        options: [
          { value: 'norwood', label: 'Norwood-Hamilton', hint: 'Male pattern' },
          { value: 'ludwig', label: 'Ludwig', hint: 'Female pattern' },
        ],
      },
      {
        key: 'trichoscopy', type: 'many', label: 'Trichoscopy',
        options: ['Miniaturised hairs', 'Anisotrichosis', 'Peripilar sign',
                  'Yellow dots', 'Reduced density', 'Single-hair units'],
      },
      {
        key: 'workup', type: 'many', label: 'Worth excluding',
        options: ['Iron deficiency', 'Thyroid disorder', 'Vitamin D deficiency',
                  'Vitamin B12 deficiency', 'PCOS', 'Recent illness or surgery'],
      },
    ],
    plan: [
      { group: 'First line', items: [
        { label: 'Topical minoxidil', note: 'One of only two approved treatments. Expect 6 months before judging' },
        { label: 'Oral finasteride', note: 'Approved for male pattern loss', flags: ['pregnancy', 'finasteride'] },
        { label: 'Topical finasteride', note: 'Lower systemic exposure than oral', flags: ['pregnancy', 'finasteride'] },
        { label: 'Minoxidil + finasteride combination', note: 'Meta-analysis favours combination over either alone', flags: ['pregnancy', 'finasteride'] },
      ]},
      { group: 'Second line', items: [
        { label: 'PRP, monthly induction then maintenance', note: 'Widely used adjunct; protocols are still not standardised' },
        { label: 'GFC', note: 'Adjunct' },
        { label: 'Microneedling with minoxidil', note: 'Adjunct, better than minoxidil alone in trials' },
        { label: 'Dutasteride mesotherapy', note: 'Second line in both sexes', flags: ['pregnancy', 'finasteride'] },
        { label: 'Oral bicalutamide', note: 'Second line, female AGA', flags: ['pregnancy'] },
        { label: 'Low-level light therapy', note: 'Adjunct' },
      ]},
      { group: 'Definitive', items: [
        { label: 'Hair transplant consultation', note: 'Once medical therapy has stabilised the loss' },
      ]},
      { group: 'Counselling', items: [
        { label: 'Treatment is long-term, stopping reverses gains', note: 'Say it at visit one or they stop at month three' },
        { label: 'Baseline photographs', note: 'The only honest way to show progress later' },
      ]},
    ],
  },

  {
    id: 'telogen_effluvium',
    label: 'Telogen effluvium',
    blurb: 'Diffuse shedding',
    hair: true,
    assess: [
      {
        key: 'trigger', type: 'many', label: 'Possible trigger, 2 to 4 months back',
        options: ['Fever or infection', 'Surgery', 'Childbirth', 'Crash diet',
                  'Major stress', 'New medication', 'Weight loss', 'Anaemia', 'Thyroid'],
      },
      { key: 'duration_months', type: 'score', label: 'Shedding for', hint: 'Months. Over 6 is chronic', max: 120 },
      {
        key: 'workup', type: 'many', label: 'Bloods',
        options: ['CBC', 'Serum ferritin', 'Thyroid profile', 'Vitamin D', 'Vitamin B12', 'ANA'],
      },
    ],
    plan: [
      { group: 'Address the cause', items: [
        { label: 'Correct iron deficiency', note: 'Ferritin is the one that matters, not just haemoglobin' },
        { label: 'Correct thyroid abnormality', note: '' },
        { label: 'Correct vitamin D / B12', note: '' },
        { label: 'Review causative medication', note: '' },
      ]},
      { group: 'Supportive', items: [
        { label: 'Topical minoxidil', note: 'Shortens the shed in chronic cases' },
        { label: 'Nutritional supplementation', note: 'Where a deficiency is documented' },
        { label: 'Reassurance and a timeline', note: 'Acute TE regrows. Saying so is the treatment' },
      ]},
    ],
  },

  {
    id: 'tinea',
    label: 'Tinea',
    blurb: 'Dermatophyte infection',
    assess: [
      {
        key: 'sites', type: 'many', label: 'Sites',
        options: ['Groin', 'Trunk', 'Face', 'Feet', 'Hands', 'Scalp', 'Nails', 'Extensive'],
      },
      {
        key: 'modified', type: 'one', label: 'Steroid modified?',
        options: [
          { value: 'yes', label: 'Yes', hint: 'Loss of scale, wide ill-defined edge' },
          { value: 'no', label: 'No', hint: 'Classic annular scaly plaque' },
        ],
      },
      {
        key: 'features', type: 'many', label: 'Features',
        options: ['Recurrent', 'Family members affected', 'Previous antifungal course',
                  'KOH positive', 'Extensive body surface'],
      },
    ],
    plan: [
      { group: 'Essential', items: [
        { label: 'Stop all topical steroid and combination creams', note: 'The single most important instruction. Warn about the rebound flare' },
        { label: 'Confirm with KOH mount', note: 'Especially if steroid modified' },
      ]},
      { group: 'Treatment', items: [
        { label: 'Topical antifungal, continue 2 weeks past clearance', note: 'Stopping at clearance is why it comes back' },
        { label: 'Oral antifungal', note: 'Extensive, recurrent, or steroid-modified disease' },
        { label: 'Treat all affected family members together', note: 'Otherwise it just circulates' },
      ]},
      { group: 'Advice', items: [
        { label: 'Hot wash and iron clothing, do not share towels', note: '' },
        { label: 'Keep the area dry, loose cotton clothing', note: '' },
        { label: 'Full course even after it looks clear', note: '' },
      ]},
    ],
  },

  {
    id: 'eczema',
    label: 'Eczema',
    blurb: 'Atopic and contact dermatitis',
    assess: [
      {
        key: 'type', type: 'one', label: 'Type',
        options: ['Atopic', 'Contact irritant', 'Contact allergic', 'Nummular', 'Seborrhoeic', 'Hand eczema'],
      },
      {
        key: 'distribution', type: 'many', label: 'Distribution',
        options: ['Flexural', 'Extensor', 'Face', 'Hands', 'Feet', 'Scalp', 'Generalised'],
      },
      { key: 'scorad', type: 'score', label: 'SCORAD', hint: '0 to 103', max: 103 },
      {
        key: 'atopy', type: 'many', label: 'Atopic background',
        options: ['Asthma', 'Allergic rhinitis', 'Food allergy', 'Family history of atopy'],
      },
    ],
    plan: [
      { group: 'Foundation', items: [
        { label: 'Liberal emollient, several times daily', note: 'The part that actually changes the course' },
        { label: 'Soap substitute, lukewarm short showers', note: '' },
        { label: 'Identify and remove the irritant or allergen', note: 'Patch test where contact allergy is suspected' },
      ]},
      { group: 'Anti-inflammatory', items: [
        { label: 'Topical corticosteroid, potency matched to site', note: 'Mild on the face and flexures' },
        { label: 'Topical calcineurin inhibitor', note: 'Face, eyelids, and steroid-sparing maintenance' },
        { label: 'Proactive twice-weekly application to usual sites', note: 'Reduces flares between episodes' },
      ]},
      { group: 'Escalation', items: [
        { label: 'Oral antihistamine for sleep', note: 'Helps the scratching, not the eczema' },
        { label: 'Short oral steroid course', note: 'Severe flare only. Expect rebound' },
        { label: 'Phototherapy (NBUVB)', note: 'Extensive or refractory disease' },
        { label: 'Systemic immunomodulator referral', note: 'Refractory disease' },
      ]},
    ],
  },

  {
    id: 'psoriasis',
    label: 'Psoriasis',
    blurb: 'Plaque and variants',
    assess: [
      {
        key: 'type', type: 'one', label: 'Type',
        options: ['Chronic plaque', 'Guttate', 'Scalp', 'Palmoplantar', 'Inverse', 'Pustular', 'Erythrodermic'],
      },
      { key: 'pasi', type: 'score', label: 'PASI', hint: '0 to 72', max: 72 },
      { key: 'bsa', type: 'score', label: 'BSA %', hint: 'Body surface area involved', max: 100 },
      {
        key: 'associations', type: 'many', label: 'Look for',
        options: ['Joint pain', 'Nail pitting', 'Onycholysis', 'Metabolic syndrome',
                  'Koebner phenomenon', 'Recent streptococcal infection'],
      },
    ],
    plan: [
      { group: 'Topical', items: [
        { label: 'Potent topical corticosteroid', note: 'Mainstay for limited disease' },
        { label: 'Vitamin D analogue', note: 'Steroid-sparing, good in combination' },
        { label: 'Steroid + vitamin D fixed combination', note: '' },
        { label: 'Coal tar', note: '' },
        { label: 'Salicylic acid for descaling', note: 'Before anything else can penetrate thick plaques' },
        { label: 'Emollient', note: '' },
      ]},
      { group: 'Escalation', items: [
        { label: 'Phototherapy (NBUVB)', note: 'Extensive disease' },
        { label: 'Methotrexate', note: 'Systemic. Baseline and monitoring bloods', flags: ['pregnancy'] },
        { label: 'Biologic referral', note: 'Refractory or psoriatic arthritis' },
      ]},
      { group: 'Counselling', items: [
        { label: 'Chronic and relapsing, controllable not curable', note: 'Sets expectations that stop doctor-shopping' },
        { label: 'Screen for joint symptoms at every visit', note: 'Early arthritis changes management' },
      ]},
    ],
  },

  {
    id: 'vitiligo',
    label: 'Vitiligo',
    blurb: 'Depigmentation',
    assess: [
      {
        key: 'type', type: 'one', label: 'Type',
        options: ['Focal', 'Segmental', 'Generalised', 'Acrofacial', 'Universal'],
      },
      {
        key: 'activity', type: 'one', label: 'Activity',
        options: [
          { value: 'stable', label: 'Stable', hint: 'No new lesions 6 months' },
          { value: 'active', label: 'Active', hint: 'Spreading' },
        ],
      },
      { key: 'vasi', type: 'score', label: 'VASI', hint: '0 to 100', max: 100 },
      {
        key: 'associations', type: 'many', label: 'Screen for',
        options: ['Thyroid disorder', 'Diabetes', 'Pernicious anaemia', 'Alopecia areata', 'Family history'],
      },
    ],
    plan: [
      { group: 'Topical', items: [
        { label: 'Topical corticosteroid', note: 'Limited disease, non-facial' },
        { label: 'Topical calcineurin inhibitor', note: 'Face and thin skin' },
      ]},
      { group: 'Phototherapy', items: [
        { label: 'NBUVB', note: 'Mainstay for generalised or spreading disease' },
        { label: 'Targeted phototherapy', note: 'Few localised patches' },
      ]},
      { group: 'Other', items: [
        { label: 'Oral mini-pulse steroid', note: 'To arrest rapidly spreading disease' },
        { label: 'Surgical grafting', note: 'Stable disease only. Not while it is spreading' },
        { label: 'Camouflage and sun protection', note: 'Depigmented skin burns' },
        { label: 'Thyroid screen', note: 'Association is common enough to be routine' },
      ]},
    ],
  },

  {
    id: 'pih',
    label: 'PIH',
    blurb: 'Post-inflammatory hyperpigmentation',
    assess: [
      {
        key: 'cause', type: 'many', label: 'Following',
        options: ['Acne', 'Eczema', 'Trauma', 'Insect bite', 'Procedure', 'Drug reaction', 'Infection'],
      },
      {
        key: 'depth', type: 'one', label: 'Depth',
        options: ['Epidermal', 'Dermal', 'Mixed'],
      },
    ],
    plan: [
      { group: 'Essential', items: [
        { label: 'Treat the underlying inflammation first', note: 'Pigment keeps forming while the cause is active' },
        { label: 'Broad-spectrum sunscreen', note: 'Sun deepens and prolongs it' },
      ]},
      { group: 'Lightening', items: [
        { label: 'Azelaic acid', note: 'Good first choice, safe in pregnancy' },
        { label: 'Topical retinoid', note: 'Speeds epidermal turnover', flags: ['pregnancy'] },
        { label: 'Hydroquinone, short course', note: 'Epidermal PIH', flags: ['pregnancy', 'darkskin'] },
        { label: 'Niacinamide', note: 'Gentle adjunct' },
        { label: 'Superficial chemical peel', note: 'Only once the inflammation has settled', flags: ['darkskin'] },
      ]},
      { group: 'Counselling', items: [
        { label: 'Epidermal PIH takes months, dermal takes longer', note: 'A timeline prevents the third opinion' },
      ]},
    ],
  },

  {
    id: 'urticaria',
    label: 'Urticaria',
    blurb: 'Wheals and angioedema',
    assess: [
      {
        key: 'duration', type: 'one', label: 'Duration',
        options: [
          { value: 'acute', label: 'Acute', hint: 'Under 6 weeks' },
          { value: 'chronic', label: 'Chronic', hint: '6 weeks or more' },
        ],
      },
      {
        key: 'features', type: 'many', label: 'Features',
        options: ['Angioedema', 'Individual wheals over 24 hours', 'Bruising on resolution',
                  'Physical trigger', 'Night-time predominance', 'Systemic symptoms'],
      },
      {
        key: 'triggers', type: 'many', label: 'Suspected triggers',
        options: ['Food', 'Drug', 'Infection', 'Pressure', 'Cold', 'Heat', 'Sunlight', 'Stress', 'None identified'],
      },
    ],
    plan: [
      { group: 'Treatment', items: [
        { label: 'Second-generation antihistamine, standard dose', note: 'First line' },
        { label: 'Updose antihistamine up to fourfold', note: 'Standard next step if not controlled' },
        { label: 'Add a second antihistamine', note: '' },
        { label: 'Short oral steroid for severe flare', note: 'Not for maintenance' },
        { label: 'Omalizumab referral', note: 'Refractory chronic urticaria' },
      ]},
      { group: 'Red flags', items: [
        { label: 'Wheals lasting over 24 hours or bruising — consider urticarial vasculitis', note: 'Different disease, needs a biopsy' },
        { label: 'Airway involvement — emergency plan and adrenaline', note: '' },
      ]},
      { group: 'Advice', items: [
        { label: 'Avoid NSAIDs and identified triggers', note: '' },
        { label: 'Symptom and trigger diary', note: 'Often the only way the trigger emerges' },
      ]},
    ],
  },

  {
    id: 'warts',
    label: 'Warts and molluscum',
    blurb: 'Viral',
    assess: [
      {
        key: 'type', type: 'one', label: 'Type',
        options: ['Common wart', 'Plane wart', 'Palmoplantar', 'Filiform', 'Genital', 'Molluscum'],
      },
      {
        key: 'sites', type: 'many', label: 'Sites',
        options: ['Hands', 'Feet', 'Face', 'Neck', 'Trunk', 'Genital', 'Periungual'],
      },
      { key: 'count', type: 'score', label: 'Approximate count', max: 500 },
    ],
    plan: [
      { group: 'Destructive', items: [
        { label: 'Cryotherapy', note: 'Repeat every 2 to 3 weeks' },
        { label: 'Electrocautery / RF cautery', note: '' },
        { label: 'Chemical cautery', note: '' },
        { label: 'Curettage for molluscum', note: '' },
      ]},
      { group: 'Topical', items: [
        { label: 'Salicylic acid', note: 'Slow but useful at home between sessions' },
        { label: 'Imiquimod', note: '' },
      ]},
      { group: 'Advice', items: [
        { label: 'Do not shave over or pick lesions', note: 'Autoinoculation is how it spreads' },
        { label: 'Several sessions are usual', note: 'Expectation-setting prevents disappointment' },
      ]},
    ],
  },

  {
    id: 'rosacea',
    label: 'Rosacea',
    blurb: 'Flushing and papulopustules',
    assess: [
      {
        key: 'subtype', type: 'many', label: 'Subtype',
        options: ['Erythematotelangiectatic', 'Papulopustular', 'Phymatous', 'Ocular'],
      },
      {
        key: 'triggers', type: 'many', label: 'Triggers',
        options: ['Sun', 'Heat', 'Spicy food', 'Alcohol', 'Hot drinks', 'Stress',
                  'Topical steroid use', 'Cosmetics'],
      },
    ],
    plan: [
      { group: 'Topical', items: [
        { label: 'Metronidazole', note: '' },
        { label: 'Ivermectin', note: '' },
        { label: 'Azelaic acid', note: '' },
        { label: 'Brimonidine for erythema', note: '' },
      ]},
      { group: 'Oral', items: [
        { label: 'Doxycycline', note: 'Papulopustular disease', flags: ['pregnancy'] },
        { label: 'Oral isotretinoin, low dose', note: 'Refractory disease', flags: ['pregnancy', 'isotretinoin'] },
      ]},
      { group: 'Other', items: [
        { label: 'Vascular laser or IPL for telangiectasia', note: '' },
        { label: 'Stop all topical steroids', note: 'Steroid use worsens and perpetuates it' },
        { label: 'Daily sunscreen and trigger avoidance', note: '' },
      ]},
    ],
  },
];

export const CONDITIONS_BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c]));

/* ── Safety rails ─────────────────────────────────────────────────────────────
 *
 * These read the patient factors already captured elsewhere on the case paper
 * and fire against the treatments she has actually selected. They are checks,
 * not blocks: the clinician decides, the screen makes sure she decided rather
 * than forgot.
 */

export const SAFETY_RULES = [
  {
    id: 'pregnancy',
    severity: 'high',
    applies: ({ menstrualStatus }) => ['Pregnant', 'Lactating'].includes(menstrualStatus),
    title: 'Pregnant or lactating',
    body: 'Oral isotretinoin is absolutely contraindicated. Topical retinoids, hydroquinone, tetracyclines, spironolactone and finasteride are all normally avoided. Azelaic acid is the usual safe substitute.',
  },
  {
    id: 'finasteride',
    severity: 'high',
    applies: ({ menstrualStatus }) =>
      ['Regular cycles', 'Irregular cycles', 'PCOS diagnosed'].includes(menstrualStatus),
    title: 'Woman of childbearing potential',
    body: 'Finasteride and dutasteride are teratogenic. Contraception and counselling are required, and the tablets must not be handled if crushed or broken.',
  },
  {
    id: 'isotretinoin',
    severity: 'medium',
    applies: ({ pastTreatments }) => (pastTreatments || []).includes('Oral isotretinoin'),
    title: 'On or recently on isotretinoin',
    body: 'The traditional advice is to wait 6 months before ablative resurfacing or dermabrasion. Newer split-face trials question that interval for non-ablative and fractional devices, so judge by device and depth rather than by the calendar alone.',
  },
  {
    id: 'darkskin',
    severity: 'medium',
    applies: ({ fitzpatrick }) => ['IV', 'V', 'VI'].includes(fitzpatrick),
    title: `Fitzpatrick ${'IV–VI'} — high PIH risk`,
    body: 'Keep hydroquinone to 2–4%. Avoid medium-depth and deep peels and ablative lasers. Start peels at the lowest strength, use low-fluence settings, and test patch before a first laser session.',
  },
  {
    id: 'steroidmisuse',
    severity: 'medium',
    applies: ({ pastTreatments }) =>
      (pastTreatments || []).includes('Topical steroid (self-prescribed)'),
    title: 'Self-prescribed topical steroid',
    body: 'Consider steroid-modified tinea, steroid-induced rosacea and topical steroid dependence. Stop the steroid, warn about the rebound flare, and confirm with a KOH mount where the picture fits tinea.',
  },
];

/** The safety flags that fire for this patient, given what she has selected. */
export function activeSafetyFlags(context) {
  return SAFETY_RULES.filter((rule) => {
    try { return rule.applies(context); } catch { return false; }
  });
}

/**
 * A treatment carries `flags`; a patient triggers rules. The overlap is what
 * gets a warning marker next to that specific option.
 */
export function warningsFor(item, activeFlagIds) {
  return (item.flags || []).filter((f) => activeFlagIds.includes(f));
}

/* ── Session scheduling ───────────────────────────────────────────────────────
 * Typical intervals, so picking a procedure can propose a course rather than a
 * single appointment. Editable — these are starting points, not protocol.
 */
export const SESSION_DEFAULTS = {
  'Chemical peel': { sessions: 6, intervalDays: 21 },
  'Chemical peel (salicylic / glycolic)': { sessions: 6, intervalDays: 21 },
  'Glycolic acid peel 20–35%': { sessions: 6, intervalDays: 21 },
  'Salicylic acid peel 20–30%': { sessions: 6, intervalDays: 21 },
  'Superficial chemical peel': { sessions: 4, intervalDays: 21 },
  'Low-fluence Q-switched Nd:YAG (laser toning)': { sessions: 6, intervalDays: 14 },
  'Fractional non-ablative laser': { sessions: 4, intervalDays: 28 },
  'Fractional CO2 for scars': { sessions: 3, intervalDays: 42 },
  'Microneedling for scars': { sessions: 4, intervalDays: 28 },
  'Microneedling with minoxidil': { sessions: 6, intervalDays: 21 },
  'PRP, monthly induction then maintenance': { sessions: 4, intervalDays: 30 },
  GFC: { sessions: 3, intervalDays: 30 },
  Cryotherapy: { sessions: 4, intervalDays: 21 },
  'NBUVB': { sessions: 24, intervalDays: 3 },
  'Phototherapy (NBUVB)': { sessions: 24, intervalDays: 3 },
  'Targeted phototherapy': { sessions: 12, intervalDays: 7 },
  'Vascular laser or IPL for telangiectasia': { sessions: 3, intervalDays: 28 },
};

export function sessionDefaultFor(label) {
  return SESSION_DEFAULTS[label] || null;
}
