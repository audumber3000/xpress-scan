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


def default_permissions_for(role: str) -> dict:
    """Permission set to seed a new staff member with, based on role."""
    return ROLE_PRESETS.get(role, ROLE_PRESETS["receptionist"])
