from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User
from typing import List, Optional
from pydantic import BaseModel
import datetime
from auth import get_current_user

router = APIRouter()

class ClinicUserIn(BaseModel):
    email: str
    name: str
    role: str = "receptionist"
    permissions: Optional[dict] = {}

class ClinicUserUpdate(BaseModel):
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
    try:
        users = db.query(User).filter(
            User.clinic_id == current_user.clinic_id
        ).all()
        return users
    except Exception as e:
        print(f"[clinic-users GET] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ClinicUserOut, status_code=status.HTTP_201_CREATED)
def add_clinic_user(user_in: ClinicUserIn, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Add a new clinic user for current clinic"""
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
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete clinic user - scoped by clinic"""
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
    print(f"Updating user {user_id} with data: {user_update}")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if user_update.role is not None:
        user.role = user_update.role
        print(f"Updated role to: {user_update.role}")
    if user_update.permissions is not None:
        user.permissions = user_update.permissions
        print(f"Updated permissions to: {user_update.permissions}")
    
    db.commit()
    db.refresh(user)
    return user
