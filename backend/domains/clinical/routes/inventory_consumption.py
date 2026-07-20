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
from models import InventoryTransaction, InventoryItem, MedicationStock, User
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
    rows = q.order_by(InventoryTransaction.created_at.desc()).all()

    # Enrich each row with the invoice it was billed to (number + status), so the
    # case paper can show "added to bill INV-xxx (Draft/Finalized/Paid)".
    from models import InvoiceLineItem
    out = []
    for r in rows:
        dto = InventoryTransactionOut.from_orm(r)
        if r.invoice_line_item_id:
            line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == r.invoice_line_item_id).first()
            if line and line.invoice:
                dto.invoice_id = line.invoice.id
                dto.invoice_number = line.invoice.invoice_number
                dto.invoice_status = line.invoice.status
        out.append(dto)
    return out


@router.post("", response_model=InventoryTransactionOut)
def record_consumption(
    payload: InventoryConsumptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    # Either a general stock item or a medication stock item.
    is_med = payload.medication_stock_id is not None
    if is_med:
        item = db.query(MedicationStock).filter(
            MedicationStock.id == payload.medication_stock_id,
            MedicationStock.clinic_id == current_user.clinic_id,
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Medication not found")
    else:
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
        inventory_item_id=None if is_med else item.id,
        medication_stock_id=item.id if is_med else None,
        direction="out",
        action="used",
        item_name=item.name,
        unit=item.unit,
        quantity=payload.quantity,
    )
    # Decrement stock, floored at zero so a data slip can't drive it negative.
    item.quantity = max(0.0, (item.quantity or 0.0) - payload.quantity)

    db.add(record)
    db.flush()

    # Auto-bill: add a priced line to the case paper's draft invoice.
    if payload.case_paper_id:
        from domains.finance.routes.invoices import get_or_create_draft_invoice, recalculate_invoice_totals
        from models import InvoiceLineItem
        inv = get_or_create_draft_invoice(
            db, current_user.clinic_id, payload.patient_id, payload.case_paper_id, created_by=current_user.id
        )
        desc = item.name + (f" {item.strength}" if is_med and getattr(item, "strength", None) else "")
        price = float(getattr(item, "price_per_unit", 0) or 0)
        line = InvoiceLineItem(
            invoice_id=inv.id, description=desc,
            quantity=payload.quantity, unit_price=price, amount=payload.quantity * price,
        )
        db.add(line)
        db.flush()
        record.invoice_line_item_id = line.id
        recalculate_invoice_totals(db, inv)

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

    # Put the stock back on the still-existing item (general or medication).
    if record.inventory_item_id:
        item = db.query(InventoryItem).filter(
            InventoryItem.id == record.inventory_item_id,
            InventoryItem.clinic_id == current_user.clinic_id,
        ).first()
        if item:
            item.quantity = (item.quantity or 0.0) + (record.quantity or 0.0)
    elif record.medication_stock_id:
        med = db.query(MedicationStock).filter(
            MedicationStock.id == record.medication_stock_id,
            MedicationStock.clinic_id == current_user.clinic_id,
        ).first()
        if med:
            med.quantity = (med.quantity or 0.0) + (record.quantity or 0.0)

    # Remove the auto-billed line (if any) and recalc that invoice.
    if record.invoice_line_item_id:
        from domains.finance.routes.invoices import recalculate_invoice_totals
        from models import InvoiceLineItem
        line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == record.invoice_line_item_id).first()
        inv = line.invoice if line else None
        if line:
            db.delete(line)
            db.flush()
        if inv:
            db.expire(inv)
            recalculate_invoice_totals(db, inv)

    db.delete(record)
    db.commit()
    return {"message": "Consumption record deleted"}
