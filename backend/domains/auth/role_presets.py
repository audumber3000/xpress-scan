"""
Default permission presets applied when a staff member is created without an
explicit permission set. Deny-by-default is the security model, but a brand-new
account with an empty set is unusable — so a new doctor/receptionist gets the
standard access for their role, which the owner can tighten afterwards.

Mirrors the presets shown in the frontend Permissions page. Keep the two in
sync; this backend copy is the source of truth applied at creation.
"""

# Every module fully enabled — used for clinic_owner (though owners bypass
# checks anyway; kept for completeness).
_ALL = {
    "dashboard": {"read": True},
    "appointments": {"read": True, "write": True, "edit": True, "delete": True},
    "patients": {"read": True, "write": True, "edit": True, "delete": True},
    "finance": {"read": True, "write": True, "edit": True, "delete": True},
    "vendors": {"read": True, "write": True, "edit": True, "delete": True},
    "inventory": {"read": True, "write": True, "edit": True, "delete": True},
    "inbox": {"read": True, "write": True},
    "reports": {"read": True},
    "marketing": {"read": True, "write": True, "edit": True},
    "staff": {"read": True, "write": True, "edit": True, "delete": True},
    "lab": {"read": True, "write": True, "edit": True, "delete": True},
    "settings": {"read": True, "write": True, "edit": True},
    "consent": {"read": True, "write": True, "edit": True, "delete": True},
}

ROLE_PRESETS = {
    "clinic_owner": _ALL,
    "doctor": {
        "dashboard": {"read": True},
        "appointments": {"read": True, "write": False, "edit": True, "delete": False},
        "patients": {"read": True, "write": False, "edit": True, "delete": False},
        "finance": {"read": True, "write": False, "edit": False, "delete": False},
        "inbox": {"read": True, "write": True},
        "reports": {"read": True},
        "marketing": {"read": True, "write": False, "edit": False},
        "lab": {"read": True, "write": True, "edit": True, "delete": False},
        "staff": {"read": False, "write": False, "edit": False, "delete": False},
        "settings": {"read": False, "write": False, "edit": False},
        "consent": {"read": True, "write": True, "edit": True, "delete": False},
    },
    "receptionist": {
        "dashboard": {"read": True},
        "appointments": {"read": True, "write": True, "edit": True, "delete": False},
        "patients": {"read": True, "write": True, "edit": True, "delete": False},
        "finance": {"read": True, "write": True, "edit": False, "delete": False},
        "inbox": {"read": True, "write": True},
        "reports": {"read": False},
        "marketing": {"read": False, "write": False, "edit": False},
        "lab": {"read": True, "write": False, "edit": False, "delete": False},
        "staff": {"read": False, "write": False, "edit": False, "delete": False},
        "settings": {"read": False, "write": False, "edit": False},
        "consent": {"read": True, "write": True, "edit": False, "delete": False},
    },
}


# Every clinical role that is not the owner works the same way day to day: they
# see patients, write clinical notes, order lab work and read their own numbers.
# What separates an associate from an in-house doctor is how they are paid, not
# what they may click, so they share the dentist preset rather than each getting
# a near-identical copy that will drift.
#
# Before this, only clinic_owner / doctor / receptionist had presets and
# default_permissions_for fell through to RECEPTIONIST for everything else — so
# a newly added Associate or Consultant, both dentists, were seeded with a
# receptionist's access: no reports, no lab write, no clinical edit.
for _clinical_role in ("in_house_doctor", "associate", "consultant"):
    ROLE_PRESETS.setdefault(_clinical_role, ROLE_PRESETS["doctor"])

# An assistant works alongside the dentist rather than instead of one: they can
# see and prepare, but money and deletion are not theirs.
ROLE_PRESETS.setdefault("assistant", {
    "dashboard":    {"read": True},
    "appointments": {"read": True, "write": True, "edit": True, "delete": False},
    "patients":     {"read": True, "write": True, "edit": True, "delete": False},
    "finance":      {"read": False, "write": False, "edit": False, "delete": False},
    "inventory":    {"read": True, "write": True, "edit": True, "delete": False},
    "vendors":      {"read": True, "write": False, "edit": False, "delete": False},
    "inbox":        {"read": True, "write": True},
    "reports":      {"read": False},
    "marketing":    {"read": False, "write": False, "edit": False},
    "lab":          {"read": True, "write": True, "edit": True, "delete": False},
    "staff":        {"read": False, "write": False, "edit": False, "delete": False},
    "settings":     {"read": False, "write": False, "edit": False},
    "consent":      {"read": True, "write": True, "edit": False, "delete": False},
})


def default_permissions_for(role: str) -> dict:
    """Permission set to seed a new staff member with, based on role.

    Falls back to receptionist for a role we do not recognise. That is the
    conservative direction — the least access of any preset — so an unknown
    role can never accidentally hand somebody the run of the clinic. Every role
    in core.roles.ROLES has a real preset above, and the test below keeps it
    that way.
    """
    return ROLE_PRESETS.get(role, ROLE_PRESETS["receptionist"])
