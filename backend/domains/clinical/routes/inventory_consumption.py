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

    # Auto-bill: add a priced line to the case paper's draft invoice — but only
    # when the user chose to bill it (add_to_billing). Otherwise it's recorded as
    # used (stock decremented) with no invoice line; they can bill it later.
    if payload.case_paper_id and payload.add_to_billing:
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


def _unbill_record(db: Session, record: InventoryTransaction):
    """Remove the invoice line this usage was billed to (if any) and recalc that
    invoice. Leaves the usage record and its stock movement intact."""
    if not record.invoice_line_item_id:
        return
    from domains.finance.routes.invoices import recalculate_invoice_totals
    from models import InvoiceLineItem
    line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == record.invoice_line_item_id).first()
    inv = line.invoice if line else None
    # Break the FK from this usage record to the line FIRST, then delete the line
    # — otherwise Postgres blocks the delete (inventory_transactions still refs it).
    record.invoice_line_item_id = None
    db.flush()
    if line:
        db.delete(line)
        db.flush()
    if inv:
        db.expire(inv)
        recalculate_invoice_totals(db, inv)


@router.delete("/{consumption_id}")
def delete_consumption(
    consumption_id: int,
    mode: str = "entirely",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a case-paper stock usage record.

    mode='entirely'     — delete the record, restore its quantity to stock, and
                          remove any billed line (full undo of the usage).
    mode='billing_only' — keep the usage recorded (stock stays consumed) but drop
                          it from the bill.
    """
    record = db.query(InventoryTransaction).filter(
        InventoryTransaction.id == consumption_id,
        InventoryTransaction.clinic_id == current_user.clinic_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Consumption record not found")

    # Once billed onto a finalized/paid invoice the charge is locked — the line
    # can't be pulled without editing that bill. Block removal from here.
    if record.invoice_line_item_id:
        from models import InvoiceLineItem
        line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == record.invoice_line_item_id).first()
        if line and line.invoice and line.invoice.status != 'draft':
            raise HTTPException(
                status_code=400,
                detail="This item is billed on a finalized or paid invoice and can't be removed here.",
            )

    if mode == "billing_only":
        # Unbill only — the item stays recorded as used and stock stays consumed.
        _unbill_record(db, record)
        db.commit()
        return {"message": "Removed from bill; usage kept"}

    # mode == "entirely": put stock back, remove the billed line, delete the record.
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

    _unbill_record(db, record)
    db.delete(record)
    db.commit()
    return {"message": "Consumption record deleted"}


@router.post("/{consumption_id}/bill", response_model=InventoryTransactionOut)
def bill_consumption(
    consumption_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an already-recorded usage to its case paper's draft invoice (the
    "bill it later" path for items recorded without billing). Idempotent-ish: a
    record already billed is returned unchanged."""
    record = db.query(InventoryTransaction).filter(
        InventoryTransaction.id == consumption_id,
        InventoryTransaction.clinic_id == current_user.clinic_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Consumption record not found")
    if record.invoice_line_item_id:
        return record  # already billed
    if not record.case_paper_id:
        raise HTTPException(status_code=400, detail="Usage is not tied to a case paper")

    # Price from the still-existing item; falls back to 0 if it was removed.
    is_med = record.medication_stock_id is not None
    if is_med:
        item = db.query(MedicationStock).filter(MedicationStock.id == record.medication_stock_id).first()
    else:
        item = db.query(InventoryItem).filter(InventoryItem.id == record.inventory_item_id).first()

    from domains.finance.routes.invoices import get_or_create_draft_invoice, recalculate_invoice_totals
    from models import InvoiceLineItem
    inv = get_or_create_draft_invoice(
        db, current_user.clinic_id, record.patient_id, record.case_paper_id, created_by=current_user.id
    )
    desc = record.item_name + (f" {item.strength}" if is_med and item and getattr(item, "strength", None) else "")
    price = float(getattr(item, "price_per_unit", 0) or 0) if item else 0.0
    line = InvoiceLineItem(
        invoice_id=inv.id, description=desc,
        quantity=record.quantity, unit_price=price, amount=(record.quantity or 0) * price,
    )
    db.add(line)
    db.flush()
    record.invoice_line_item_id = line.id
    recalculate_invoice_totals(db, inv)
    db.commit()
    db.refresh(record)
    return record
