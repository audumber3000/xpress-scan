"""
Authentication utilities for clean architecture
"""
from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic, UserDevice
from typing import Optional
import jwt
import os
from core.roles import is_clinical, CLINICAL_ROLES

def get_jwt_secret():
    """Get JWT secret from environment"""
    return os.getenv("JWT_SECRET", "your-secret-key")


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
        # Deliberately not str(e). Whatever broke here is ours, and its text is
        # for the logs, not for the person holding the phone.
        raise HTTPException(status_code=401, detail="Your session could not be verified. Please sign in again.")


def check_permission(required_permission: str, resource: str = None):
    """Decorator to check user permissions"""
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Clinic owners have all permissions
        if current_user.role == "clinic_owner":
            return current_user

        # Check if user has the required permission
        permissions = current_user.permissions or {}
        resource_permissions = permissions.get(resource, {})

        # Handle synonyms for common actions (to prevent 403 errors due to naming mismatch)
        synonyms = {
            "view": ["view", "read"],
            "read": ["view", "read"],
            "edit": ["edit", "write", "update"],
            "update": ["edit", "write", "update"],
            "delete": ["delete", "remove"]
        }

        search_keys = synonyms.get(required_permission, [required_permission])
        has_perm = any(resource_permissions.get(key, False) for key in search_keys)

        if not has_perm:
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