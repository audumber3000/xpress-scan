"""
API endpoint for checking duplicate patients
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient
from typing import List, Optional
from pydantic import BaseModel
from core.auth_utils import get_current_user
from models import User

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DuplicateCheckRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None  # Keep for frontend compatibility but won't use

class DuplicatePatientResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    
    class Config:
        from_attributes = True

@router.post("/check-duplicates", response_model=List[DuplicatePatientResponse])
async def check_duplicate_patients(
    data: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check for duplicate patients based on name or phone
    Returns list of matching patients
    Note: Patient model doesn't have email field, so we only check name and phone
    """
    if not data.name and not data.phone:
        raise HTTPException(status_code=400, detail="At least one field (name or phone) is required")
    
    # Build query to find matches (OR condition - any field matches)
    query = db.query(Patient).filter(Patient.clinic_id == current_user.clinic_id)
    
    conditions = []
    if data.name:
        conditions.append(Patient.name.ilike(f"%{data.name}%"))
    if data.phone:
        conditions.append(Patient.phone == data.phone)
    
    if conditions:
        from sqlalchemy import or_
        query = query.filter(or_(*conditions))
    
    duplicates = query.all()
    
    return duplicates
