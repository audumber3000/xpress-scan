from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import TreatmentType
from schemas import TreatmentTypeCreate, TreatmentTypeUpdate, TreatmentTypeOut
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[TreatmentTypeOut])
def list_treatment_types(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all treatment types for current clinic"""
    # Check if user has permission to view billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view billing information")
    
    return db.query(TreatmentType).filter(TreatmentType.clinic_id == current_user.clinic_id).all()

@router.post("/", response_model=TreatmentTypeOut, status_code=status.HTTP_201_CREATED)
def create_treatment_type(treatment_type: TreatmentTypeCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a new treatment type for current clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    treatment_type_data = treatment_type.dict()
    treatment_type_data['clinic_id'] = current_user.clinic_id
    
    db_treatment_type = TreatmentType(**treatment_type_data)
    db.add(db_treatment_type)
    try:
        db.commit()
        db.refresh(db_treatment_type)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Treatment type with this name already exists.")
    return db_treatment_type

@router.put("/{treatment_type_id}", response_model=TreatmentTypeOut)
def update_treatment_type(treatment_type_id: int, treatment_type: TreatmentTypeUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update treatment type - scoped by clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    db_treatment_type = db.query(TreatmentType).filter(
        TreatmentType.id == treatment_type_id,
        TreatmentType.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_treatment_type:
        raise HTTPException(status_code=404, detail="Treatment type not found")
    
    if treatment_type.name is not None:
        db_treatment_type.name = treatment_type.name
    if treatment_type.price is not None:
        db_treatment_type.price = treatment_type.price
    db.commit()
    db.refresh(db_treatment_type)
    return db_treatment_type

@router.delete("/{treatment_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_treatment_type(treatment_type_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete treatment type - scoped by clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    db_treatment_type = db.query(TreatmentType).filter(
        TreatmentType.id == treatment_type_id,
        TreatmentType.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_treatment_type:
        raise HTTPException(status_code=404, detail="Treatment type not found")
    
    db.delete(db_treatment_type)
    db.commit()
    return None 