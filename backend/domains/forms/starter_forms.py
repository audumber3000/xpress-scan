"""
Medical history forms a clinic can start from.

Same reasoning as the consent starter library: a clinic that opens this section
to an empty table and an "Add form" button will not sit down and author a
medical history questionnaire, so the section stays empty and the history keeps
being taken verbally and written on paper.

Two starters, split the way the rest of the app splits clinical screens — by
`case_paper_type`. A skin clinic should not be handed a form asking about
bleeding gums, and a dental clinic should not lose the questions that change how
they anaesthetise.

`maps_to` is what separates this from a PDF. A field carrying one writes into
the patient's own column once staff accept it; a field without one is recorded
against the submission and nothing else. Only four columns are offered as
targets, all of them free text or a small vocabulary — nothing that another
part of the app computes.
"""

CATEGORIES = [
    {"key": "medical_history", "label": "Medical history", "description": "Taken before the first visit"},
    {"key": "pre_op", "label": "Before treatment", "description": "Checks in the days before a procedure"},
    {"key": "post_op", "label": "After treatment", "description": "How healing is going"},
    {"key": "custom", "label": "Custom", "description": "Anything the clinic writes itself"},
]

# The Patient columns a field may write into. Kept as a closed list so a
# template cannot be edited to aim at, say, `payment_type` or an id.
MAPPABLE_FIELDS = {
    "allergies": "Allergies",
    "blood_group": "Blood group",
    "patient_history": "Medical history",
    "date_of_birth": "Date of birth",
}

_YES_NO = ["Yes", "No", "Not sure"]

# Conditions worth knowing before any treatment, dental or not. Kept as one
# multi-select rather than fifteen yes/no rows: on a phone, fifteen rows is the
# point most people abandon the form.
_CONDITIONS = [
    "Diabetes", "High blood pressure", "Heart disease", "Asthma",
    "Thyroid disorder", "Epilepsy", "Kidney disease", "Liver disease",
    "Tuberculosis", "Hepatitis B or C", "HIV", "Cancer",
    "Bleeding or clotting disorder", "Stroke", "None of these",
]

_SHARED_TAIL = [
    {"key": "medications", "label": "Any medicines you take regularly", "type": "textarea",
     "required": False, "maps_to": None,
     "help": "Include the dose if you know it. Write 'none' if there are none."},
    {"key": "allergies", "label": "Anything you are allergic to", "type": "textarea",
     "required": False, "maps_to": "allergies",
     "help": "Medicines, latex, foods, anaesthetic. Write 'none' if there are none."},
    {"key": "pregnant", "label": "Are you pregnant or breastfeeding?", "type": "single_select",
     "required": False, "options": ["Yes", "No", "Prefer not to say"], "maps_to": None},
    {"key": "smoking_alcohol", "label": "Do you smoke or drink alcohol?", "type": "single_select",
     "required": False, "options": ["Neither", "Smoke", "Drink", "Both"], "maps_to": None},
    {"key": "blood_group", "label": "Blood group, if you know it", "type": "single_select",
     "required": False, "maps_to": "blood_group",
     "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]},
    {"key": "consent_ack", "label": "The answers above are true to the best of my knowledge",
     "type": "boolean", "required": True, "maps_to": None},
    {"key": "signature", "label": "Signature", "type": "signature", "required": True, "maps_to": None},
]

STARTER_FORMS = [
    {
        "name": "Medical history (dental)",
        "category": "medical_history",
        "case_paper_type": "dental",
        "schema": [
            {"key": "conditions", "label": "Do you have, or have you had, any of these?",
             "type": "multi_select", "required": False, "options": _CONDITIONS, "maps_to": None},
            {"key": "past_dental", "label": "Past dental treatment", "type": "textarea",
             "required": False, "maps_to": None,
             "help": "Extractions, root canals, braces, dentures, implants."},
            {"key": "dental_pain", "label": "Are you in pain right now?", "type": "single_select",
             "required": False, "options": _YES_NO, "maps_to": None},
            {"key": "bleeding_gums", "label": "Do your gums bleed when you brush?",
             "type": "single_select", "required": False, "options": _YES_NO, "maps_to": None},
            {"key": "anaesthetic_reaction", "label": "Have you ever reacted badly to a dental anaesthetic?",
             "type": "single_select", "required": False, "options": _YES_NO, "maps_to": None},
            *_SHARED_TAIL,
        ],
    },
    {
        "name": "Medical history (general)",
        "category": "medical_history",
        "case_paper_type": "general",
        "schema": [
            {"key": "conditions", "label": "Do you have, or have you had, any of these?",
             "type": "multi_select", "required": False, "options": _CONDITIONS, "maps_to": None},
            {"key": "presenting_complaint", "label": "What brings you in?", "type": "textarea",
             "required": True, "maps_to": None},
            {"key": "symptom_duration", "label": "How long has this been going on?",
             "type": "single_select", "required": False, "maps_to": None,
             "options": ["Less than a week", "1–4 weeks", "1–6 months", "More than 6 months"]},
            {"key": "past_treatment", "label": "Treatment you have already tried for this",
             "type": "textarea", "required": False, "maps_to": None,
             "help": "Creams, tablets, procedures — and whether they helped."},
            {"key": "family_history", "label": "Does anyone in your family have the same problem?",
             "type": "single_select", "required": False, "options": _YES_NO, "maps_to": None},
            *_SHARED_TAIL,
        ],
    },
]
