from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic
from typing import List, Optional
from pydantic import BaseModel
import datetime
from core.auth_utils import get_current_user
from core.audit import (record_audit, STAFF_CREATED, STAFF_UPDATED,
                        STAFF_DEACTIVATED, PERMISSIONS_CHANGED, PASSWORD_CHANGED)
from domains.communication.services.email_service import EmailService
import hashlib
import logging
import os
from core.roles import assignable_by, ROLE_VALUES

def hash_password(password: str) -> str:
    """Simple password hashing for offline mode"""
    return hashlib.sha256(password.encode()).hexdigest()

logger = logging.getLogger(__name__)

router = APIRouter()

class ClinicUserIn(BaseModel):
    email: Optional[str] = None  # Required for owners; optional for staff
    username: Optional[str] = None  # Login identifier for staff (no email required)
    name: str
    role: str = "receptionist"
    permissions: Optional[dict] = {}
    password: Optional[str] = None  # Password for desktop / mobile login
    phone: Optional[str] = None     # so the welcome can also go out on WhatsApp
    # What this person is paid per case, if anything. Set once here rather than
    # typed on every case paper.
    fee_basis: Optional[str] = None    # fixed | percentage | None
    fee_value: Optional[float] = None

class ClinicUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # Password for desktop / mobile login
    phone: Optional[str] = None
    fee_basis: Optional[str] = None
    fee_value: Optional[float] = None

class SetPasswordRequest(BaseModel):
    password: str

class ClinicUserOut(BaseModel):
    id: int
    email: Optional[str] = None
    username: Optional[str] = None
    name: str
    role: str
    clinic_id: Optional[int] = None
    is_active: bool
    created_at: datetime.datetime
    permissions: Optional[dict] = {}
    has_password: Optional[bool] = False  # Whether user has a password set
    # The person's own profile photo. Without it every staff list falls back to
    # a generated cartoon, so uploading a picture appeared to do nothing outside
    # the profile page itself.
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("", response_model=List[ClinicUserOut])
def get_clinic_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all clinic users for current clinic"""
    # Check if user has permission to view users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view users")
    
    try:
        users = db.query(User).filter(
            User.clinic_id == current_user.clinic_id
        ).all()
        return [
            ClinicUserOut(
                id=user.id,
                email=user.email,
                username=user.username,
                name=user.name,
                role=user.role,
                clinic_id=user.clinic_id,
                is_active=user.is_active,
                created_at=user.created_at,
                permissions=user.permissions or {},
                has_password=bool(user.password_hash),
                avatar_url=user.avatar_url
            ) for user in users
        ]
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=ClinicUserOut, status_code=status.HTTP_201_CREATED)
def add_clinic_user(user_in: ClinicUserIn, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Add a new clinic user for current clinic"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit users")
    
    # Normalise inputs — treat empty strings as missing
    email = (user_in.email or "").strip() or None
    username = (user_in.username or "").strip() or None

    if not email and not username:
        raise HTTPException(
            status_code=400,
            detail="Either an email or a username is required"
        )

    if email:
        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="A user with this email already exists")

    if username:
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="This username is already taken")

    # Split name into first_name and last_name
    name_parts = user_in.name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else user_in.name
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    # Hash password if provided
    password_hash = None
    if user_in.password:
        if len(user_in.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        password_hash = hash_password(user_in.password)

    # Seed sensible role defaults when none are supplied, so a new staff member
    # is immediately usable rather than locked out with an empty permission set.
    from domains.auth.role_presets import default_permissions_for
    permissions = user_in.permissions or default_permissions_for(user_in.role)

    user = User(
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        name=user_in.name,
        role=user_in.role,
        clinic_id=current_user.clinic_id,
        created_by=current_user.id,
        permissions=permissions,
        password_hash=password_hash,
        phone=(user_in.phone or "").strip() or None,
        fee_basis=(user_in.fee_basis or None),
        fee_value=user_in.fee_value,
    )
    db.add(user)
    db.flush()
    # Creating a login is how someone gains access to patient records, so it
    # belongs in the log next to the permission changes that follow it.
    record_audit(
        db, current_user, STAFF_CREATED,
        f"Added {user.name or user.email} as {user.role}",
        request=request, entity_type='user', entity_id=user.id,
    )
    db.commit()
    db.refresh(user)

    # ── Welcome the new member on every channel we have for them ───────────
    #
    # This used to send an email that said "you've been added" and nothing else:
    # no login id, no password, no way in. The credentials go out here at the
    # clinic's explicit request. They are sent once, at creation, and never
    # re-sent, and the password is never written to a log.
    #
    # Neither send can fail the creation. The account exists either way, and an
    # owner who sees a warning can hand the details over in person.
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    login_id = email or username
    delivery = {"email": False, "whatsapp": False}

    if email and clinic:
        try:
            EmailService().send_staff_invitation_email(
                to_email=email,
                staff_name=user_in.name,
                clinic_name=clinic.name,
                role=user_in.role,
                inviter_name=current_user.name,
                login_id=login_id,
                password=user_in.password,
                login_url=os.environ.get("APP_URL") or None,
            )
            delivery["email"] = True
        except Exception as exc:  # noqa: BLE001
            logger.warning("staff welcome email failed for user %s: %s", user.id, type(exc).__name__)

    phone = (user_in.phone or "").strip()
    if phone and clinic:
        try:
            from core.notification_dispatch import notify_event
            notify_event(
                "staff_welcome",
                db=db,
                clinic_id=current_user.clinic_id,
                to_phone=phone,
                to_email=email or "",
                to_name=user_in.name,
                template_data={
                    "clinic_name": clinic.name or "",
                    "staff_name": user_in.name or "",
                    "role": user_in.role or "",
                    "login_id": login_id or "",
                    "password": user_in.password or "",
                    "app_url": os.environ.get("APP_URL", ""),
                },
            )
            delivery["whatsapp"] = True
        except Exception as exc:  # noqa: BLE001
            logger.warning("staff welcome whatsapp failed for user %s: %s", user.id, type(exc).__name__)

    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete clinic user - scoped by clinic"""
    # Check if user has permission to delete users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("delete", False):
            raise HTTPException(status_code=403, detail="You don't have permission to delete users")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@router.put("/{user_id}", response_model=ClinicUserOut)
def update_clinic_user(user_id: int, user_update: ClinicUserUpdate, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update clinic user - scoped by clinic"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit users")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if user_update.name is not None:
        user.name = user_update.name
    if user_update.email is not None:
        new_email = user_update.email.strip() or None
        if new_email and new_email != user.email:
            clash = db.query(User).filter(User.email == new_email, User.id != user.id).first()
            if clash:
                raise HTTPException(status_code=400, detail="A user with this email already exists")
        user.email = new_email
    if user_update.username is not None:
        new_username = user_update.username.strip() or None
        if new_username and new_username != user.username:
            clash = db.query(User).filter(User.username == new_username, User.id != user.id).first()
            if clash:
                raise HTTPException(status_code=400, detail="This username is already taken")
        user.username = new_username
    if user_update.role is not None:
        # Demoting yourself out of clinic_owner is the same trap as editing your
        # own permissions: the screen that would undo it is the one you just lost.
        if user.id == current_user.id and user.role == 'clinic_owner' and user_update.role != 'clinic_owner':
            raise HTTPException(
                status_code=400,
                detail="You can't change your own role. Ask another owner to do it.",
            )
        user.role = user_update.role
    if user_update.permissions is not None:
        # Nobody edits their own permissions. An owner who switches off their own
        # access loses the very screen that could restore it, and there is no
        # in-app way back — it takes a database edit. Enforced here and not only
        # in the UI, because a disabled button stops a slip, not a direct call.
        if user.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You can't change your own permissions — it would lock you out.",
            )
        # The owner's access is not editable by anyone: a staff member with
        # staff:edit could otherwise strip the owner and take over the clinic.
        if user.role == 'clinic_owner':
            raise HTTPException(
                status_code=400,
                detail="The clinic owner always has full access, and it can't be edited.",
            )
        user.permissions = user_update.permissions
        record_audit(db, current_user, PERMISSIONS_CHANGED,
                     f"Changed module permissions for {user.name}",
                     request=request, entity_type='user', entity_id=user.id)
    if user_update.is_active is not None:
        if user.role == 'clinic_owner':
            raise HTTPException(status_code=400, detail="Cannot deactivate the clinic owner")
        user.is_active = user_update.is_active
        record_audit(db, current_user, STAFF_DEACTIVATED if not user_update.is_active else STAFF_UPDATED,
                     f"{'Deactivated' if not user_update.is_active else 'Reactivated'} {user.name}",
                     request=request, entity_type='user', entity_id=user.id)
    if user_update.password is not None:
        if len(user_update.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user.password_hash = hash_password(user_update.password)
    
    db.commit()
    db.refresh(user)
    return user

@router.post("/{user_id}/set-password")
def set_staff_password(
    user_id: int, 
    password_request: SetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    """Set or reset password for a staff member - only doctors/clinic owners can do this"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to set passwords for users")
    
    # Find the user
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate password
    if len(password_request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Set password hash
    user.password_hash = hash_password(password_request.password)
    # One person setting another's password is a handover of access. The
    # password itself is obviously never recorded, only that it happened and
    # who did it, which is the part that matters if an account is later
    # disputed.
    record_audit(
        db, current_user, PASSWORD_CHANGED,
        f"Set a new password for {user.name or user.email}"
        + (" (their own)" if user.id == current_user.id else ""),
        request=request, entity_type='user', entity_id=user.id,
    )
    db.commit()
    
    return {"message": "Password set successfully"}

@router.get("/roles", response_model=List[dict])
def get_available_roles(current_user = Depends(get_current_user)):
    """Get available roles based on current user's role"""
    return assignable_by(current_user.role)
