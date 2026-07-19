"""Medication stock — physical inventory of medicines.

Separate table (medication_stock) from general consumables and from the
prescription Medication master. Simple CRUD; expiry + low-stock feed the in-app
alerts (computed client-side). Reuses the inventory permission gate.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import MedicationStock, User, Vendor, InventoryTransaction
from domains.inventory.services.ledger import record_movement
from pydantic import BaseModel
from core.dtos import (
    MedicationStockCreateDTO, MedicationStockUpdateDTO, MedicationStockResponseDTO,
)
from core.auth_utils import get_current_user
from domains.inventory.routes.inventory import ensure_inventory_permission

router = APIRouter()


class MedicationStockBulkCreate(BaseModel):
    items: List[MedicationStockCreateDTO]


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_medication_stock(
    payload: MedicationStockBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create many medication-stock rows at once (import from Control Center / CSV)."""
    ensure_inventory_permission(current_user, "write")
    created, errors = 0, []
    for idx, item in enumerate(payload.items):
        if not (item.name or "").strip():
            errors.append({"row": idx + 1, "message": "Name is required"})
            continue
        try:
            row = MedicationStock(**item.dict())
            row.clinic_id = current_user.clinic_id
            db.add(row)
            db.flush()
            record_movement(db, clinic_id=row.clinic_id, item=row, direction="in", action="added",
                            quantity=row.quantity or 0.0, note="Imported to stock", adjust_stock=False, kind="medication")
            db.commit()
            created += 1
        except Exception:
            db.rollback()
            errors.append({"row": idx + 1, "message": f"'{item.name}' could not be added"})
    return {"created_count": created, "errors": errors}


def _with_vendor(db: Session, item: MedicationStock) -> MedicationStockResponseDTO:
    dto = MedicationStockResponseDTO.from_orm(item)
    if item.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == item.vendor_id).first()
        if vendor:
            dto.vendor_name = vendor.name
    return dto


@router.get("", response_model=List[MedicationStockResponseDTO])
async def list_medications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    clinic_id: Optional[int] = None,
):
    ensure_inventory_permission(current_user, "read")
    target = clinic_id or current_user.clinic_id
    items = (
        db.query(MedicationStock)
        .filter(MedicationStock.clinic_id == target)
        .order_by(MedicationStock.name.asc())
        .all()
    )
    return [_with_vendor(db, it) for it in items]


@router.post("", response_model=MedicationStockResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_medication(
    payload: MedicationStockCreateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_inventory_permission(current_user, "write")
    item = MedicationStock(**payload.dict())
    item.clinic_id = current_user.clinic_id
    db.add(item)
    db.flush()
    record_movement(db, clinic_id=item.clinic_id, item=item, direction="in", action="added",
                    quantity=item.quantity or 0.0, note="Added to stock", adjust_stock=False, kind="medication")
    db.commit()
    db.refresh(item)
    return _with_vendor(db, item)


@router.get("/{item_id}", response_model=MedicationStockResponseDTO)
async def get_medication(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_inventory_permission(current_user, "read")
    item = db.query(MedicationStock).filter(
        MedicationStock.id == item_id, MedicationStock.clinic_id == current_user.clinic_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Medication not found")
    return _with_vendor(db, item)


@router.put("/{item_id}", response_model=MedicationStockResponseDTO)
async def update_medication(
    item_id: int,
    payload: MedicationStockUpdateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_inventory_permission(current_user, "edit")
    item = db.query(MedicationStock).filter(
        MedicationStock.id == item_id, MedicationStock.clinic_id == current_user.clinic_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Medication not found")

    old_qty = item.quantity or 0.0
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(item, key, value)
    db.flush()
    delta = (item.quantity or 0.0) - old_qty
    if delta != 0:
        record_movement(db, clinic_id=item.clinic_id, item=item,
                        direction="in" if delta > 0 else "out", quantity=abs(delta),
                        action="restocked" if delta > 0 else "deducted",
                        note="Stock adjustment", adjust_stock=False, kind="medication")
    db.commit()
    db.refresh(item)
    return _with_vendor(db, item)


@router.delete("/{item_id}")
async def delete_medication(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_inventory_permission(current_user, "delete")
    item = db.query(MedicationStock).filter(
        MedicationStock.id == item_id, MedicationStock.clinic_id == current_user.clinic_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Medication not found")

    # Log removal, then detach ledger rows so the FK doesn't block the delete.
    db.add(InventoryTransaction(
        clinic_id=item.clinic_id, direction="out", action="removed",
        item_name=item.name, unit=item.unit, quantity=item.quantity or 0.0,
        note="Medication deleted",
    ))
    db.query(InventoryTransaction).filter(
        InventoryTransaction.medication_stock_id == item_id
    ).update({"medication_stock_id": None}, synchronize_session=False)

    db.delete(item)
    db.commit()
    return {"message": "Medication deleted successfully"}
