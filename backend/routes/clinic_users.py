from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic
from typing import List, Optional
from pydantic import BaseModel
import datetime
from auth import get_current_user
from services.email_service import EmailService

router = APIRouter()

class ClinicUserIn(BaseModel):
    email: str
    name: str
    role: str = "receptionist"
    permissions: Optional[dict] = {}

class ClinicUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[dict] = None

class ClinicUserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    clinic_id: Optional[int] = None
    is_active: bool
    created_at: datetime.datetime
    permissions: Optional[dict] = {}
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[ClinicUserOut])
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
        return users
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ClinicUserOut, status_code=status.HTTP_201_CREATED)
def add_clinic_user(user_in: ClinicUserIn, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Add a new clinic user for current clinic"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit users")
    
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user = User(
        email=user_in.email, 
        name=user_in.name,
        role=user_in.role, 
        clinic_id=current_user.clinic_id,
        created_by=current_user.id,
        permissions=user_in.permissions or {}
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send invitation email to staff member
    try:
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if clinic:
            email_service = EmailService()
            email_service.send_staff_invitation_email(
                to_email=user_in.email,
                staff_name=user_in.name,
                clinic_name=clinic.name,
                role=user_in.role,
                inviter_name=current_user.name
            )
    except Exception as email_error:
        # Log error but don't fail user creation
        print(f"Failed to send staff invitation email: {email_error}")
    
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
def update_clinic_user(user_id: int, user_update: ClinicUserUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
        user.email = user_update.email
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.permissions is not None:
        user.permissions = user_update.permissions
    
    db.commit()
    db.refresh(user)
    return user
