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

The third starter is a different animal. "Medical history and patient
information" is `kind='medical_history'`: it renders to a signed PDF that files
itself in the patient's documents, because a history taken before an extraction
is a legal record and not just data. It uses the layout field types — `section`
to break sixty questions into blocks a person can face on a phone,
`checkbox_grid` so forty conditions are one field rather than forty,
`yes_no_explain` for the questions where the answer only matters if it is yes,
and `declaration` for wording the patient is agreeing to rather than answering.
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


# ── The full medical history ──────────────────────────────────────────────────
#
# Modelled on the paper form a practice actually hands a new patient: who they
# are, who pays, what is wrong with them, and a signature under a declaration.
# The two starters above are short questionnaires meant to be answered in two
# minutes; this one replaces the clipboard.
#
# The condition list is the part worth getting right. It is long on purpose —
# a history that omits "bleeding disorder" is worse than no history, because
# staff will trust it — but it is one `checkbox_grid` field, so on a phone it
# is one screen of taps rather than forty separate questions.

_CONDITION_GRID = [
    "AIDS / HIV", "Anaemia", "Arthritis", "Artificial joints or implants",
    "Asthma", "Blood disease", "Cancer", "Codeine allergy", "Diabetes",
    "Dizziness", "Epilepsy", "Excessive bleeding", "Fainting", "Glaucoma",
    "Growths", "Hay fever", "Head injuries", "Heart disease", "Heart murmur",
    "Hepatitis", "High or low blood pressure", "Hormonal disorder",
    "Kidney disease", "Liver disease (jaundice)", "Mental disorders",
    "Nervous disorders", "Pacemaker", "Penicillin allergy", "Porphyria",
    "Radiation treatment", "Respiratory problems", "Rheumatic fever",
    "Rheumatism", "Sclerosis", "Sinus problems", "Stomach problems",
    "Stroke", "Thyroid disorder", "Tuberculosis", "Tumours", "Ulcers",
]

# The wording the patient signs under. Editable per clinic, because it is the
# clinic's liability and not ours to fix. Kept close to the language a practice
# already uses on paper so a doctor reading it recognises their own form.
_DECLARATION = (
    "To the best of my knowledge, all of the preceding answers and information "
    "provided are true and correct. If I ever have any change in my health, I "
    "will inform the doctors at the next appointment without fail.\n\n"
    "I also understand and consent to the following: during the course of "
    "treatment I may undergo procedures in all phases of dentistry including "
    "periodontics (gum treatment and surgery), oral surgery, endodontics (root "
    "canals), fixed and removable prosthodontics (crowns, bridges and "
    "dentures), restorative dentistry, temporomandibular disorder treatment, "
    "oral pathology, paediatric dentistry and radiography, of which all risks "
    "and benefits are explained and understood.\n\n"
    "No guarantees can be made about treatment outcomes, restoration longevity "
    "or prognoses. I understand that any branch of medicine, including "
    "dentistry, can involve unanticipated results. My treatment plan may change "
    "at any time and I am welcome to ask questions about any aspect of my care "
    "and will request information if I am confused or need more information. I "
    "am responsible for clarifying any aspects of my treatment that I am unsure "
    "about.\n\n"
    "I hereby accept full responsibility for the payment of procedures and "
    "amounts not covered by my insurance or scheme."
)

MEDICAL_HISTORY_FORM = {
    "name": "Medical history and patient information",
    "category": "medical_history",
    "kind": "medical_history",
    # No case paper restriction: every patient fills this one, whatever they
    # are being seen for.
    "case_paper_type": None,
    "schema": [
        # ── 1. Who they are ──────────────────────────────────────────────────
        {"key": "sec_patient", "type": "section", "label": "Patient information",
         "help": "So we can reach you and put this on the right file."},
        {"key": "full_name", "label": "Full name", "type": "text", "required": True,
         "maps_to": None},
        {"key": "dob", "label": "Date of birth", "type": "date", "required": False,
         "maps_to": "date_of_birth"},
        {"key": "sex", "label": "Sex", "type": "single_select", "required": False,
         "options": ["Male", "Female", "Other", "Prefer not to say"], "maps_to": None},
        {"key": "id_number", "label": "Government ID number", "type": "text",
         "required": False, "maps_to": None,
         "help": "Aadhaar, passport or any photo ID. Optional."},
        {"key": "mobile", "label": "Mobile number", "type": "phone", "required": True,
         "maps_to": None},
        {"key": "home_phone", "label": "Home or work phone", "type": "phone",
         "required": False, "maps_to": None},
        {"key": "email", "label": "Email address", "type": "email", "required": False,
         "maps_to": None},
        {"key": "home_address", "label": "Home address", "type": "textarea",
         "required": False, "maps_to": None},
        {"key": "city", "label": "City", "type": "text", "required": False, "maps_to": None},
        {"key": "postal_code", "label": "PIN code", "type": "text", "required": False,
         "maps_to": None},
        {"key": "occupation", "label": "Occupation", "type": "text", "required": False,
         "maps_to": None},
        {"key": "employer", "label": "Employer", "type": "text", "required": False,
         "maps_to": None},
        {"key": "emergency_name", "label": "Emergency contact name", "type": "text",
         "required": True, "maps_to": None,
         "help": "Spouse, parent or whoever we should call."},
        {"key": "emergency_phone", "label": "Emergency contact phone", "type": "phone",
         "required": True, "maps_to": None},

        # ── 2. Who pays ──────────────────────────────────────────────────────
        {"key": "sec_insurance", "type": "section", "label": "Insurance details",
         "help": "Leave this blank if you are paying yourself."},
        {"key": "insurer_name", "label": "Insurer or scheme", "type": "text",
         "required": False, "maps_to": None},
        {"key": "insurance_plan", "label": "Plan or option", "type": "text",
         "required": False, "maps_to": None},
        {"key": "member_number", "label": "Member or policy number", "type": "text",
         "required": False, "maps_to": None},
        {"key": "dependant_number", "label": "Dependant number", "type": "text",
         "required": False, "maps_to": None},
        {"key": "main_member_name", "label": "Main member's name", "type": "text",
         "required": False, "maps_to": None,
         "help": "Only if the policy is in somebody else's name."},
        {"key": "main_member_id", "label": "Main member's ID number", "type": "text",
         "required": False, "maps_to": None},
        {"key": "main_member_phone", "label": "Main member's phone", "type": "phone",
         "required": False, "maps_to": None},

        # ── 3. What is wrong ─────────────────────────────────────────────────
        {"key": "sec_health", "type": "section", "label": "Health information",
         "help": "This is the part that changes how we treat you, so please "
                 "answer it even where you are not sure."},
        {"key": "last_visit", "label": "Date of your last dental visit", "type": "text",
         "required": False, "maps_to": None,
         "help": "An approximate month and year is fine."},
        {"key": "visit_reason", "label": "Reason for this visit", "type": "textarea",
         "required": True, "maps_to": None},
        {"key": "conditions", "type": "checkbox_grid", "required": False,
         "label": "Have you ever had any of the following?",
         "help": "Tick everything that applies. Leave it empty if none do.",
         "options": _CONDITION_GRID, "maps_to": None},
        {"key": "smoker", "label": "Do you smoke?", "type": "single_select",
         "required": False, "options": ["No", "Yes", "I used to"], "maps_to": None},
        {"key": "pregnant", "label": "Are you pregnant or breastfeeding?",
         "type": "single_select", "required": False,
         "options": ["Not applicable", "Yes", "No", "Prefer not to say"], "maps_to": None},
        {"key": "pregnancy_due", "label": "If pregnant, your due date", "type": "text",
         "required": False, "maps_to": None},
        {"key": "antibiotics_needed", "type": "yes_no_explain", "required": False,
         "label": "Has a health professional told you that you need antibiotics "
                  "before dental treatment?",
         "maps_to": None},
        {"key": "anaesthetic_reaction", "type": "yes_no_explain", "required": False,
         "label": "Have you ever reacted badly to a local anaesthetic?",
         "maps_to": None},
        {"key": "dental_complication", "type": "yes_no_explain", "required": False,
         "label": "Have you ever had a complication after dental treatment?",
         "maps_to": None},
        {"key": "hospital_admission", "type": "yes_no_explain", "required": False,
         "label": "Have you been admitted to hospital or needed emergency care "
                  "in the past two years?",
         "maps_to": None},
        {"key": "other_concerns", "type": "yes_no_explain", "required": False,
         "label": "Do you have any health problems that need further explanation?",
         "maps_to": None},
        {"key": "medications", "label": "All medicines you currently take",
         "type": "textarea", "required": False, "maps_to": None,
         "help": "Prescription and over the counter, with the dose if you know "
                 "it. Write 'none' if there are none."},
        {"key": "allergies", "label": "Anything you are allergic to", "type": "textarea",
         "required": False, "maps_to": "allergies",
         "help": "Medicines, latex, foods, anaesthetic. Write 'none' if there "
                 "are none."},
        {"key": "blood_group", "label": "Blood group, if you know it",
         "type": "single_select", "required": False, "maps_to": "blood_group",
         "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]},
        {"key": "family_doctor", "label": "Name of your family doctor", "type": "text",
         "required": False, "maps_to": None},
        {"key": "family_doctor_phone", "label": "Family doctor's phone", "type": "phone",
         "required": False, "maps_to": None},

        # ── 4. What they are signing ─────────────────────────────────────────
        {"key": "sec_declaration", "type": "section", "label": "Declaration"},
        {"key": "declaration", "type": "declaration", "required": True,
         "label": "I have read and accept the following",
         "help": _DECLARATION, "maps_to": None},
        {"key": "signature", "label": "Signature of patient, parent or guardian",
         "type": "signature", "required": True, "maps_to": None,
         "help": "Sign with your finger. By signing you agree that the main "
                 "member is aware of this form if you are signing as a dependant."},
    ],
}

STARTER_FORMS.append(MEDICAL_HISTORY_FORM)
