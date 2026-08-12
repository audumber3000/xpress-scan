"""
Consent wording a dental clinic can start from.

A new clinic opened this section to an empty table and a "Add New Template"
button, which asks them to write medico-legal wording from scratch. Most will
not, so the section stays empty and consent goes unrecorded. These are the
forms a general practice actually needs, written plainly enough for a patient
to understand, with the clinic's own details merged in at render time.

Deliberately NOT legal advice, and the UI says so: a clinic is expected to read
and adapt them. They exist so the starting point is "edit this" rather than
"write a legal document", which is the difference between the feature being
used and not.
"""

# Categories double as the grouping on the page, so a clinic scanning for
# "the extraction one" finds it by shape rather than by reading every name.
CATEGORIES = [
    {"key": "surgical", "label": "Surgical", "description": "Extractions and minor oral surgery"},
    {"key": "endodontic", "label": "Root canal", "description": "Endodontic treatment"},
    {"key": "implant", "label": "Implants", "description": "Placement and restoration"},
    {"key": "ortho", "label": "Orthodontics", "description": "Braces and aligners"},
    {"key": "sedation", "label": "Anaesthesia", "description": "Local and sedation"},
    {"key": "cosmetic", "label": "Cosmetic", "description": "Whitening and veneers"},
    {"key": "general", "label": "General", "description": "Examination and routine care"},
    {"key": "media", "label": "Photos and media", "description": "Clinical photography and marketing use"},
]

_INTRO = (
    "<p>Please read this carefully. Ask us anything you are unsure about before "
    "you sign. You can change your mind at any point before treatment begins.</p>"
)

_COMMON_TAIL = (
    "<h3>What you are agreeing to</h3>"
    "<p>I confirm that the treatment has been explained to me, including what it "
    "involves, the likely outcome, the alternatives and the risks. I have had the "
    "chance to ask questions and they have been answered.</p>"
    "<p>I understand that dentistry cannot be guaranteed, and that an outcome "
    "different from the one expected does not by itself mean anything was done "
    "incorrectly.</p>"
    "<p>I confirm the medical history I have given is accurate and complete, "
    "including any medicines I take, allergies I have and conditions I am being "
    "treated for.</p>"
)


STARTER_TEMPLATES = [
    {
        "name": "Tooth extraction",
        "category": "surgical",
        "content": _INTRO + (
            "<h3>The procedure</h3>"
            "<p>One or more teeth will be removed. The area will be numbed first. "
            "You may feel pressure but should not feel sharp pain; tell us "
            "immediately if you do.</p>"
            "<h3>What to expect afterwards</h3>"
            "<p>Bleeding for a few hours, swelling for two to three days, and "
            "soreness while the socket heals. We will give you written aftercare "
            "instructions.</p>"
            "<h3>Risks</h3>"
            "<p>Uncommon but possible: prolonged bleeding, infection, a dry socket, "
            "bruising, damage to a neighbouring tooth or filling, a piece of root "
            "left behind if removing it would cause more harm, and for lower back "
            "teeth, temporary or rarely permanent numbness of the lip, chin or "
            "tongue. Upper back teeth sit close to the sinus and an opening into it "
            "can occur.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Root canal treatment",
        "category": "endodontic",
        "content": _INTRO + (
            "<h3>The procedure</h3>"
            "<p>The nerve inside the tooth is removed, the canals are cleaned and "
            "shaped, and they are sealed. This usually takes one or two visits.</p>"
            "<h3>What to expect afterwards</h3>"
            "<p>Tenderness for a few days is normal. The tooth becomes more brittle "
            "once treated and will usually need a crown to protect it. That is a "
            "separate treatment and cost.</p>"
            "<h3>Risks</h3>"
            "<p>A canal can be blocked, curved or hidden and may not be fully "
            "treatable. Instruments can separate inside a canal. A tooth can crack, "
            "and treatment can fail later and need retreatment or removal. Success "
            "is high but not certain.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Dental implant",
        "category": "implant",
        "content": _INTRO + (
            "<h3>The procedure</h3>"
            "<p>A titanium post is placed in the jawbone and left to integrate, "
            "usually over three to six months, before a crown is fitted. Bone "
            "grafting may be needed.</p>"
            "<h3>Risks</h3>"
            "<p>The implant may fail to integrate and need removal and replacement. "
            "Infection, sinus involvement for upper implants, and nerve injury "
            "causing numbness for lower implants are possible. Smoking, diabetes "
            "and gum disease all reduce the chance of success.</p>"
            "<h3>Your part</h3>"
            "<p>Implants need cleaning and regular review for life. Neglect can lose "
            "an implant that was placed successfully.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Orthodontic treatment",
        "category": "ortho",
        "content": _INTRO + (
            "<h3>The treatment</h3>"
            "<p>Braces or aligners move teeth gradually. Treatment usually takes "
            "12 to 30 months and needs regular visits.</p>"
            "<h3>Risks</h3>"
            "<p>Decay and permanent white marks if cleaning is poor, shortening of "
            "root tips, gum recession, and jaw joint discomfort. Teeth move back "
            "afterwards unless retainers are worn as instructed, and that is a "
            "lifelong commitment.</p>"
            "<h3>Your part</h3>"
            "<p>Missed appointments, broken brackets and not wearing aligners or "
            "retainers as instructed will lengthen treatment or compromise the "
            "result.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Local anaesthetic",
        "category": "sedation",
        "content": _INTRO + (
            "<h3>What it is</h3>"
            "<p>An injection that numbs the area being treated. You stay fully "
            "awake.</p>"
            "<h3>Risks</h3>"
            "<p>Numbness lasting a few hours, and rarely longer. Bruising or "
            "soreness at the injection site. Temporary difficulty smiling on one "
            "side. Rarely, an allergic reaction or a fast heartbeat from the "
            "adrenaline in the solution.</p>"
            "<p>Tell us before treatment if you are pregnant, have a heart "
            "condition, or have reacted badly to a dental injection before.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Teeth whitening",
        "category": "cosmetic",
        "content": _INTRO + (
            "<h3>The treatment</h3>"
            "<p>A bleaching agent lightens the natural tooth shade. Results vary "
            "with the starting colour and the cause of the staining.</p>"
            "<h3>What it will not do</h3>"
            "<p>Whitening does not change the colour of fillings, crowns, veneers "
            "or bridges. Existing work may need replacing afterwards to match, at "
            "additional cost.</p>"
            "<h3>Risks</h3>"
            "<p>Sensitivity to cold during and shortly after treatment, and gum "
            "irritation. The result is not permanent and fades over time.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Examination and treatment plan",
        "category": "general",
        "content": _INTRO + (
            "<h3>What we will do</h3>"
            "<p>Examine your teeth, gums and mouth, take x-rays where they are "
            "needed, and discuss what we find along with the options, the likely "
            "cost and what happens if nothing is done.</p>"
            "<h3>X-rays</h3>"
            "<p>Dental x-rays use a very small dose of radiation and are taken only "
            "where they will change what we do. Tell us if you are or may be "
            "pregnant.</p>"
        ) + _COMMON_TAIL,
    },
    {
        "name": "Clinical photographs",
        "category": "media",
        "content": (
            "<p>Photographs are a normal part of dental record keeping. This form is "
            "about how they may be used.</p>"
            "<h3>For your records</h3>"
            "<p>Photographs are taken to plan treatment, to compare before and "
            "after, and to keep an accurate clinical record. This is part of your "
            "care.</p>"
            "<h3>Anything beyond your records</h3>"
            "<p>Separately, and only if you agree, photographs may be used for "
            "teaching, on our website or in our social media. Your name is never "
            "published with them. You can withdraw permission for this at any time "
            "and we will stop using them going forward, though we cannot recall "
            "material already printed or shared.</p>"
            "<p>Declining this changes nothing about the treatment you receive.</p>"
        ),
    },
]
