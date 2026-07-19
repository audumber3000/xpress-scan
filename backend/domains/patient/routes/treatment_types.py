from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from database import get_db
from models import TreatmentType
from schemas import TreatmentTypeCreate, TreatmentTypeUpdate, TreatmentTypeOut
from core.auth_utils import get_current_user

router = APIRouter()


def _ensure_billing_edit(current_user):
    if current_user.role != "clinic_owner":
        perms = (current_user.permissions or {}).get("billing", {})
        if not perms.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")


class TreatmentTypeBulkItem(BaseModel):
    name: str
    price: float = 0.0


class TreatmentTypeBulkCreate(BaseModel):
    items: List[TreatmentTypeBulkItem]


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_treatment_types(payload: TreatmentTypeBulkCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create many treatment types at once (CSV / manual import)."""
    _ensure_billing_edit(current_user)
    created, errors = 0, []
    for idx, item in enumerate(payload.items):
        name = (item.name or "").strip()
        if not name:
            errors.append({"row": idx + 1, "message": "Name is required"})
            continue
        try:
            db.add(TreatmentType(name=name, price=float(item.price or 0), clinic_id=current_user.clinic_id))
            db.commit()
            created += 1
        except Exception:
            db.rollback()
            errors.append({"row": idx + 1, "message": f"'{name}' could not be added (maybe a duplicate)"})
    return {"created_count": created, "errors": errors}

@router.get("", response_model=List[TreatmentTypeOut])
def list_treatment_types(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all treatment types for current clinic"""
    # Check if user has permission to view billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view billing information")
    
    return db.query(TreatmentType).filter(TreatmentType.clinic_id == current_user.clinic_id).all()

@router.post("", response_model=TreatmentTypeOut, status_code=status.HTTP_201_CREATED)
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