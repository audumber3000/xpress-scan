"""
Authentication utilities for clean architecture
"""
from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic, UserDevice
from typing import Optional
import jwt
import logging
import os
from core.roles import is_clinical, CLINICAL_ROLES

logger = logging.getLogger(__name__)

# Re-exported so the dozens of existing `from core.auth_utils import
# get_jwt_secret` imports keep working. The definition lives in core.app_secret,
# which is now the only place the variable is read.
from core.app_secret import get_jwt_secret  # noqa: F401


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Get current user from JWT token"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")

        token = auth_header.split(" ")[1]

        # Decode JWT token
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # The device this token was minted for, re-checked on every request.
        #
        # Deactivating a person has always been instant, because is_active is
        # read here on each call. Blocking a DEVICE was not: it was only
        # consulted during login, so an already-open session on a blocked
        # laptop kept working until the token expired — up to thirty days.
        # For the case this feature exists for, a staff member who has left
        # and still has the app open, that is the whole window that matters.
        #
        # A missing device row is deliberately not a rejection: "Remove" is
        # documented as forgetting a device so it re-enrols, not as revoking
        # it. Only an explicit block ends the session.
        device_id = payload.get("did")
        if device_id is not None:
            device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
            if device is not None and not device.is_active:
                raise HTTPException(
                    status_code=401,
                    detail="This device has been blocked. Please contact your clinic owner.",
                )

        return user

    except HTTPException:
        # Every rejection above is already written for a human to read. Without
        # this, the catch-all below swallowed them and re-raised str(e), and
        # Starlette's HTTPException.__str__ is "{status_code}: {detail}" — so a
        # blocked device was told "401: This device has been blocked", with the
        # status code sitting in the middle of the sentence.
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        # NOT a 401. Every genuine authentication failure is already handled
        # above; anything reaching here is our infrastructure — the database
        # was unreachable, the connection pool timed out, RDS failed over
        # mid-query. Those are not statements about who this person is.
        #
        # This mattered more than it looks. A 401 is the one status the client
        # treats as destructive: it clears the stored token, ends the session
        # and puts "Your session has ended" on the screen. So a one-second
        # database hiccup during any ordinary request signed a dentist out
        # mid-consultation, and the app made it look like their own account had
        # been revoked. A 503 says the true thing, and the client retries
        # instead of tearing the session down.
        logger.exception("Token validation failed for a non-auth reason")
        raise HTTPException(
            status_code=503,
            detail="We could not reach the server just now. Please try again in a moment.",
        )


# Two names for one action. Written at different times by different screens, so
# a stored `write` has to satisfy a required `edit` or half the app 403s.
ACTION_SYNONYMS = {
    "view": ["view", "read"],
    "read": ["view", "read"],
    "edit": ["edit", "write", "update"],
    "update": ["edit", "write", "update"],
    "delete": ["delete", "remove"],
}

# Two names for one module, and this one was worse than a nuisance.
#
# The role presets in domains/auth/role_presets.py write `finance`; the
# Permissions screen and several route guards ask for `billing`. Nothing
# translated between them, so a check for `billing.view` read a key that no
# staff account has ever had — verified against the database: of seven staff
# users, six carry `finance` and zero carry `billing`. Every such guard was
# therefore a 403 for every non-owner, whatever the owner had configured.
#
# Aliased rather than renamed: rows in the wild use both spellings, and a
# migration that rewrote them would still leave old clients sending the other.
RESOURCE_ALIASES = {
    "billing": ["billing", "finance"],
    "finance": ["finance", "billing"],
    "users": ["users", "staff"],
    "staff": ["staff", "users"],
}


def has_permission(user, action: str, resource: str) -> bool:
    """Whether this user may do `action` on `resource`.

    The imperative twin of `check_permission`, for routes that test inside the
    handler rather than through Depends. It exists because those routes were
    each hand-rolling `permissions.get("billing", {}).get("view", False)` —
    which skips both the action synonyms and the resource aliases, and so was
    wrong in two separate ways at once.
    """
    if not user:
        return False
    if getattr(user, "role", None) == "clinic_owner":
        return True

    permissions = user.permissions or {}
    actions = ACTION_SYNONYMS.get(action, [action])
    for name in RESOURCE_ALIASES.get(resource, [resource]):
        block = permissions.get(name) or {}
        if any(block.get(a, False) for a in actions):
            return True
    return False


def check_permission(required_permission: str, resource: str = None):
    """Decorator to check user permissions"""
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not has_permission(current_user, required_permission, resource):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {resource}.{required_permission}"
            )

        return current_user

    return permission_checker


def require_permission(permission: str, resource: str):
    """Helper function to create permission requirements"""
    return check_permission(permission, resource)


def get_current_clinic(request: Request, db: Session = Depends(get_db)) -> Optional[Clinic]:
    """Get current clinic from user's clinic_id"""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    if not clinic or clinic.status != "active":
        raise HTTPException(status_code=404, detail="Clinic not found or inactive")

    return clinic


def require_role(required_role: str):
    """Decorator to require specific user role"""
    def role_checker(user: User = Depends(get_current_user)):
        if user.role != required_role:
            raise HTTPException(status_code=403, detail=f"Requires {required_role} role")
        return user
    return role_checker


# Common permission requirements
require_patients_view = require_permission("view", "patients")
require_patients_edit = require_permission("edit", "patients")
require_patients_delete = require_permission("delete", "patients")

require_reports_view = require_permission("view", "reports")
require_reports_edit = require_permission("edit", "reports")
require_reports_delete = require_permission("delete", "reports")

require_billing_view = require_permission("view", "billing")
require_billing_edit = require_permission("edit", "billing")

require_users_view = require_permission("view", "users")
require_users_edit = require_permission("edit", "users")
require_users_delete = require_permission("delete", "users")

# Common role requirements
require_clinic_owner = require_role("clinic_owner")
require_doctor = require_role("doctor")
require_receptionist = require_role("receptionist")


# Role-based access (clinic owners and doctors can access most features)
def require_doctor_or_owner():
    """Allow anyone who treats patients.

    Reads CLINICAL_ROLES rather than a literal pair, so adding an associate or a
    visiting consultant does not silently lock them out of writing clinical
    records while still showing them on the calendar.
    """
    def role_checker(user: User = Depends(get_current_user)):
        if not is_clinical(user.role):
            raise HTTPException(
                status_code=403,
                detail="Only clinical staff can do that",
            )
        return user
    return role_checker