"""
Inventory usage recorded against a case paper — 'out' movements in the stock
ledger (see models.InventoryTransaction).

Recording use decrements the item's stock; deleting the record restores it.
Item name/unit are snapshotted so the record stays readable even if the item is
later renamed or removed.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import InventoryTransaction, InventoryItem, User
from schemas import InventoryConsumptionCreate, InventoryTransactionOut

router = APIRouter(prefix="/inventory-consumption", tags=["inventory-consumption"])


@router.get("", response_model=List[InventoryTransactionOut])
def list_consumption(
    patient_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InventoryTransaction).filter(
        InventoryTransaction.clinic_id == current_user.clinic_id,
        InventoryTransaction.direction == "out",
    )
    if patient_id:
        q = q.filter(InventoryTransaction.patient_id == patient_id)
    if case_paper_id:
        q = q.filter(InventoryTransaction.case_paper_id == case_paper_id)
    return q.order_by(InventoryTransaction.created_at.desc()).all()


@router.post("", response_model=InventoryTransactionOut)
def record_consumption(
    payload: InventoryConsumptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    item = db.query(InventoryItem).filter(
        InventoryItem.id == payload.inventory_item_id,
        InventoryItem.clinic_id == current_user.clinic_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    record = InventoryTransaction(
        clinic_id=current_user.clinic_id,
        patient_id=payload.patient_id,
        case_paper_id=payload.case_paper_id,
        inventory_item_id=item.id,
        direction="out",
        action="used",
        item_name=item.name,
        unit=item.unit,
        quantity=payload.quantity,
    )
    # Decrement stock, floored at zero so a data slip can't drive it negative.
    item.quantity = max(0.0, (item.quantity or 0.0) - payload.quantity)

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{consumption_id}")
def delete_consumption(
    consumption_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(InventoryTransaction).filter(
        InventoryTransaction.id == consumption_id,
        InventoryTransaction.clinic_id == current_user.clinic_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Consumption record not found")

    # Put the stock back on the still-existing item.
    if record.inventory_item_id:
        item = db.query(InventoryItem).filter(
            InventoryItem.id == record.inventory_item_id,
            InventoryItem.clinic_id == current_user.clinic_id,
        ).first()
        if item:
            item.quantity = (item.quantity or 0.0) + (record.quantity or 0.0)

    db.delete(record)
    db.commit()
    return {"message": "Consumption record deleted"}
