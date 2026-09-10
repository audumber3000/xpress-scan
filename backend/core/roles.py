"""
Who works at a clinic, in one place.

The role list used to be two entries hardcoded in the /roles endpoint, while
four separate modules each wrote their own `["doctor", "clinic_owner"]` filter.
Adding a role to the dropdown without touching those filters would have created
staff who exist but never appear on the calendar, cannot be given working hours,
and are missing from the website. So the list and the "is this person clinical"
question live together, and everything imports from here.
"""

CLINIC_OWNER = "clinic_owner"
IN_HOUSE_DOCTOR = "in_house_doctor"
ASSOCIATE = "associate"
CONSULTANT = "consultant"
DOCTOR = "doctor"            # legacy: what every existing dentist is stored as
RECEPTIONIST = "receptionist"
ASSISTANT = "assistant"

# Order matters: this is the order the dropdown offers them.
ROLES = [
    {
        "value": CLINIC_OWNER,
        "label": "Owner",
        "description": "Runs the clinic and also treats patients",
        "clinical": True,
    },
    {
        "value": IN_HOUSE_DOCTOR,
        "label": "In-house doctor",
        "description": "Salaried dentist working set hours at this clinic",
        "clinical": True,
    },
    {
        "value": ASSOCIATE,
        "label": "Associate",
        "description": "Dentist working here regularly, usually on a share of what they bill",
        "clinical": True,
    },
    {
        "value": CONSULTANT,
        "label": "Consultant",
        "description": "Visiting specialist who comes in for particular cases",
        "clinical": True,
    },
    {
        "value": DOCTOR,
        "label": "Doctor",
        "description": "General clinical role",
        "clinical": True,
    },
    {
        "value": RECEPTIONIST,
        "label": "Receptionist",
        "description": "Front desk, appointments and patient intake",
        "clinical": False,
    },
    {
        "value": ASSISTANT,
        "label": "Assistant",
        "description": "Chairside support",
        "clinical": False,
    },
]

ROLE_VALUES = [r["value"] for r in ROLES]

# Anyone who sees patients. This is the list the calendar draws columns for,
# who can be given working hours, and who can be owed a consultant fee.
# The owner is included because in a small practice the owner IS a dentist.
CLINICAL_ROLES = [r["value"] for r in ROLES if r["clinical"]]

# Roles that may create clinical records. Deliberately the same as CLINICAL_ROLES
# rather than a separate list, so a new clinical role cannot be added to one and
# forgotten in the other.
CAN_WRITE_CLINICAL = CLINICAL_ROLES

ROLE_LABELS = {r["value"]: r["label"] for r in ROLES}


def is_clinical(role: str | None) -> bool:
    return (role or "") in CLINICAL_ROLES


def label_for(role: str | None) -> str:
    return ROLE_LABELS.get(role or "", (role or "").replace("_", " ").title() or "Staff")


def assignable_by(role: str | None) -> list[dict]:
    """What roles this person is allowed to hand out.

    Seniority only. Whether they may add staff at all is a separate question,
    answered by the staff permission on their account — keeping the two apart is
    what lets an owner delegate hiring to a practice manager without also
    handing over the ability to create dentists.

    An owner can hand out anything except another owner: ownership is
    transferred, not issued, and a second owner is a second person who bypasses
    every permission check in the app. Everybody else can hand out the
    non-clinical roles — front desk and chairside — and nothing higher.

    The last line used to be a bare `return []`, which read as "only clinical
    staff can be trusted to hire". In practice the person doing the hiring in a
    small practice is the receptionist who runs the front desk, and the owner
    grants them Staff access precisely so they can. Returning nothing meant the
    role dropdown came back empty for exactly that person, and — once the roles
    were actually enforced on write — that their grant did nothing at all.
    """
    if role == CLINIC_OWNER:
        return [r for r in ROLES if r["value"] != CLINIC_OWNER]
    return [r for r in ROLES if not r["clinical"]]
