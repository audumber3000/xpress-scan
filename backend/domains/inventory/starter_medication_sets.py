"""The prescription sets every clinic starts with.

One set per procedure a general dental practice does often enough that retyping
the same three drugs after it is how typos reach patient records. Seeded into
each clinic on first use (see seed_medication_groups), after which they are the
clinic's own rows: edit them, rename them, delete them.

─── ⚠ These are a starting point, not a protocol ─────────────────────────

Common adult doses, written the way Indian dental practice usually writes them,
and nothing here is applied automatically — medication_groups.py keeps the rule
that a set only ever fills the prescription form for the doctor to review.
Allergies, age, pregnancy, kidney and liver function all change what is safe,
and none of that is known to a template.

A dentist should read every set before this reaches clinics. Specific choices
worth a second look are called out in the notes below rather than buried.

─── Names are load-bearing ────────────────────────────────────────────────

Seeding and the "Add the common sets" button both match on NAME to avoid
duplicates. Five of these names were shipped before and are already in some
clinics' lists. Renaming one here would hand those clinics a second, near-
identical set beside the one they already have. Change the contents freely;
change a name only knowing that.

─── Changes to the five sets that shipped before ──────────────────────────

  * Amoxicillin 500mg was 1-0-1 (twice a day). 500mg is a three-times-a-day
    dose; twice a day is the 875mg regimen. Now 1-1-1, quantity 15.
  * Chlorhexidine 0.2% was 0-1-0 (once a day). It is used twice a day. Now 1-0-1.
  * "Ulcers and soreness" used Candid Mouth Paint, which is clotrimazole: an
    antifungal, for thrush, not for ulcers. It now uses a choline salicylate
    ulcer gel, and clotrimazole has its own "Oral thrush" set, which is where
    it belongs.

Clinics that already installed the old versions keep their own copies — those
are their rows. Only clinics seeded from here on get these.
"""

# Repeated lines, written once so a correction lands everywhere it applies.
_AMOX = {"medicine_name": "Amoxicillin 500mg", "dosage": "1-1-1", "duration": "5 days",
         "quantity": "15", "notes": "After food. Finish the course even once you feel better."}
_PARA = {"medicine_name": "Paracetamol 650mg", "dosage": "1-1-1", "duration": "3 days",
         "quantity": "9", "notes": "For pain, after food"}
_PARA_SOS = {"medicine_name": "Paracetamol 650mg", "dosage": "SOS", "duration": "3 days",
             "quantity": "6", "notes": "Only if needed, at least 4 hours apart"}
_IBU = {"medicine_name": "Ibuprofen 400mg", "dosage": "1-1-1", "duration": "3 days",
        "quantity": "9", "notes": "After food. Not if you have asthma, a stomach ulcer, or are pregnant."}
_ACE_PARA = {"medicine_name": "Aceclofenac 100mg + Paracetamol 325mg", "dosage": "1-0-1",
             "duration": "3 days", "quantity": "6",
             "notes": "After food. Not if you have asthma or a stomach ulcer."}
_PPI = {"medicine_name": "Pantoprazole 40mg", "dosage": "1-0-0", "duration": "5 days",
        "quantity": "5", "notes": "Before breakfast, protects the stomach"}
_METRO = {"medicine_name": "Metronidazole 400mg", "dosage": "1-1-1", "duration": "5 days",
          "quantity": "15", "notes": "After food. No alcohol while taking this, or for 2 days after."}
_CHX = {"medicine_name": "Chlorhexidine 0.2% mouthwash", "dosage": "1-0-1", "duration": "7 days",
        "quantity": "1", "notes": "10 ml, rinse 30 seconds, do not swallow. Start the day after."}
_CHX_14 = dict(_CHX, duration="14 days",
               notes="10 ml, rinse gently for 30 seconds. Start the day after surgery.")
_ULCER_GEL = {"medicine_name": "Choline salicylate + benzalkonium gel", "dosage": "SOS",
              "duration": "5 days", "quantity": "1",
              "notes": "Apply a small amount on the sore spot before meals and at bedtime"}


STARTER_SETS = [
    # ── Extractions ─────────────────────────────────────────────────────────
    {
        "name": "After extraction",
        "description": "Routine cover after a simple extraction",
        "audience": "adult",
        "items": [_AMOX, _PARA, _CHX],
    },
    {
        "name": "After surgical extraction",
        "description": "Wisdom teeth and other surgical removals",
        "audience": "adult",
        "items": [
            {"medicine_name": "Amoxicillin + Clavulanic acid 625mg", "dosage": "1-0-1",
             "duration": "5 days", "quantity": "10", "notes": "After food"},
            _ACE_PARA, _PPI, _CHX,
        ],
    },
    {
        # Azithromycin is the common penicillin-allergy choice in Indian dental
        # practice. Clindamycin is the other usual option; it was not chosen
        # because of its higher risk of C. difficile colitis.
        "name": "After extraction, penicillin allergy",
        "description": "For patients who cannot take amoxicillin",
        "audience": "adult",
        "items": [
            {"medicine_name": "Azithromycin 500mg", "dosage": "1-0-0", "duration": "3 days",
             "quantity": "3", "notes": "One hour before or two hours after food"},
            _PARA, _CHX,
        ],
    },
    {
        "name": "Dry socket",
        "description": "Pain relief after the socket has been dressed in the clinic",
        "audience": "adult",
        "items": [
            _IBU,
            dict(_PARA_SOS, notes="Between ibuprofen doses if the pain breaks through"),
            dict(_CHX, notes="Rinse gently. Come back if the pain is no better after 2 days."),
        ],
    },

    # ── Root canal ──────────────────────────────────────────────────────────
    {
        # Kept with its antibiotic because that is how this set shipped and it
        # reflects a common practice. Worth a dentist's view: antibiotics are
        # not generally indicated for pulpitis pain without signs of spread.
        "name": "Root canal, between visits",
        "description": "Pain relief and cover while the canal is open",
        "audience": "adult",
        "items": [
            _AMOX,
            {"medicine_name": "Ibuprofen 400mg", "dosage": "1-0-1", "duration": "3 days",
             "quantity": "6", "notes": "After food. Stop if there is stomach discomfort."},
            dict(_PPI, duration="3 days", quantity="3"),
        ],
    },
    {
        "name": "After root canal treatment",
        "description": "Once the canal has been filled",
        "audience": "adult",
        "items": [
            {"medicine_name": "Ibuprofen 400mg", "dosage": "1-0-1", "duration": "2 days",
             "quantity": "4", "notes": "After food, only if the tooth is tender when biting"},
            dict(_PARA_SOS, duration="2 days", quantity="4"),
        ],
    },

    # ── Gums and cleaning ───────────────────────────────────────────────────
    {
        "name": "After scaling and cleaning",
        "description": "Soreness and sensitivity after a cleaning",
        "audience": "adult",
        "items": [
            dict(_CHX, notes="10 ml, rinse 30 seconds. Nothing to eat or drink for 30 minutes after."),
            {"medicine_name": "Potassium nitrate 5% toothpaste", "dosage": "1-0-1",
             "duration": "4 weeks", "quantity": "1",
             "notes": "Brush twice a day if teeth feel sensitive. Spit, do not rinse."},
            dict(_PARA_SOS, duration="2 days", quantity="4", notes="Only if the gums are sore"),
        ],
    },
    {
        "name": "Tooth sensitivity",
        "description": "Sensitivity to cold, sweet or brushing",
        "audience": "adult",
        "items": [
            {"medicine_name": "Potassium nitrate 5% + sodium fluoride toothpaste",
             "dosage": "1-0-1", "duration": "8 weeks", "quantity": "1",
             "notes": "Brush twice a day. Spit, do not rinse, so it keeps working."},
        ],
    },
    {
        "name": "Gum infection",
        "description": "Localised periodontal infection",
        "audience": "adult",
        "items": [_AMOX, _METRO, dict(_CHX, duration="10 days", notes="Rinse 30 seconds")],
    },
    {
        "name": "After periodontal surgery",
        "description": "Flap surgery, grafts and crown lengthening",
        "audience": "adult",
        "items": [
            _AMOX, _ACE_PARA, dict(_PPI, duration="3 days", quantity="3"),
            dict(_CHX_14, notes="Start the day after surgery. Do not brush the area until told."),
        ],
    },

    # ── Infection ───────────────────────────────────────────────────────────
    {
        # Amoxicillin with metronidazole is the classic combination. Worth
        # stating in the set itself: without drainage, antibiotics alone do not
        # resolve an abscess.
        "name": "Dental abscess",
        "description": "Antibiotics support drainage, they do not replace it",
        "audience": "adult",
        "items": [_AMOX, _METRO, _IBU, _PPI],
    },
    {
        "name": "Pericoronitis",
        "description": "Infection around a partly erupted wisdom tooth",
        "audience": "adult",
        "items": [
            dict(_METRO, duration="3 days", quantity="9"),
            dict(_CHX, notes="Also rinse gently under the gum flap with warm salt water."),
            _PARA,
        ],
    },

    # ── Implants ────────────────────────────────────────────────────────────
    {
        "name": "After implant placement",
        "description": "Cover and pain relief after an implant",
        "audience": "adult",
        "items": [
            dict(_AMOX, notes="After food. Start on the day of surgery and finish the course."),
            _ACE_PARA, dict(_PPI, duration="3 days", quantity="3"), _CHX_14,
        ],
    },

    # ── Soft tissue ─────────────────────────────────────────────────────────
    {
        "name": "Ulcers and soreness",
        "description": "Local relief for mouth ulcers",
        "audience": "adult",
        "items": [
            _ULCER_GEL,
            {"medicine_name": "Paracetamol 650mg", "dosage": "1-0-1", "duration": "3 days",
             "quantity": "6", "notes": "If painful"},
        ],
    },
    {
        "name": "Oral thrush",
        "description": "White patches from a fungal infection",
        "audience": "adult",
        "items": [
            {"medicine_name": "Clotrimazole 1% mouth paint", "dosage": "1-1-1", "duration": "7 days",
             "quantity": "1",
             "notes": "Apply to the white patches after food. Keep going for 2 days after they clear."},
        ],
    },
    {
        "name": "Denture sore spots",
        "description": "Come back for an adjustment if still sore after 3 days",
        "audience": "adult",
        "items": [
            dict(_ULCER_GEL, dosage="1-1-1",
                 notes="Apply to the sore area. Leave the denture out when you can."),
        ],
    },

    # ── General ─────────────────────────────────────────────────────────────
    {
        "name": "Pain only, no antibiotic",
        "description": "When there is no sign of infection",
        "audience": "adult",
        "items": [dict(_PARA, notes="After food")],
    },
    {
        "name": "Braces discomfort",
        "description": "Soreness after braces are fitted or adjusted",
        "audience": "adult",
        "items": [
            dict(_PARA_SOS, notes="For soreness in the first few days after an adjustment"),
            {"medicine_name": "Orthodontic wax", "dosage": "SOS", "duration": "",
             "quantity": "1", "notes": "Press a small piece over any wire or bracket that rubs"},
        ],
    },
    {
        # Weight-based on purpose. A fixed millilitre dose for "a child" is
        # either too much for a toddler or too little for a twelve-year-old,
        # and a template has no way to know which child is in the chair.
        "name": "Children, pain after treatment",
        "description": "Dose is by body weight, so confirm the weight first",
        "audience": "child",
        "items": [
            {"medicine_name": "Paracetamol oral suspension 250mg/5ml", "dosage": "As per weight",
             "duration": "3 days", "quantity": "1",
             "notes": "15 mg per kg per dose, up to 4 times a day, at least 4 hours apart."},
        ],
    },
]
