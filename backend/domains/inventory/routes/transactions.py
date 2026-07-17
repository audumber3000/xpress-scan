"""
Inventory ledger — the full stock-movement history for a clinic.

Lists every movement (usage from visits + manual entries), lets staff record
manual in/out transactions, and delete a row (reversing its stock effect).
Shares the InventoryTransaction table with the case-paper usage endpoint.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from core.auth_utils import get_current_user
from database import get_db
from models import InventoryTransaction, InventoryItem, Patient, User
from schemas import InventoryTransactionCreate, InventoryTransactionOut

router = APIRouter(prefix="/inventory/transactions", tags=["inventory-transactions"])


def _to_out(txn: InventoryTransaction) -> InventoryTransactionOut:
    dto = InventoryTransactionOut.from_orm(txn)
    dto.patient_name = txn.patient.name if txn.patient else None
    return dto


@router.get("", response_model=List[InventoryTransactionOut])
def list_transactions(
    inventory_item_id: Optional[int] = None,
    direction: Optional[str] = Query(None, pattern="^(in|out)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(InventoryTransaction)
        .options(joinedload(InventoryTransaction.patient))
        .filter(InventoryTransaction.clinic_id == current_user.clinic_id)
    )
    if inventory_item_id:
        q = q.filter(InventoryTransaction.inventory_item_id == inventory_item_id)
    if direction:
        q = q.filter(InventoryTransaction.direction == direction)
    rows = q.order_by(InventoryTransaction.created_at.desc()).limit(limit).all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=InventoryTransactionOut)
def create_transaction(
    payload: InventoryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.direction not in ("in", "out"):
        raise HTTPException(status_code=400, detail="direction must be 'in' or 'out'")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    item = db.query(InventoryItem).filter(
        InventoryItem.id == payload.inventory_item_id,
        InventoryItem.clinic_id == current_user.clinic_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Optional patient must belong to this clinic.
    if payload.patient_id:
        pat = db.query(Patient).filter(
            Patient.id == payload.patient_id,
            Patient.clinic_id == current_user.clinic_id,
        ).first()
        if not pat:
            raise HTTPException(status_code=404, detail="Patient not found")

    txn = InventoryTransaction(
        clinic_id=current_user.clinic_id,
        patient_id=payload.patient_id,
        inventory_item_id=item.id,
        direction=payload.direction,
        item_name=item.name,
        unit=item.unit,
        quantity=payload.quantity,
        note=(payload.note or None),
    )
    # 'in' adds to stock, 'out' subtracts (floored at zero).
    if payload.direction == "in":
        item.quantity = (item.quantity or 0.0) + payload.quantity
    else:
        item.quantity = max(0.0, (item.quantity or 0.0) - payload.quantity)

    db.add(txn)
    db.commit()
    db.refresh(txn)
    return _to_out(txn)


@router.delete("/{txn_id}")
def delete_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(InventoryTransaction).filter(
        InventoryTransaction.id == txn_id,
        InventoryTransaction.clinic_id == current_user.clinic_id,
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Reverse the stock effect on the still-existing item.
    if txn.inventory_item_id:
        item = db.query(InventoryItem).filter(
            InventoryItem.id == txn.inventory_item_id,
            InventoryItem.clinic_id == current_user.clinic_id,
        ).first()
        if item:
            if txn.direction == "in":
                item.quantity = max(0.0, (item.quantity or 0.0) - (txn.quantity or 0.0))
            else:
                item.quantity = (item.quantity or 0.0) + (txn.quantity or 0.0)

    db.delete(txn)
    db.commit()
    return {"message": "Transaction deleted"}
