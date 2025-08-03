from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic
from schemas import UserCreate, UserOut
from typing import List
from auth import get_current_user, require_clinic_owner, require_doctor_or_owner
import datetime

router = APIRouter()

@router.get("/", response_model=List[UserOut])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users for current clinic"""
    # Check if user has permission to view users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view users")
    
    try:
        users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
        return users
    except Exception as e:
        print(f"[users GET] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner)
):
    """Create a new user for current clinic (only clinic owners and doctors can create users)"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit users")
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == user_in.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Set clinic_id from current user
        user_data = user_in.dict()
        user_data['clinic_id'] = current_user.clinic_id
        user_data['created_by'] = current_user.id
        
        # Set default permissions based on role
        if user_data['role'] == 'doctor':
            user_data['permissions'] = {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "reports:edit": True,
                "billing:view": True,
                "billing:edit": True
            }
        elif user_data['role'] == 'receptionist':
            user_data['permissions'] = {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "billing:view": True
            }
        
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, 
    user_update: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner)
):
    """Update user (only clinic owners and doctors can update users)"""
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
    
    # Don't allow changing clinic_owner role unless you're the clinic owner
    if user.role == "clinic_owner" and current_user.role != "clinic_owner":
        raise HTTPException(status_code=403, detail="Only clinic owner can modify clinic owner")
    
    # Update user fields
    for field, value in user_update.items():
        if hasattr(user, field):
            setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner)
):
    """Delete user (only clinic owners can delete users)"""
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
    
    # Don't allow deleting yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Don't allow deleting other clinic owners
    if user.role == "clinic_owner":
        raise HTTPException(status_code=400, detail="Cannot delete clinic owner")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.put("/{user_id}/permissions", response_model=UserOut)
def update_user_permissions(
    user_id: int, 
    permissions: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner)
):
    """Update user permissions (only clinic owners can update permissions)"""
    # Check if user has permission to edit users
    if current_user.role != "clinic_owner":
        permissions_check = current_user.permissions or {}
        users_permissions = permissions_check.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit users")
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.permissions = permissions
    db.commit()
    db.refresh(user)
    return user

@router.get("/roles", response_model=List[dict])
def get_available_roles(current_user: User = Depends(get_current_user)):
    """Get available roles based on current user's role"""
    if current_user.role == "clinic_owner":
        return [
            {"value": "doctor", "label": "Doctor", "description": "Additional doctor for the clinic"},
            {"value": "receptionist", "label": "Receptionist", "description": "Staff for patient intake and basic tasks"}
        ]
    elif current_user.role == "doctor":
        return [
            {"value": "receptionist", "label": "Receptionist", "description": "Staff for patient intake and basic tasks"}
        ]
    else:
        return [] 