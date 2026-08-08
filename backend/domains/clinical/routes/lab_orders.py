import logging

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from database import get_db
from models import LabOrder, User, Patient, Vendor, Clinic
from schemas import LabOrderCreate, LabOrderUpdate, LabOrderOut
from core.auth_utils import get_current_user
from typing import List, Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lab-orders", tags=["lab-orders"])


def _notify_vendor_of_order(db: Session, order: LabOrder, clinic_id: int):
    """Tell the lab a new work order was placed.

    Off by default — it only fires when the clinic enables `lab_order_placed`
    in Notifications → Preferences (notify_event returns early otherwise).

    Never raises. A lab order must save even when the lab has no contact
    details, the wallet is empty, or Nexus is down.
    """
    try:
        vendor = order.vendor
        if not vendor:
            return
        # Nothing to send to — a vendor's email and phone are both optional.
        if not (vendor.email or vendor.phone):
            logger.info(f"lab_order_placed: vendor {vendor.id} has no email or phone, skipping")
            return

        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            return

        from core.notification_dispatch import notify_event

        notify_event(
            "lab_order_placed",
            db=db,
            clinic_id=clinic_id,
            to_phone=vendor.phone or "",
            to_email=vendor.email or "",
            to_name=vendor.contact_name or vendor.name or "",
            template_data={
                "clinic_name": clinic.name or "",
                "clinic_logo_url": clinic.logo_url or "",
                "clinic_phone": clinic.phone or "",
                "lab_name": vendor.contact_name or vendor.name or "",
                "work_type": order.work_type or "",
                "patient_name": order.patient.name if order.patient else "",
                "tooth_number": order.tooth_number or "",
                "shade": order.shade or "",
                "due_date": order.due_date.strftime("%d %b %Y") if order.due_date else "",
                "instructions": order.instructions or "",
            },
        )
    except Exception as exc:
        # Includes InsufficientWalletBalance — a low wallet must not block the order.
        logger.warning(f"lab_order_placed notify failed for order {order.id}: {exc}")


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


def _sync_lab_order_billing(db: Session, order: LabOrder, clinic_id: int, user_id=None, create_if_missing=False):
    """Keep a lab order's line on the case paper's draft invoice in sync.

    An existing draft line is always kept in step with the order's cost/work
    type. A NEW line is only created when `create_if_missing` is set (i.e. the
    user opted the order into billing) — lab orders are not billed by default.
    If the linked invoice is no longer a draft, the line is left alone."""
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

    # No line yet — only create one when explicitly billing, and only for a
    # case-paper order.
    if not create_if_missing or not order.case_paper_id:
        return
    inv = get_or_create_draft_invoice(db, clinic_id, order.patient_id, order.case_paper_id, created_by=user_id)
    line = InvoiceLineItem(invoice_id=inv.id, description=desc, quantity=1, unit_price=cost, amount=cost)
    db.add(line)
    db.flush()
    order.invoice_line_item_id = line.id
    recalculate_invoice_totals(db, inv)


def _lab_billing_locked(db: Session, order: LabOrder) -> bool:
    """True when the order is billed onto an invoice that's past draft, so its
    charge can no longer be changed from the case paper."""
    if not order.invoice_line_item_id:
        return False
    from models import InvoiceLineItem
    line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == order.invoice_line_item_id).first()
    return bool(line and line.invoice and line.invoice.status != 'draft')


def _enrich_lab_order(db: Session, order: LabOrder):
    """Attach display names + the bill this order sits on (number + status)."""
    order.patient_name = order.patient.name if order.patient else "Unknown"
    order.vendor_name = order.vendor.name if order.vendor else "Unknown"
    order.invoice_id = None
    order.invoice_number = None
    order.invoice_status = None
    if order.invoice_line_item_id:
        from models import InvoiceLineItem
        line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == order.invoice_line_item_id).first()
        if line and line.invoice:
            order.invoice_id = line.invoice.id
            order.invoice_number = line.invoice.invoice_number
            order.invoice_status = line.invoice.status
    return order


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

    # Enrichment for frontend display (names + the bill it's on).
    for o in orders:
        _enrich_lab_order(db, o)

    return orders

@router.post("", response_model=LabOrderOut)
def create_lab_order(
    order: LabOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = order.model_dump(exclude={"clinic_id", "add_to_billing"})
    db_order = LabOrder(**data, clinic_id=current_user.clinic_id)
    db.add(db_order)
    db.flush()

    # Only bill it onto the case paper's draft invoice when the user opted in.
    if order.add_to_billing:
        _sync_lab_order_billing(db, db_order, current_user.clinic_id, user_id=current_user.id, create_if_missing=True)

    db.commit()
    db.refresh(db_order)

    # Only after the order is safely committed — the lab shouldn't hear about
    # an order that failed to save. And only for a placed order ('Sent'); a
    # Draft is still being prepared and mustn't ping the lab.
    if db_order.status == 'Sent':
        _notify_vendor_of_order(db, db_order, current_user.clinic_id)

    _enrich_lab_order(db, db_order)
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
    want_billing = update_data.pop("add_to_billing", None)  # None = leave as-is
    currently_billed = bool(db_order.invoice_line_item_id)

    # Only a CHANGE to the billing state is blocked when the invoice is locked;
    # editing other fields on a billed-and-paid order is still fine.
    if want_billing is not None and want_billing != currently_billed and _lab_billing_locked(db, db_order):
        raise HTTPException(
            status_code=400,
            detail="This order is billed on a finalized or paid invoice and can't be changed here.",
        )

    prev_status = db_order.status
    for key, value in update_data.items():
        setattr(db_order, key, value)
    db.flush()

    if want_billing is False and currently_billed:
        # Opted out of billing — pull its draft line (keeps the lab order).
        _remove_lab_order_billing(db, db_order)
    else:
        # Keep an existing draft line in step; create one only if opting in now.
        _sync_lab_order_billing(
            db, db_order, current_user.clinic_id, user_id=current_user.id,
            create_if_missing=bool(want_billing),
        )

    db.commit()
    db.refresh(db_order)

    # Notify the lab the moment the order transitions into 'Sent' (e.g. a Draft
    # that's now been placed). Re-saving an already-Sent order won't re-ping.
    if prev_status != 'Sent' and db_order.status == 'Sent':
        _notify_vendor_of_order(db, db_order, current_user.clinic_id)

    _enrich_lab_order(db, db_order)
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
