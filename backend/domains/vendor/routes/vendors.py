from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Vendor, User
from core.dtos import VendorCreateDTO, VendorUpdateDTO, VendorResponseDTO
from core.auth_utils import get_current_user

router = APIRouter()


def ensure_vendor_permission(current_user: User, action: str):
    if current_user.role == "clinic_owner":
        return

    permissions = current_user.permissions or {}
    vendor_permissions = permissions.get("vendors", {})
    if vendor_permissions.get(action) is not True:
        raise HTTPException(status_code=403, detail=f"Insufficient permissions. Required: vendors.{action}")

@router.get("", response_model=List[VendorResponseDTO])
async def list_vendors(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    clinic_id: Optional[int] = None
):
    ensure_vendor_permission(current_user, "read")
    query = db.query(Vendor)
    target_clinic_id = clinic_id or current_user.clinic_id
    query = query.filter(Vendor.clinic_id == target_clinic_id)
    if category:
        query = query.filter(Vendor.category == category)
    return query.all()

@router.post("", response_model=VendorResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: VendorCreateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_vendor_permission(current_user, "write")
    # Ensure clinic_id is provided or inferred from context
    clinic_id = getattr(vendor_data, "clinic_id", None) or getattr(current_user, "clinic_id", 1)
         
    vendor = Vendor(**vendor_data.dict())
    vendor.clinic_id = clinic_id
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.get("/{vendor_id}", response_model=VendorResponseDTO)
async def get_vendor(vendor_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_vendor_permission(current_user, "read")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponseDTO)
async def update_vendor(
    vendor_id: int,
    vendor_data: VendorUpdateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_vendor_permission(current_user, "edit")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    for key, value in vendor_data.dict(exclude_unset=True).items():
        setattr(vendor, key, value)
    
    db.commit()
    db.refresh(vendor)
    return vendor

@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_vendor_permission(current_user, "delete")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor.is_active = False
    db.commit()
    return {"message": "Vendor deactivated successfully"}
