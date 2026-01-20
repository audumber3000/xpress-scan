from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import ScanType
from schemas import ScanTypeCreate, ScanTypeUpdate, ScanTypeOut
from core.auth_utils import get_current_user

router = APIRouter()

@router.get("/", response_model=List[ScanTypeOut])
def list_scan_types(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all scan types for current clinic"""
    # Check if user has permission to view billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view billing information")
    
    return db.query(ScanType).filter(ScanType.clinic_id == current_user.clinic_id).all()

@router.post("/", response_model=ScanTypeOut, status_code=status.HTTP_201_CREATED)
def create_scan_type(scan_type: ScanTypeCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a new scan type for current clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    scan_type_data = scan_type.dict()
    scan_type_data['clinic_id'] = current_user.clinic_id
    
    db_scan_type = ScanType(**scan_type_data)
    db.add(db_scan_type)
    try:
        db.commit()
        db.refresh(db_scan_type)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Scan type with this name already exists.")
    return db_scan_type

@router.put("/{scan_type_id}", response_model=ScanTypeOut)
def update_scan_type(scan_type_id: int, scan_type: ScanTypeUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update scan type - scoped by clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    db_scan_type = db.query(ScanType).filter(
        ScanType.id == scan_type_id,
        ScanType.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_scan_type:
        raise HTTPException(status_code=404, detail="Scan type not found")
    
    if scan_type.name is not None:
        db_scan_type.name = scan_type.name
    if scan_type.price is not None:
        db_scan_type.price = scan_type.price
    db.commit()
    db.refresh(db_scan_type)
    return db_scan_type

@router.delete("/{scan_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan_type(scan_type_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete scan type - scoped by clinic"""
    # Check if user has permission to edit billing
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        billing_permissions = permissions.get("billing", {})
        if not billing_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit billing information")
    
    db_scan_type = db.query(ScanType).filter(
        ScanType.id == scan_type_id,
        ScanType.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_scan_type:
        raise HTTPException(status_code=404, detail="Scan type not found")
    
    db.delete(db_scan_type)
    db.commit()
    return None 