from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from database import get_db
from models import LabOrder, User, Patient, Vendor
from schemas import LabOrderCreate, LabOrderUpdate, LabOrderOut
from core.auth_utils import get_current_user
from typing import List, Optional

router = APIRouter(prefix="/lab-orders", tags=["lab-orders"])


def _lab_line_description(order: LabOrder) -> str:
    """Human-readable invoice line for a lab order, e.g.
    'Lab work: Crown (Tooth #46), Precision Dental Lab'."""
    desc = f"Lab work: {order.work_type}"
    if order.tooth_number:
        desc += f" (Tooth #{order.tooth_number})"
    vendor_name = order.vendor.name if order.vendor else None
    if vendor_name:
        desc += f", {vendor_name}"
    return desc


def _sync_lab_order_billing(db: Session, order: LabOrder, clinic_id: int, user_id=None):
    """Keep a lab order's line on the case paper's draft invoice in sync, the
    same way used stock and completed procedures accumulate onto one bill.
    Best-effort: if the linked invoice is no longer a draft we leave the line
    alone (it was already billed). Only bills orders tied to a case paper."""
    from domains.finance.routes.invoices import (
        get_or_create_draft_invoice, recalculate_invoice_totals,
    )
    from models import InvoiceLineItem, Invoice

    cost = float(order.cost or 0)
    desc = _lab_line_description(order)

    # Already has a line — update it in place (if its invoice is still editable).
    if order.invoice_line_item_id:
        line = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == order.invoice_line_item_id
        ).first()
        if line and line.invoice and line.invoice.status == 'draft':
            line.description = desc
            line.quantity = 1
            line.unit_price = cost
            line.amount = cost
            db.flush()
            recalculate_invoice_totals(db, line.invoice)
        return

    # No line yet — create one on the case paper's draft.
    if not order.case_paper_id:
        return
    inv = get_or_create_draft_invoice(db, clinic_id, order.patient_id, order.case_paper_id, created_by=user_id)
    line = InvoiceLineItem(invoice_id=inv.id, description=desc, quantity=1, unit_price=cost, amount=cost)
    db.add(line)
    db.flush()
    order.invoice_line_item_id = line.id
    recalculate_invoice_totals(db, inv)


def _remove_lab_order_billing(db: Session, order: LabOrder):
    """Drop a lab order's billed line when the order is deleted — but only while
    its invoice is still a draft; a finalised bill keeps the charge."""
    if not order.invoice_line_item_id:
        return
    from domains.finance.routes.invoices import recalculate_invoice_totals
    from models import InvoiceLineItem
    line = db.query(InvoiceLineItem).filter(
        InvoiceLineItem.id == order.invoice_line_item_id
    ).first()
    # Detach the order's reference FIRST — otherwise deleting the line below
    # violates the FK (the order still points at it).
    order.invoice_line_item_id = None
    db.flush()
    if line and line.invoice and line.invoice.status == 'draft':
        inv = line.invoice
        db.delete(line)
        db.flush()
        recalculate_invoice_totals(db, inv)

@router.get("", response_model=List[LabOrderOut])
def get_lab_orders(
    patient_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(LabOrder).filter(LabOrder.clinic_id == current_user.clinic_id)
    if patient_id:
        query = query.filter(LabOrder.patient_id == patient_id)
    if case_paper_id:
        query = query.filter(LabOrder.case_paper_id == case_paper_id)
    
    orders = query.order_by(LabOrder.created_at.desc()).all()
    
    # Enrichment for frontend display (names)
    for o in orders:
        o.patient_name = o.patient.name if o.patient else "Unknown"
        o.vendor_name = o.vendor.name if o.vendor else "Unknown"
        
    return orders

@router.post("", response_model=LabOrderOut)
def create_lab_order(
    order: LabOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_order = LabOrder(
        **order.model_dump(exclude={"clinic_id"}),
        clinic_id=current_user.clinic_id
    )
    db.add(db_order)
    db.flush()

    # Auto-bill onto the case paper's draft invoice (same bill as procedures/stock).
    _sync_lab_order_billing(db, db_order, current_user.clinic_id, user_id=current_user.id)

    db.commit()
    db.refresh(db_order)

    # Enrichment
    db_order.patient_name = db_order.patient.name if db_order.patient else "Unknown"
    db_order.vendor_name = db_order.vendor.name if db_order.vendor else "Unknown"

    return db_order

@router.put("/{order_id}", response_model=LabOrderOut)
def update_lab_order(
    order_id: int,
    order_update: LabOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Lab order not found")
        
    update_data = order_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_order, key, value)
    db.flush()

    # Keep the billed line in step with the order's new cost/work type, or bill
    # it now if it wasn't before (e.g. a case paper was attached).
    _sync_lab_order_billing(db, db_order, current_user.clinic_id, user_id=current_user.id)

    db.commit()
    db.refresh(db_order)

    db_order.patient_name = db_order.patient.name if db_order.patient else "Unknown"
    db_order.vendor_name = db_order.vendor.name if db_order.vendor else "Unknown"

    return db_order

@router.delete("/{order_id}")
def delete_lab_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    # Pull its charge off the draft invoice before removing the order.
    _remove_lab_order_billing(db, db_order)

    db.delete(db_order)
    db.commit()
    return {"message": "Lab order deleted successfully"}
