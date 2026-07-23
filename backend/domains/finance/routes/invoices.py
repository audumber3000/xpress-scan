from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, text
from typing import List, Optional
from datetime import datetime, date, timedelta
from domains.finance.invoice_pdf_engine import generate_invoice_html
import os
import csv
import io
import requests
import re

from database import SessionLocal
from core.notification_dispatch import notify_event
from core.posthog_client import track_event, EVENTS

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from models import Invoice, InvoiceLineItem, InvoiceAuditLog, InvoiceDiscount, Patient, User, Clinic, Appointment
from core.auth_utils import get_current_user
from core.clinic_time import clinic_today, clinic_day_bounds_utc, clinic_now, clinic_tzinfo
from zoneinfo import ZoneInfo
from schemas import (
    InvoiceOut, InvoiceLineItemCreate, InvoiceLineItemOut,
    MarkAsPaidRequest, InvoiceCreate, InvoicePaymentCreate, ProcedureChargeCreate,
    InvoiceDiscountCreate
)
from domains.infrastructure.services.pdf_service import html_template_to_pdf
from domains.infrastructure.services.r2_storage import upload_pdf_to_r2

router = APIRouter()

def _ensure_invoice_columns(db: Session):
    """No-op. Previously ran inline ALTER TABLE on every fresh worker process,
    which acquired ACCESS EXCLUSIVE locks on `invoices` from inside request
    handlers. Under concurrent load this deadlocked the connection pool
    (prod incident 2026-05-02). The columns (finalized_at, paid_amount,
    due_amount) now exist permanently and are declared in models.py;
    future schema changes go through the migration block in deploy.sh.
    Call sites are kept as no-op calls so we don't have to touch every
    route handler — safe to remove entirely in a later cleanup."""
    return

def _recorded_on(clinic, payment):
    """The clinic-local date a payment was entered into the system.

    created_at is stored as naive UTC, so it has to be shifted into the clinic's
    timezone before being called a date — otherwise an evening entry in India
    reports as the previous day.
    """
    if not payment.created_at:
        return None
    tz = clinic_tzinfo(clinic)
    return payment.created_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz).date()


def _is_back_dated(clinic, payment) -> bool:
    """True when the money is dated earlier than the day it was written down."""
    rec = _recorded_on(clinic, payment)
    return bool(payment.paid_on and rec and payment.paid_on < rec)


def post_issue_discount_total(invoice: Invoice) -> float:
    """Sum of concessions granted after this invoice was issued (already resolved
    to currency at the time each was applied)."""
    return sum(float(d.amount or 0) for d in getattr(invoice, 'post_issue_discounts', []) or [])


def enrich_invoice(db: Session, invoice: Invoice):
    """Enrich invoice with related data"""
    total_amount = float(invoice.total or 0)
    paid_amount = float(getattr(invoice, 'paid_amount', 0) or 0)
    due_amount = getattr(invoice, 'due_amount', None)
    if due_amount is None:
        due_amount = max(0.0, total_amount - paid_amount)

    # Which of this invoice's lines are billed from a case-paper stock usage
    # record (one batched lookup, so the editor can offer restock-on-delete).
    from models import InventoryTransaction
    _line_ids = [li.id for li in invoice.line_items]
    _stock_linked_line_ids = set()
    if _line_ids:
        _stock_linked_line_ids = {
            r[0] for r in db.query(InventoryTransaction.invoice_line_item_id)
            .filter(InventoryTransaction.invoice_line_item_id.in_(_line_ids)).all()
        }

    invoice_dict = {
        'id': invoice.id,
        'clinic_id': invoice.clinic_id,
        'patient_id': invoice.patient_id,
        'patient_name': invoice.patient.name if invoice.patient else None,
        'patient_phone': invoice.patient.phone if invoice.patient else None,
        'patient_display_id': invoice.patient.display_id if invoice.patient else None,
        'invoice_number': invoice.invoice_number,
        'status': invoice.status,
        'payment_mode': invoice.payment_mode,
        'utr': invoice.utr,
        'appointment_id': invoice.appointment_id,
        'case_paper_id': getattr(invoice, 'case_paper_id', None),
        'subtotal': invoice.subtotal,
        'tax': invoice.tax,
        'discount': invoice.discount or 0.0,
        'discount_type': invoice.discount_type or 'amount',
        'discount_amount': invoice.discount_amount or 0.0,
        # Concessions granted after issue, newest first. `discount_amount` above
        # is the combined deduction; this is the itemised, dated breakdown.
        'post_issue_discounts': [
            {
                'id': d.id,
                'value': float(d.value or 0),
                'discount_type': d.discount_type or 'amount',
                'amount': float(d.amount or 0),
                'reason': d.reason,
                'applied_by_name': (d.user.name if d.user and getattr(d.user, 'name', None) else None),
                'applied_at': d.applied_at.isoformat() if d.applied_at else None,
            }
            for d in sorted(
                getattr(invoice, 'post_issue_discounts', []) or [],
                key=lambda x: (x.applied_at or datetime.min),
                reverse=True,
            )
        ],
        'post_issue_discount_total': post_issue_discount_total(invoice),
        'total': invoice.total,
        'notes': invoice.notes,
        'created_by': invoice.created_by,
        'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
        'updated_at': invoice.updated_at.isoformat() if invoice.updated_at else None,
        'synced_at': getattr(invoice, 'synced_at', None).isoformat() if getattr(invoice, 'synced_at', None) else None,
        'sync_status': getattr(invoice, 'sync_status', 'local'),
        'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None,
        'finalized_at': getattr(invoice, 'finalized_at', None).isoformat() if getattr(invoice, 'finalized_at', None) else None,
        'paid_amount': paid_amount,
        'due_amount': float(due_amount or 0),
        'line_items': [
            {
                'id': item.id,
                'invoice_id': item.invoice_id,
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'amount': item.amount,
                'created_at': item.created_at.isoformat() if item.created_at else None,
                'updated_at': getattr(item, 'updated_at', item.created_at).isoformat() if getattr(item, 'updated_at', item.created_at) else None,
                'synced_at': getattr(item, 'synced_at', None).isoformat() if getattr(item, 'synced_at', None) else None,
                'sync_status': getattr(item, 'sync_status', 'local'),
                # True when a case-paper stock usage record bills to this line, so
                # the editor can offer "remove from bill only" vs "restock too".
                'linked_stock': item.id in _stock_linked_line_ids,
            }
            for item in invoice.line_items
        ],
        # Itemised partial-payment history (newest first). paid_amount above is
        # the authoritative running total; this list is the breakdown.
        'payments': [
            {
                'id': p.id,
                'invoice_id': p.invoice_id,
                'amount': float(p.amount or 0),
                'paid_on': p.paid_on.isoformat() if p.paid_on else None,
                'method': p.method,
                'note': p.note,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                # When it was actually entered, and whether that was later than
                # the day the money changed hands.
                'recorded_on': _recorded_on(invoice.clinic, p).isoformat() if p.created_at else None,
                'is_back_dated': _is_back_dated(invoice.clinic, p),
            }
            for p in sorted(invoice.payments, key=lambda x: (x.paid_on or x.created_at), reverse=True)
        ]
    }
    return invoice_dict

def recalculate_invoice_totals(db: Session, invoice: Invoice):
    """Recalculate invoice subtotal, tax, discount, and total"""
    subtotal = sum(item.amount for item in invoice.line_items)

    # Calculate discount
    discount_amount = 0.0
    if hasattr(invoice, 'discount') and invoice.discount and invoice.discount > 0:
        if invoice.discount_type == 'percentage':
            discount_amount = subtotal * (invoice.discount / 100)
        else:
            discount_amount = invoice.discount

    # Concessions granted after the invoice was issued are already resolved to
    # currency, so they simply add to the deduction.
    discount_amount += post_issue_discount_total(invoice)

    # Cap discount
    if discount_amount > subtotal:
        discount_amount = subtotal

    tax = 0.0  # Can add tax calculation logic here (e.g., GST)
    total = subtotal - discount_amount + tax
    
    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.tax = tax
    invoice.total = total

    current_paid = float(getattr(invoice, 'paid_amount', 0) or 0)
    if invoice.status in ['paid_unverified', 'paid_verified']:
        invoice.paid_amount = max(current_paid, total)
        invoice.due_amount = 0.0
    elif invoice.status == 'partially_paid':
        normalized_paid = min(max(current_paid, 0.0), total)
        invoice.paid_amount = normalized_paid
        invoice.due_amount = max(total - normalized_paid, 0.0)
    else:
        invoice.paid_amount = 0.0
        invoice.due_amount = max(total, 0.0)

def generate_invoice_number(db: Session, clinic_id: int) -> str:
    """Next INV-YYYY-#### for the clinic."""
    year = datetime.utcnow().year
    last = (
        db.query(Invoice)
        .filter(Invoice.clinic_id == clinic_id, Invoice.invoice_number.like(f"INV-{year}-%"))
        .order_by(desc(Invoice.invoice_number))
        .first()
    )
    n = 1
    if last:
        try:
            n = int(last.invoice_number.split('-')[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    return f"INV-{year}-{n:04d}"


def get_or_create_draft_invoice(db: Session, clinic_id: int, patient_id: int, case_paper_id, created_by=None) -> Invoice:
    """The case paper's current draft invoice, created if none. This is the one
    bill that procedures and used/dispensed stock both accumulate into."""
    inv = (
        db.query(Invoice)
        .filter(
            Invoice.clinic_id == clinic_id,
            Invoice.case_paper_id == case_paper_id,
            Invoice.status == 'draft',
        )
        .order_by(desc(Invoice.id))
        .first()
    )
    if inv:
        return inv
    inv = Invoice(
        clinic_id=clinic_id, patient_id=patient_id, case_paper_id=case_paper_id,
        invoice_number=generate_invoice_number(db, clinic_id), status='draft',
        subtotal=0.0, tax=0.0, total=0.0, paid_amount=0.0, due_amount=0.0,
        created_by=created_by,
    )
    db.add(inv)
    db.flush()
    return inv


def sync_invoice_from_payments(invoice: Invoice):
    """Recompute paid/due/status from the sum of the invoice's payment rows —
    the single source of truth once itemised payments exist."""
    paid = sum(float(p.amount or 0) for p in invoice.payments)
    total = float(invoice.total or 0)
    invoice.paid_amount = paid
    invoice.due_amount = max(total - paid, 0.0)

    if invoice.status in ('draft', 'cancelled'):
        return  # don't change lifecycle state for unfinalised/cancelled invoices
    if paid <= 0:
        invoice.status = 'finalized'
        invoice.paid_at = None
    elif paid < total:
        invoice.status = 'partially_paid'
        invoice.paid_at = None
    else:
        # Fully paid — preserve a verified status if already set.
        if invoice.status != 'paid_verified':
            invoice.status = 'paid_unverified'
        if not invoice.paid_at:
            invoice.paid_at = datetime.utcnow()


def create_audit_log(
    db: Session,
    invoice_id: int,
    user_id: int,
    action: str,
    old_values: dict = None,
    new_values: dict = None,
    notes: str = None
):
    """Create an audit log entry"""
    audit_log = InvoiceAuditLog(
        invoice_id=invoice_id,
        action=action,
        user_id=user_id,
        old_values=old_values,
        new_values=new_values,
        notes=notes
    )
    db.add(audit_log)

@router.post("", response_model=InvoiceOut)
async def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new manual invoice"""
    try:
        _ensure_invoice_columns(db)
        # Check if patient exists in this clinic
        patient = db.query(Patient).filter(
            Patient.id == invoice_data.patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Resolve the appointment link, drop it silently if stale.
        # The FK is nullable — invoice ↔ appointment is optional — so a deleted
        # or wrong-clinic appointment_id should produce an unlinked invoice
        # rather than a 500 ForeignKeyViolation.
        appointment_id = invoice_data.appointment_id
        if appointment_id is not None:
            exists = db.query(Appointment.id).filter(
                Appointment.id == appointment_id,
                Appointment.clinic_id == current_user.clinic_id
            ).first()
            if not exists:
                appointment_id = None

        # Generate generic invoice number
        year = datetime.utcnow().year
        last_invoice = db.query(Invoice).filter(
            Invoice.clinic_id == current_user.clinic_id,
            Invoice.invoice_number.like(f"INV-{year}-%")
        ).order_by(desc(Invoice.invoice_number)).first()
        
        if last_invoice:
            try:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
            
        invoice_number = f"INV-{year}-{new_num:04d}"
        
        invoice = Invoice(
            clinic_id=current_user.clinic_id,
            patient_id=invoice_data.patient_id,
            appointment_id=appointment_id,
            case_paper_id=invoice_data.case_paper_id,
            invoice_number=invoice_number,
            status='draft',
            subtotal=0.0,
            tax=0.0,
            total=0.0,
            paid_amount=0.0,
            due_amount=0.0,
            notes=invoice_data.notes
        )
        db.add(invoice)
        db.flush()
        
        create_audit_log(db, invoice.id, current_user.id, 'created')

        # Billing a patient means they were in the clinic, so they belong in the
        # day's register even when reception never entered them. Idempotent per
        # patient per day. Best-effort: never block raising a bill.
        try:
            from domains.patient.routes.daily_register import record_daily_visit
            reg_clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            if reg_clinic and patient:
                record_daily_visit(db, reg_clinic, patient, source='invoice', created_by=current_user.id)
        except Exception as e:
            print(f"⚠️ Could not add invoice {invoice.id} to the daily register: {e}")

        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating invoice: {str(e)}")

INVOICE_STATUS_LABELS = {
    "draft": "Draft", "finalized": "Finalized", "partially_paid": "Partially Paid",
    "paid_verified": "Paid", "paid_unverified": "Paid (Unverified)", "cancelled": "Cancelled",
}


def _filtered_invoices_query(
    db: Session, clinic_id: int, *,
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    search: Optional[str] = None,
    payment_mode: Optional[str] = None,
    created_from: Optional[datetime] = None,
    created_to: Optional[datetime] = None,
):
    """Build the invoice query with the shared list/count filters.

    Kept in one place so the list endpoint and the count endpoint always agree,
    which is what makes server-side pagination land on the right total.

    `created_from`/`created_to` are naive UTC datetime bounds (end is exclusive)
    for the invoice date range; the caller resolves them from clinic-local dates.
    """
    query = db.query(Invoice).filter(Invoice.clinic_id == clinic_id)

    if status:
        query = query.filter(Invoice.status == status)
    if patient_id:
        query = query.filter(Invoice.patient_id == patient_id)
    if appointment_id:
        query = query.filter(Invoice.appointment_id == appointment_id)
    if case_paper_id:
        query = query.filter(Invoice.case_paper_id == case_paper_id)
    if payment_mode:
        query = query.filter(Invoice.payment_mode.ilike(payment_mode))
    if created_from is not None:
        query = query.filter(Invoice.created_at >= created_from)
    if created_to is not None:
        query = query.filter(Invoice.created_at < created_to)

    # Search matches the invoice number or the patient's name / phone. Requires
    # 2+ chars (mirrors the patient list) so a single keystroke doesn't scan all.
    if search and len(search.strip()) >= 2:
        like = f"%{search.strip()}%"
        query = query.outerjoin(Patient, Invoice.patient_id == Patient.id).filter(
            or_(
                Invoice.invoice_number.ilike(like),
                Patient.name.ilike(like),
                Patient.phone.ilike(like),
            )
        )

    return query


def _resolve_date_bounds(db: Session, clinic_id: int, date_from: Optional[str], date_to: Optional[str]):
    """Parse YYYY-MM-DD clinic-local dates into naive UTC (start, end-exclusive) bounds."""
    if not date_from and not date_to:
        return None, None
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    return clinic_day_bounds_utc(clinic, d_from, d_to)


@router.get("/count")
async def count_invoices(
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    search: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD, invoice date (clinic tz)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD, invoice date (clinic tz)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Total invoices matching the same filters as the list (for pagination)."""
    try:
        _ensure_invoice_columns(db)
        created_from, created_to = _resolve_date_bounds(db, current_user.clinic_id, date_from, date_to)
        query = _filtered_invoices_query(
            db, current_user.clinic_id,
            status=status, patient_id=patient_id, appointment_id=appointment_id,
            case_paper_id=case_paper_id, search=search, payment_mode=payment_mode,
            created_from=created_from, created_to=created_to,
        )
        total = query.with_entities(func.count(Invoice.id)).scalar() or 0
        return {"total": int(total)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting invoices: {str(e)}")


@router.get("/collections")
async def get_collections(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD, default today"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD, default = date_from"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Payments actually received in a date window (default: today).

    Keyed on InvoicePayment.paid_on, so a partial paid today against an older
    invoice still counts as today's money in. Powers the Today's Collection tab.
    """
    from models import InvoicePayment
    _ensure_invoice_columns(db)
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    today = clinic_today(clinic)
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else today
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else d_from
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    rows = (
        db.query(InvoicePayment, Invoice, Patient)
        .join(Invoice, InvoicePayment.invoice_id == Invoice.id)
        .outerjoin(Patient, Invoice.patient_id == Patient.id)
        .filter(
            InvoicePayment.clinic_id == current_user.clinic_id,
            InvoicePayment.paid_on >= d_from,
            InvoicePayment.paid_on <= d_to,
        )
        .order_by(desc(InvoicePayment.paid_on), desc(InvoicePayment.id))
        .all()
    )

    # Same window a week earlier, so "today" is judged against the same weekday
    # rather than against yesterday — a Saturday and a Tuesday are not comparable
    # in a clinic. Amounts only; the previous week's entries aren't listed.
    p_from, p_to = d_from - timedelta(days=7), d_to - timedelta(days=7)
    prev_rows = (
        db.query(InvoicePayment.amount, InvoicePayment.method)
        .filter(
            InvoicePayment.clinic_id == current_user.clinic_id,
            InvoicePayment.paid_on >= p_from,
            InvoicePayment.paid_on <= p_to,
        )
        .all()
    )
    prev_total = prev_cash = prev_online = 0.0
    for amount, method in prev_rows:
        amt = float(amount or 0)
        prev_total += amt
        if (method or "").strip().lower() == "cash":
            prev_cash += amt
        else:
            prev_online += amt

    # What each of these invoices was for, so the collection list can say what
    # the money bought instead of repeating the patient's phone number. One
    # batched query rather than a lookup per row.
    items_by_invoice = {}
    inv_ids = list({inv.id for _, inv, _ in rows})
    if inv_ids:
        for li_invoice_id, li_desc, li_qty in (
            db.query(InvoiceLineItem.invoice_id, InvoiceLineItem.description, InvoiceLineItem.quantity)
            .filter(InvoiceLineItem.invoice_id.in_(inv_ids))
            .order_by(InvoiceLineItem.id)
            .all()
        ):
            items_by_invoice.setdefault(li_invoice_id, []).append({
                'description': li_desc,
                'quantity': float(li_qty or 1),
            })

    entries = []
    total = cash = online = 0.0
    for pay, inv, pat in rows:
        amt = float(pay.amount or 0)
        total += amt
        if (pay.method or "").strip().lower() == "cash":
            cash += amt
        else:
            online += amt
        entries.append({
            "payment_id": pay.id,
            "amount": amt,
            "method": pay.method,
            "paid_on": pay.paid_on.isoformat() if pay.paid_on else None,
            "created_at": pay.created_at.isoformat() if pay.created_at else None,
            "note": pay.note,
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_status": inv.status,
            "patient_id": pat.id if pat else None,
            "patient_name": pat.name if pat else None,
            "patient_phone": pat.phone if pat else None,
            "patient_display_id": pat.display_id if pat else None,
            "items": items_by_invoice.get(inv.id, []),
        })

    return {
        "entries": entries,
        "total": round(total, 2),
        "cash": round(cash, 2),
        "online": round(online, 2),
        "count": len(entries),
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "previous": {
            "total": round(prev_total, 2),
            "cash": round(prev_cash, 2),
            "online": round(prev_online, 2),
            "count": len(prev_rows),
            "date_from": p_from.isoformat(),
            "date_to": p_to.isoformat(),
        },
    }


@router.get("/export")
async def export_invoices(
    status: Optional[str] = Query(None, description="all | unpaid | partial | paid"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD (invoice date)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD (invoice date)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download filtered invoices as CSV, one row per invoice, with patient and
    payment details. Status maps: unpaid = nothing paid, partial = partially_paid,
    paid = fully paid. Date range filters the invoice creation date (inclusive)."""
    _ensure_invoice_columns(db)
    query = db.query(Invoice).filter(Invoice.clinic_id == current_user.clinic_id)

    try:
        if date_from:
            query = query.filter(Invoice.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
        if date_to:
            query = query.filter(Invoice.created_at < datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    s = (status or "all").lower()
    if s == "unpaid":
        query = query.filter(Invoice.status != "cancelled", func.coalesce(Invoice.paid_amount, 0) == 0)
    elif s == "partial":
        query = query.filter(Invoice.status == "partially_paid")
    elif s == "paid":
        query = query.filter(Invoice.status.in_(["paid_verified", "paid_unverified"]))

    invoices = query.order_by(desc(Invoice.created_at)).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Invoice Number", "Date", "Patient ID", "Patient Name", "Phone",
        "Work Done", "Status", "Subtotal", "Discount", "Discount After Issue",
        "Tax", "Total", "Paid", "Due", "Fully Settled", "Payment Count",
        "First Payment", "Last Payment", "Payment Mode", "UTR / Ref",
        "Payments", "Notes",
    ])
    for inv in invoices:
        pat = inv.patient
        total = float(inv.total or 0)
        paid = float(inv.paid_amount or 0)
        due = float(inv.due_amount if inv.due_amount is not None else max(0.0, total - paid))
        pays = sorted(inv.payments or [], key=lambda p: (p.paid_on or date.min))
        pay_summary = "; ".join(
            f"{(p.paid_on.isoformat() if p.paid_on else '?')}: {float(p.amount or 0):.2f}"
            + (f" ({p.method})" if p.method else "")
            for p in pays
        )
        # What the bill was for, so the export explains itself without a second
        # lookup against the invoice.
        work = "; ".join(
            f"{li.description} x {float(li.quantity or 1):g}" if float(li.quantity or 1) > 1
            else str(li.description)
            for li in (inv.line_items or [])
        ) or "-"
        post_issue = post_issue_discount_total(inv)
        writer.writerow([
            inv.invoice_number,
            inv.created_at.strftime("%Y-%m-%d") if inv.created_at else "",
            (pat.display_id if pat else "") or "",
            (pat.name if pat else "") or "",
            (pat.phone if pat else "") or "",
            work,
            INVOICE_STATUS_LABELS.get(inv.status, inv.status),
            f"{float(inv.subtotal or 0):.2f}",
            f"{float(inv.discount_amount or 0):.2f}",
            f"{post_issue:.2f}",
            f"{float(inv.tax or 0):.2f}",
            f"{total:.2f}", f"{paid:.2f}", f"{due:.2f}",
            "Yes" if due <= 0 and paid > 0 else "No",
            len(pays),
            pays[0].paid_on.isoformat() if pays and pays[0].paid_on else "",
            pays[-1].paid_on.isoformat() if pays and pays[-1].paid_on else "",
            inv.payment_mode or "",
            inv.utr or "",
            pay_summary,
            (inv.notes or "").replace("\n", " "),
        ])

    filename = f"invoices_{s}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/collections/export")
async def export_collections(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD, default today"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD, default = date_from"),
    format: str = Query("csv", description="csv | pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Money received in a date window (default today), as a file.

    One row per payment, so partials on older invoices each appear. Columns match
    the Today's Collection table, including what the money was for. CSV for
    spreadsheets, PDF for the printed cash sheet.
    """
    from models import InvoicePayment
    _ensure_invoice_columns(db)
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    today = clinic_today(clinic)
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else today
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else d_from
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    rows = (
        db.query(InvoicePayment, Invoice, Patient)
        .join(Invoice, InvoicePayment.invoice_id == Invoice.id)
        .outerjoin(Patient, Invoice.patient_id == Patient.id)
        .filter(
            InvoicePayment.clinic_id == current_user.clinic_id,
            InvoicePayment.paid_on >= d_from,
            InvoicePayment.paid_on <= d_to,
        )
        .order_by(desc(InvoicePayment.paid_on), desc(InvoicePayment.id))
        .all()
    )

    # What each invoice was for, batched — the same "Work Done" the table shows.
    items_by_invoice = {}
    inv_ids = list({inv.id for _, inv, _ in rows})
    if inv_ids:
        for li_inv, li_desc, li_qty in (
            db.query(InvoiceLineItem.invoice_id, InvoiceLineItem.description, InvoiceLineItem.quantity)
            .filter(InvoiceLineItem.invoice_id.in_(inv_ids)).order_by(InvoiceLineItem.id).all()
        ):
            q = float(li_qty or 1)
            items_by_invoice.setdefault(li_inv, []).append(
                f"{li_desc} x {q:g}" if q > 1 else str(li_desc)
            )

    def work_done(inv_id):
        return "; ".join(items_by_invoice.get(inv_id, [])) or "-"

    # Where each payment sits in its invoice's history. A row saying "₹2,000"
    # is close to meaningless on its own — what a clinic needs to know is
    # whether that settled the bill or whether money is still outstanding, and
    # which instalment it was. Loads every payment for these invoices, not just
    # the ones in the window, so "2 of 3" counts the whole schedule.
    seq_by_payment = {}
    paid_before_by_payment = {}
    if inv_ids:
        by_invoice = {}
        for p in (
            db.query(InvoicePayment)
            .filter(InvoicePayment.invoice_id.in_(inv_ids))
            .order_by(InvoicePayment.paid_on, InvoicePayment.id)
            .all()
        ):
            by_invoice.setdefault(p.invoice_id, []).append(p)
        for plist in by_invoice.values():
            running = 0.0
            for idx, p in enumerate(plist, 1):
                seq_by_payment[p.id] = (idx, len(plist))
                paid_before_by_payment[p.id] = running
                running += float(p.amount or 0)

    def ledger(pay, inv):
        """The running account for one payment, as a clinic would read it:
        what was billed, what had already been paid before this instalment,
        what came in now, the total after it, and what was still left.

        Each row is the state at that moment, so a row stays truthful even when
        later instalments follow it.
        """
        billed = float(inv.total or 0)
        before = float(paid_before_by_payment.get(pay.id, 0.0))
        now = float(pay.amount or 0)
        total_paid = before + now
        balance = round(max(0.0, billed - total_paid), 2)
        seq, count = seq_by_payment.get(pay.id, (1, 1))
        kind = "Full payment" if (count == 1 and balance <= 0) else f"Part payment ({seq} of {count})"
        return {
            "billed": billed, "before": before, "now": now,
            "total_paid": total_paid, "balance": balance,
            "settled": balance <= 0, "kind": kind, "seq": seq, "count": count,
        }

    total = cash = online = 0.0
    for pay, _inv, _pat in rows:
        amt = float(pay.amount or 0)
        total += amt
        if (pay.method or "").strip().lower() == "cash":
            cash += amt
        else:
            online += amt

    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    same_day = d_from == d_to
    range_label = d_from.strftime('%d %B %Y') if same_day else \
        f"{d_from.strftime('%d %b %Y')} to {d_to.strftime('%d %b %Y')}"
    fname = f"collections_{d_from.isoformat()}" if same_day else \
        f"collections_{d_from.isoformat()}_to_{d_to.isoformat()}"

    if (format or "csv").lower() == "pdf":
        generated_at = clinic_now(clinic).strftime('%d %b %Y at %I:%M %p').lstrip('0')
        generated_by = getattr(current_user, 'name', None) or getattr(current_user, 'email', '') or ''
        outstanding_pdf = sum(
            float(inv.due_amount if inv.due_amount is not None
                  else max(0.0, float(inv.total or 0) - float(inv.paid_amount or 0)))
            for inv in {inv.id: inv for _, inv, _ in rows}.values()
        )
        html = _collection_sheet_html(
            clinic, range_label, rows, items_by_invoice,
            {"total": total, "cash": cash, "online": online, "count": len(rows),
             "outstanding": outstanding_pdf},
            generated_at, generated_by,
            ledger_for=ledger,
        )
        try:
            pdf_path = html_template_to_pdf(html)
            with open(pdf_path, 'rb') as fh:
                pdf_bytes = fh.read()
            try:
                os.remove(pdf_path)
            except OSError:
                pass
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not build the collection PDF: {e}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'},
        )

    outstanding = sum(
        float(inv.due_amount if inv.due_amount is not None
              else max(0.0, float(inv.total or 0) - float(inv.paid_amount or 0)))
        for inv in {inv.id: inv for _, inv, _ in rows}.values()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([f"Collections — {clinic.name or 'Clinic'} — {range_label}"])
    writer.writerow([
        f"Total: {total:.2f}", f"Cash: {cash:.2f}", f"Online: {online:.2f}",
        f"Payments: {len(rows)}", f"Still outstanding on these invoices: {outstanding:.2f}",
    ])
    writer.writerow([])
    # Ledger columns first: billed, what was already paid, what came in now,
    # the running total and what is left. Everything after that is context.
    writer.writerow([
        "#", "Date", "Time", "Invoice Number", "Invoice Date",
        "Patient ID", "Patient Name", "Phone", "Work Done",
        "Total Billed", "Paid Before", "Paid Today", "Total Paid", "Balance",
        "Settled", "Payment Type", "Method", "Entered On", "Back-dated",
        "Invoice Subtotal", "Discount", "Invoice Status", "UTR / Ref", "Note",
    ])
    for i, (pay, inv, pat) in enumerate(rows, 1):
        L = ledger(pay, inv)
        writer.writerow([
            i,
            pay.paid_on.isoformat() if pay.paid_on else "",
            pay.created_at.strftime('%H:%M') if pay.created_at else "",
            inv.invoice_number,
            inv.created_at.date().isoformat() if inv.created_at else "",
            (pat.display_id if pat else "") or "",
            (pat.name if pat else "") or "",
            (pat.phone if pat else "") or "",
            work_done(inv.id),
            f"{L['billed']:.2f}",
            f"{L['before']:.2f}",
            f"{L['now']:.2f}",
            f"{L['total_paid']:.2f}",
            f"{L['balance']:.2f}",
            "Settled" if L['settled'] else "Pending",
            L['kind'],
            pay.method or "",
            (_recorded_on(clinic, pay).isoformat() if pay.created_at else ""),
            "Yes" if _is_back_dated(clinic, pay) else "No",
            f"{float(inv.subtotal or 0):.2f}",
            f"{float(inv.discount_amount or 0):.2f}",
            INVOICE_STATUS_LABELS.get(inv.status, inv.status),
            inv.utr or "",
            (pay.note or "").replace("\n", " "),
        ])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'},
    )


def _collection_sheet_html(clinic, range_label, rows, items_by_invoice, totals,
                           generated_at='', generated_by='', ledger_for=None) -> str:
    """Printable collection sheet on A4 portrait, styled like the daily register
    day sheet so the two exports look like one product."""
    from html import escape as esc
    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    clinic_name = esc(clinic.name or 'Clinic')
    clinic_line = ' · '.join(filter(None, [
        esc(getattr(clinic, 'address', '') or ''),
        esc(getattr(clinic, 'phone', '') or ''),
    ]))

    body = ''
    # Only the collected column sums across rows. Balance must not: two
    # instalments against one invoice would count its remainder twice, so the
    # footer uses the per-invoice outstanding figure instead.
    sum_now = 0.0
    for i, (pay, inv, pat) in enumerate(rows, 1):
        work = '; '.join(items_by_invoice.get(inv.id, [])) or '-'
        L = ledger_for(pay, inv) if ledger_for else {
            'billed': float(inv.total or 0), 'before': 0.0,
            'now': float(pay.amount or 0), 'total_paid': float(pay.amount or 0),
            'balance': 0.0, 'settled': True, 'kind': '',
        }
        sum_now += L['now']
        body += (
            f'<tr>'
            f'<td class="c">{i}</td>'
            f'<td class="c">{pay.created_at.strftime("%H:%M") if pay.created_at else "-"}</td>'
            f'<td>{esc(inv.invoice_number or "")}'
            f'<br><span class="sub">{esc((pat.display_id if pat else "") or "-")}'
            f'{" · " + inv.created_at.strftime("%d %b") if inv.created_at else ""}</span></td>'
            f'<td><strong>{esc((pat.name if pat else "") or "Unknown")}</strong>'
            f'<br><span class="sub">{esc((pat.phone if pat else "") or "-")}</span>'
            f'<br><span class="sub">{esc(work)}</span></td>'
            f'<td class="c">{esc(pay.method or "-")}'
            f'<br><span class="sub">{esc(L["kind"])}</span>'
            + (f'<br><span class="back">entered {_recorded_on(clinic, pay).strftime("%d %b")}</span>'
               if _is_back_dated(clinic, pay) else '')
            + '</td>'
            f'<td class="r">{L["billed"]:,.2f}</td>'
            f'<td class="r">{L["before"]:,.2f}</td>'
            f'<td class="r"><strong>{L["now"]:,.2f}</strong></td>'
            f'<td class="r">{L["total_paid"]:,.2f}</td>'
            f'<td class="r">'
            + ('<span class="ok">Settled</span>' if L['settled']
               else f'<strong class="due">{L["balance"]:,.2f}</strong>')
            + '</td>'
            f'</tr>'
        )
    if not rows:
        body = '<tr><td colspan="10" class="empty">No payments were collected in this period.</td></tr>'

    foot_bits = []
    if generated_at:
        foot_bits.append(f'Generated {esc(generated_at)}')
    if generated_by:
        foot_bits.append(f'by {esc(generated_by)}')
    foot = ' '.join(foot_bits) or 'Generated'

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
@page {{ size: A4 portrait; margin: 12mm 10mm; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 10px; margin: 0; }}
h1 {{ font-size: 16px; margin: 0 0 2px; }}
.head {{ border-bottom: 2px solid #2a276e; padding-bottom: 8px; margin-bottom: 10px; }}
.sub {{ color: #6B7280; font-size: 9px; }}
.title {{ font-size: 11px; font-weight: bold; color: #2a276e; margin-top: 4px; }}
.kpis {{ width: 100%; border-collapse: separate; border-spacing: 5px 0; margin-bottom: 12px; }}
.kpis td {{ border: 1px solid #E5E7EB; padding: 7px 9px; width: 25%; }}
.kpis .n {{ font-size: 15px; font-weight: bold; }}
table.reg {{ width: 100%; border-collapse: collapse; }}
table.reg th {{ background: #F8FAFC; border-bottom: 1px solid #E5E7EB; padding: 5px 4px;
  text-align: left; font-size: 8px; text-transform: uppercase; color: #6B7280; letter-spacing: .04em; }}
table.reg th.c {{ text-align: center; }}
table.reg th.r {{ text-align: right; }}
table.reg td {{ border-bottom: 1px solid #F1F5F9; padding: 5px 4px; vertical-align: top; }}
table.reg td.c {{ text-align: center; }}
table.reg td.r {{ text-align: right; white-space: nowrap; }}
tr.tot td {{ border-top: 2px solid #E5E7EB; font-weight: bold; padding-top: 7px; }}
.ok {{ color: #047857; font-size: 9px; font-weight: bold; }}
.due {{ color: #B45309; }}
.back {{ color: #B45309; font-size: 8px; }}
td.empty {{ padding: 24px; color: #6B7280; text-align: center; }}
.foot {{ margin-top: 12px; padding-top: 6px; border-top: 1px solid #F1F5F9;
  color: #9CA3AF; font-size: 8px; }}
.foot .right {{ float: right; }}
</style></head><body>
  <div class="head">
    <h1>{clinic_name}</h1>
    {f'<div class="sub">{clinic_line}</div>' if clinic_line else ''}
    <div class="title">Collections &nbsp;·&nbsp; {range_label}</div>
  </div>

  <table class="kpis"><tr>
    <td><div class="sub">Total collected</div><div class="n">{currency} {totals['total']:,.2f}</div></td>
    <td><div class="sub">Cash</div><div class="n">{currency} {totals['cash']:,.2f}</div></td>
    <td><div class="sub">Online</div><div class="n">{currency} {totals['online']:,.2f}</div></td>
    <td><div class="sub">Still outstanding</div><div class="n">{currency} {totals.get('outstanding', 0):,.2f}</div></td>
  </tr></table>

  <table class="reg">
    <thead><tr>
      <th class="c">#</th><th class="c">Time</th><th>Invoice / Patient ID</th>
      <th>Patient &amp; Work Done</th><th class="c">Method / Type</th>
      <th class="r">Total Billed</th><th class="r">Paid Before</th>
      <th class="r">Paid Today</th><th class="r">Total Paid</th><th class="r">Balance</th>
    </tr></thead>
    <tbody>
      {body}
      <tr class="tot">
        <td colspan="7" class="r">Totals ({totals['count']} payment{'' if totals['count'] == 1 else 's'})</td>
        <td class="r">{currency} {sum_now:,.2f}</td>
        <td class="r"></td>
        <td class="r">{currency} {totals.get('outstanding', 0):,.2f}</td>
      </tr>
    </tbody>
  </table>
  <p class="sub" style="margin-top:6px;">
    Amounts in {currency}. Each row shows the account at the moment of that payment:
    what was billed, what had already been paid, what came in, and what was left.
  </p>

  <div class="foot">
    <span class="right">MolarPlus</span>
    {foot}
  </div>
</body></html>"""


@router.get("", response_model=List[InvoiceOut])
async def get_invoices(
    skip: int = Query(0),
    limit: int = Query(100),
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    search: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD, invoice date (clinic tz)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD, invoice date (clinic tz)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all invoices for the clinic"""
    try:
        _ensure_invoice_columns(db)
        created_from, created_to = _resolve_date_bounds(db, current_user.clinic_id, date_from, date_to)
        query = _filtered_invoices_query(
            db, current_user.clinic_id,
            status=status, patient_id=patient_id, appointment_id=appointment_id,
            case_paper_id=case_paper_id, search=search, payment_mode=payment_mode,
            created_from=created_from, created_to=created_to,
        )
        invoices = query.order_by(desc(Invoice.created_at)).offset(skip).limit(limit).all()
        return [enrich_invoice(db, inv) for inv in invoices]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching invoices: {str(e)}")

@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific invoice"""
    _ensure_invoice_columns(db)
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.clinic_id == current_user.clinic_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return enrich_invoice(db, invoice)


@router.post("/{invoice_id}/payments", response_model=InvoiceOut)
async def add_invoice_payment(
    invoice_id: int,
    payload: InvoicePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an installment against an invoice. paid/due/status are recomputed
    from the sum of all payments."""
    from models import InvoicePayment
    _ensure_invoice_columns(db)
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.clinic_id == current_user.clinic_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status in ('draft', 'cancelled'):
        raise HTTPException(status_code=400, detail="Finalize the invoice before recording payments")
    if not payload.amount or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid payment amount")

    paid_on = None
    if payload.paid_on:
        try:
            paid_on = datetime.strptime(payload.paid_on, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="paid_on must be YYYY-MM-DD")
    else:
        paid_on = clinic_today(invoice.clinic)

    entered_on = clinic_today(invoice.clinic)
    if paid_on > entered_on:
        raise HTTPException(status_code=400, detail="A payment can't be dated in the future")

    # Back-dating is legitimate — cash taken on Saturday often gets entered on
    # Monday — but it must not be silent, or the books and the cash drawer stop
    # agreeing without explanation. The money keeps its real date; the note says
    # when it was actually written down.
    note = (payload.note or "").strip() or None
    if paid_on < entered_on:
        stamp = f"recorded on {entered_on.strftime('%d %b %Y')}"
        note = f"{note} ({stamp})" if note else f"Back-dated entry, {stamp}"

    payment = InvoicePayment(
        invoice_id=invoice.id, clinic_id=current_user.clinic_id,
        amount=float(payload.amount), paid_on=paid_on,
        method=payload.method, note=note,
    )
    db.add(payment)
    db.flush()
    if payload.method:
        invoice.payment_mode = payload.method
    sync_invoice_from_payments(invoice)
    create_audit_log(db, invoice_id, current_user.id, 'payment_added', None,
                     {'amount': float(payload.amount), 'paid_on': str(paid_on)})
    db.commit()
    db.refresh(invoice)
    return enrich_invoice(db, invoice)


@router.delete("/{invoice_id}/payments/{payment_id}", response_model=InvoiceOut)
async def delete_invoice_payment(
    invoice_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove an installment; paid/due/status recompute from the remaining rows."""
    from models import InvoicePayment
    _ensure_invoice_columns(db)
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.clinic_id == current_user.clinic_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    payment = db.query(InvoicePayment).filter(
        InvoicePayment.id == payment_id, InvoicePayment.invoice_id == invoice_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.flush()
    sync_invoice_from_payments(invoice)
    create_audit_log(db, invoice_id, current_user.id, 'payment_deleted',
                     {'amount': float(payment.amount or 0)}, None)
    db.commit()
    db.refresh(invoice)
    return enrich_invoice(db, invoice)

@router.post("/{invoice_id}/discounts", response_model=InvoiceOut)
async def add_post_issue_discount(
    invoice_id: int,
    payload: InvoiceDiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant a discount on an invoice that has already been issued.

    Draft invoices keep editing Invoice.discount directly (see update_invoice) —
    nothing is issued yet, so there is no concession to record. Once finalized,
    each discount becomes its own dated, attributed row, and the deduction can
    never exceed what is still outstanding: reducing a bill below what the
    patient already handed over would create a refund we have no flow to settle.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.clinic_id == current_user.clinic_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == 'draft':
        raise HTTPException(
            status_code=400,
            detail="This invoice is still a draft — edit its discount directly instead."
        )
    if invoice.status == 'cancelled':
        raise HTTPException(status_code=400, detail="This invoice is cancelled")

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Please give a reason for this discount")

    value = float(payload.value or 0)
    if value <= 0:
        raise HTTPException(status_code=400, detail="Enter a discount greater than zero")

    d_type = payload.discount_type if payload.discount_type in ('amount', 'percentage') else 'amount'
    if d_type == 'percentage':
        if value > 100:
            raise HTTPException(status_code=400, detail="A percentage discount can't exceed 100%")
        # Resolved against the subtotal, matching how the draft-time discount works.
        amount = round(float(invoice.subtotal or 0) * (value / 100), 2)
    else:
        amount = round(value, 2)

    # The ceiling is what's still owed. Anything more would push the total below
    # money already collected.
    paid = float(invoice.paid_amount or 0)
    outstanding = round(max(float(invoice.total or 0) - paid, 0.0), 2)
    if amount > outstanding:
        currency = getattr(invoice.clinic, 'currency_symbol', None) or '₹'
        raise HTTPException(
            status_code=400,
            detail=(
                f"This discount is more than the amount still due. "
                f"You can discount up to {currency}{outstanding:,.2f} on this invoice."
            ),
        )

    discount = InvoiceDiscount(
        invoice_id=invoice.id,
        clinic_id=current_user.clinic_id,
        value=value,
        discount_type=d_type,
        amount=amount,
        reason=reason,
        applied_by=current_user.id,
        applied_at=datetime.utcnow(),
    )
    db.add(discount)
    db.flush()

    old_total = float(invoice.total or 0)
    recalculate_invoice_totals(db, invoice)
    # Totals moved, so paid/due/status must follow: a discount that clears the
    # remaining balance settles the invoice. Only safe to derive from payment
    # rows when there are some — a legacy invoice marked paid before itemised
    # payments existed would otherwise be reset to unpaid.
    if invoice.payments:
        sync_invoice_from_payments(invoice)

    create_audit_log(
        db, invoice_id, current_user.id, 'discount_applied',
        {'total': old_total},
        {'total': float(invoice.total or 0), 'discount': amount, 'reason': reason},
        notes=reason,
    )
    db.commit()
    db.refresh(invoice)
    return enrich_invoice(db, invoice)


@router.delete("/{invoice_id}/discounts/{discount_id}", response_model=InvoiceOut)
async def remove_post_issue_discount(
    invoice_id: int,
    discount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reverse a post-issue discount recorded in error. The removal itself is
    audit-logged, so the record of the correction survives even though the
    concession row does not."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.clinic_id == current_user.clinic_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    discount = db.query(InvoiceDiscount).filter(
        InvoiceDiscount.id == discount_id, InvoiceDiscount.invoice_id == invoice_id
    ).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")

    removed = {'amount': float(discount.amount or 0), 'reason': discount.reason}
    db.delete(discount)
    db.flush()
    recalculate_invoice_totals(db, invoice)
    if invoice.payments:
        sync_invoice_from_payments(invoice)
    create_audit_log(db, invoice_id, current_user.id, 'discount_removed', removed, None)
    db.commit()
    db.refresh(invoice)
    return enrich_invoice(db, invoice)


@router.post("/{invoice_id}/line-items", response_model=InvoiceOut)
async def add_line_item(
    invoice_id: int,
    line_item_data: InvoiceLineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new line item to invoice"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        # Calculate amount if not provided
        amount = line_item_data.amount
        if amount is None:
            amount = line_item_data.quantity * line_item_data.unit_price
        
        line_item = InvoiceLineItem(
            invoice_id=invoice_id,
            description=line_item_data.description,
            quantity=line_item_data.quantity,
            unit_price=line_item_data.unit_price,
            amount=amount
        )
        db.add(line_item)
        db.flush()

        # Optionally deduct this line from medication stock (dispense via invoice),
        # logging a linked 'used' movement so it shows in the ledger and can reverse.
        med_id = getattr(line_item_data, 'medication_stock_id', None)
        if med_id:
            from models import MedicationStock, InventoryTransaction
            med = db.query(MedicationStock).filter(
                MedicationStock.id == med_id, MedicationStock.clinic_id == current_user.clinic_id
            ).first()
            if med:
                med.quantity = max(0.0, (med.quantity or 0.0) - line_item_data.quantity)
                db.add(InventoryTransaction(
                    clinic_id=current_user.clinic_id, patient_id=invoice.patient_id,
                    case_paper_id=invoice.case_paper_id, medication_stock_id=med.id,
                    invoice_line_item_id=line_item.id, direction='out', action='used',
                    item_name=med.name, unit=med.unit, quantity=line_item_data.quantity,
                    note='Dispensed via invoice',
                ))

        # Recalculate totals
        recalculate_invoice_totals(db, invoice)
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'line_item_added', None, {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        })
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding line item: {str(e)}")

@router.post("/procedure-charge")
async def add_procedure_charge(
    payload: ProcedureChargeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto-bill a completed procedure: add a priced line to the case paper's
    draft invoice, creating the draft if none exists. Mirrors how used/dispensed
    stock accumulates into the same bill. Returns the invoice + line ids so the
    caller can later update or remove this exact line if the procedure changes."""
    try:
        if payload.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

        inv = get_or_create_draft_invoice(
            db, current_user.clinic_id, payload.patient_id, payload.case_paper_id,
            created_by=current_user.id,
        )
        line = InvoiceLineItem(
            invoice_id=inv.id,
            description=payload.description,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            amount=payload.quantity * payload.unit_price,
        )
        db.add(line)
        db.flush()

        recalculate_invoice_totals(db, inv)
        create_audit_log(db, inv.id, current_user.id, 'line_item_added', None, {
            'description': line.description,
            'quantity': line.quantity,
            'unit_price': line.unit_price,
            'amount': line.amount,
            'source': 'procedure',
        })

        db.commit()
        db.refresh(inv)
        return {
            'invoice_id': inv.id,
            'line_item_id': line.id,
            'invoice_number': inv.invoice_number,
            'status': inv.status,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error billing procedure: {str(e)}")

@router.put("/{invoice_id}/line-items/{line_item_id}", response_model=InvoiceOut)
async def update_line_item(
    invoice_id: int,
    line_item_id: int,
    line_item_data: InvoiceLineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a line item"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        line_item = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == line_item_id,
            InvoiceLineItem.invoice_id == invoice_id
        ).first()
        
        if not line_item:
            raise HTTPException(status_code=404, detail="Line item not found")
        
        # Store old values for audit
        old_values = {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        }
        
        # Update line item
        line_item.description = line_item_data.description
        line_item.quantity = line_item_data.quantity
        line_item.unit_price = line_item_data.unit_price
        
        # Calculate amount
        amount = line_item_data.amount
        if amount is None:
            amount = line_item_data.quantity * line_item_data.unit_price
        line_item.amount = amount
        
        # Recalculate invoice totals
        recalculate_invoice_totals(db, invoice)
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'line_item_updated', old_values, {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        })
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating line item: {str(e)}")

@router.delete("/{invoice_id}/line-items/{line_item_id}", response_model=InvoiceOut)
async def delete_line_item(
    invoice_id: int,
    line_item_id: int,
    restock: bool = Query(False, description="Also delete the linked stock usage record and restore its quantity"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a line item.

    A line billed from a case-paper stock usage record is, by default, just
    unbilled: the usage record stays and stock remains consumed. With
    `restock=true`, the linked usage record is also deleted and its quantity is
    put back on the item — "remove entirely" from the invoice side.
    """
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit draft invoices")
        
        line_item = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == line_item_id,
            InvoiceLineItem.invoice_id == invoice_id
        ).first()
        
        if not line_item:
            raise HTTPException(status_code=404, detail="Line item not found")

        # Audit log before deletion
        create_audit_log(db, invoice_id, current_user.id, 'line_item_deleted', {
            'description': line_item.description,
            'quantity': line_item.quantity,
            'unit_price': line_item.unit_price,
            'amount': line_item.amount
        }, None)

        # Handle rows that reference this line so the FK doesn't block the delete.
        from models import InventoryTransaction, LabOrder, InventoryItem, MedicationStock
        if restock:
            # "Remove entirely": delete each linked stock usage record and put its
            # quantity back on the still-existing item (general or medication).
            usage_rows = db.query(InventoryTransaction).filter(
                InventoryTransaction.invoice_line_item_id == line_item_id
            ).all()
            for u in usage_rows:
                if u.inventory_item_id:
                    it = db.query(InventoryItem).filter(
                        InventoryItem.id == u.inventory_item_id,
                        InventoryItem.clinic_id == current_user.clinic_id,
                    ).first()
                    if it:
                        it.quantity = (it.quantity or 0.0) + (u.quantity or 0.0)
                elif u.medication_stock_id:
                    med = db.query(MedicationStock).filter(
                        MedicationStock.id == u.medication_stock_id,
                        MedicationStock.clinic_id == current_user.clinic_id,
                    ).first()
                    if med:
                        med.quantity = (med.quantity or 0.0) + (u.quantity or 0.0)
                db.delete(u)
            db.flush()
        else:
            # Default "unbill only": keep the stock movement, just detach it.
            db.query(InventoryTransaction).filter(
                InventoryTransaction.invoice_line_item_id == line_item_id
            ).update({InventoryTransaction.invoice_line_item_id: None}, synchronize_session=False)
        # Lab orders always just detach (their own delete flow restocks separately).
        db.query(LabOrder).filter(
            LabOrder.invoice_line_item_id == line_item_id
        ).update({LabOrder.invoice_line_item_id: None}, synchronize_session=False)

        db.delete(line_item)
        db.flush()
        
        # If no line items remain on a draft invoice, delete the invoice entirely
        remaining = db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice_id).count()
        if remaining == 0 and invoice.status == 'draft':
            db.delete(invoice)
            db.commit()
            return {"deleted": True, "message": "Invoice deleted — no items remaining"}
        
        # Recalculate totals
        recalculate_invoice_totals(db, invoice)
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting line item: {str(e)}")

@router.post("/{invoice_id}/finalize", response_model=InvoiceOut)
async def finalize_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Finalize invoice so it becomes non-editable."""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Only draft invoices can be finalized")

        if not invoice.line_items or len(invoice.line_items) == 0:
            raise HTTPException(status_code=400, detail="Add at least one line item before finalizing")

        recalculate_invoice_totals(db, invoice)
        invoice.status = 'finalized'
        invoice.finalized_at = datetime.utcnow()
        invoice.paid_amount = 0.0
        invoice.due_amount = max(float(invoice.total or 0), 0.0)

        create_audit_log(db, invoice_id, current_user.id, 'finalized', {
            'status': 'draft'
        }, {
            'status': invoice.status,
            'finalized_at': invoice.finalized_at.isoformat() if invoice.finalized_at else None
        })

        db.commit()
        db.refresh(invoice)

        track_event(
            str(current_user.id),
            EVENTS.INVOICE_FINALIZED,
            {"amount": float(invoice.total or 0)},
            clinic_id=current_user.clinic_id,
        )

        # ── Push notification to clinic — payment due ──────────────────
        from core.push_notify import push_to_clinic
        patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
        push_to_clinic(
            db, current_user.clinic_id,
            "💰 Payment Due",
            f"{patient.name if patient else 'Patient'} — ₹{invoice.due_amount:.0f} ({invoice.invoice_number})",
            {"type": "invoice_due", "invoice_id": str(invoice.id)},
        )

        # ── Notify patient that invoice is ready ──────────────────────
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if patient and clinic:
            notify_event(
                "invoice_notification",
                db=db,
                clinic_id=current_user.clinic_id,
                to_phone=patient.phone or "",
                to_email=patient.email or "",
                to_name=patient.name,
                template_data={
                    "patient_name": patient.name,
                    "clinic_name": clinic.name,
                    "invoice_number": invoice.invoice_number,
                    "total_amount": float(invoice.total or 0),
                    "clinic_phone": clinic.phone or "",
                },
            )

        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error finalizing invoice: {str(e)}")

@router.post("/{invoice_id}/mark-as-paid", response_model=InvoiceOut)
async def mark_invoice_as_paid(
    invoice_id: int,
    payment_data: MarkAsPaidRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record payment (full or partial) on finalized invoice."""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status not in ['finalized', 'partially_paid']:
            raise HTTPException(status_code=400, detail="Only finalized invoices can be marked as paid")

        recalculate_invoice_totals(db, invoice)

        remaining_due = max(float(invoice.total or 0) - float(getattr(invoice, 'paid_amount', 0) or 0), 0.0)
        if remaining_due <= 0:
            raise HTTPException(status_code=400, detail="Invoice is already fully paid")

        old_status = invoice.status
        old_paid = float(getattr(invoice, 'paid_amount', 0) or 0)

        is_partial = bool(payment_data.is_partial)
        amount_paid = float(payment_data.amount_paid or 0)
        if is_partial:
            if amount_paid <= 0:
                raise HTTPException(status_code=400, detail="Enter valid partial payment amount")
            if amount_paid >= remaining_due:
                raise HTTPException(status_code=400, detail="Partial amount must be less than due amount")
            payment_amount = amount_paid
        else:
            payment_amount = remaining_due

        # Record this payment as an itemised row, then derive paid/due/status
        # from the sum of all rows — keeping the mark-paid flow and the new
        # payments list as one consistent source of truth.
        from models import InvoicePayment
        # Same back-dating rule as the payments panel: the money keeps the day it
        # was received, and the note says when it was written down.
        entered_on = clinic_today(invoice.clinic)
        if payment_data.paid_on:
            try:
                paid_on = datetime.strptime(payment_data.paid_on, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="paid_on must be YYYY-MM-DD")
        else:
            paid_on = entered_on
        if paid_on > entered_on:
            raise HTTPException(status_code=400, detail="A payment can't be dated in the future")

        note = (payment_data.note or "").strip() or None
        if paid_on < entered_on:
            stamp = f"recorded on {entered_on.strftime('%d %b %Y')}"
            note = f"{note} ({stamp})" if note else f"Back-dated entry, {stamp}"

        db.add(InvoicePayment(
            invoice_id=invoice.id, clinic_id=current_user.clinic_id,
            amount=float(payment_amount), paid_on=paid_on,
            method=payment_data.payment_mode, note=note,
        ))
        db.flush()
        invoice.payment_mode = payment_data.payment_mode
        invoice.utr = payment_data.utr
        sync_invoice_from_payments(invoice)
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'marked_paid', {
            'status': old_status,
            'paid_amount': old_paid,
            'due_amount': remaining_due
        }, {
            'status': invoice.status,
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'paid_amount': invoice.paid_amount,
            'due_amount': invoice.due_amount,
            'payment_amount': payment_amount
        }, notes=f"Payment recorded via {invoice.payment_mode}")
        
        db.commit()
        db.refresh(invoice)

        # ── On full payment: fire google_review automatically ───────
        if invoice.status == 'paid_unverified':
            patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            if patient and clinic:
                # Try to fetch the clinic's Google Place review URL
                review_link = ""
                try:
                    from models import ClinicGooglePlace
                    gp = db.query(ClinicGooglePlace).filter(
                        ClinicGooglePlace.clinic_id == current_user.clinic_id
                    ).first()
                    if gp and gp.place_id:
                        review_link = f"https://search.google.com/local/writereview?placeid={gp.place_id}"
                except Exception:
                    pass  # model may not exist yet — skip silently

                if review_link:
                    notify_event(
                        "google_review",
                        db=db,
                        clinic_id=current_user.clinic_id,
                        to_phone=patient.phone or "",
                        to_email=patient.email or "",
                        to_name=patient.name,
                        template_data={
                            "patient_name": patient.name,
                            "clinic_name": clinic.name,
                            "review_link": review_link,
                            "clinic_phone": clinic.phone or "",
                        },
                    )

        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error marking invoice as paid: {str(e)}")

@router.put("/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: int,
    invoice_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update invoice (payment_mode, utr, notes)"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != 'draft':
            raise HTTPException(status_code=400, detail="Can only update draft invoices")
        
        old_values = {
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'notes': invoice.notes,
            'discount': getattr(invoice, 'discount', 0),
            'discount_type': getattr(invoice, 'discount_type', 'amount')
        }
        
        # Update fields
        if 'payment_mode' in invoice_update:
            invoice.payment_mode = invoice_update['payment_mode']
        if 'utr' in invoice_update:
            invoice.utr = invoice_update.get('utr')
        if 'notes' in invoice_update:
            invoice.notes = invoice_update.get('notes')
        if 'discount' in invoice_update:
            invoice.discount = float(invoice_update['discount'])
        if 'discount_type' in invoice_update:
            invoice.discount_type = invoice_update['discount_type']
            
        recalculate_invoice_totals(db, invoice)
        
        new_values = {
            'payment_mode': invoice.payment_mode,
            'utr': invoice.utr,
            'notes': invoice.notes,
            'discount': invoice.discount,
            'discount_type': invoice.discount_type
        }
        
        # Audit log
        create_audit_log(db, invoice_id, current_user.id, 'updated', old_values, new_values)
        
        db.commit()
        db.refresh(invoice)
        return enrich_invoice(db, invoice)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating invoice: {str(e)}")

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an entire invoice completely"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status in ('paid_verified', 'paid_unverified', 'partially_paid'):
            raise HTTPException(status_code=400, detail="Paid invoices cannot be deleted")

        # Stock-ledger rows (used/dispensed items) reference the invoice's line
        # items. Deleting the invoice cascades its line items, so unlink those
        # references first or the FK blocks the delete. The stock movements stay
        # in the ledger — the items were physically used; they're just no longer
        # billed to this (now removed) invoice.
        from models import InventoryTransaction, LabOrder
        line_item_ids = [li.id for li in invoice.line_items]
        if line_item_ids:
            db.query(InventoryTransaction).filter(
                InventoryTransaction.invoice_line_item_id.in_(line_item_ids)
            ).update({InventoryTransaction.invoice_line_item_id: None}, synchronize_session=False)
            db.query(LabOrder).filter(
                LabOrder.invoice_line_item_id.in_(line_item_ids)
            ).update({LabOrder.invoice_line_item_id: None}, synchronize_session=False)
            db.flush()

        db.delete(invoice)
        db.commit()

        return {"success": True, "message": "Invoice deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting invoice: {str(e)}")

@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and return invoice PDF"""
    try:
        _ensure_invoice_columns(db)
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get clinic info
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Get template configuration
        from models import TemplateConfiguration
        config = db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == current_user.clinic_id,
            TemplateConfiguration.category == 'invoice'
        ).first()

        # Generate HTML invoice template
        html_content = generate_invoice_html(invoice, clinic, config)
        
        # Convert to PDF
        pdf_path = html_template_to_pdf(html_content)
        
        # Read PDF file
        with open(pdf_path, 'rb') as pdf_file:
            pdf_content = pdf_file.read()
        
        # Cleanup temp file
        try:
            os.remove(pdf_path)
        except:
            pass
        
        # Return PDF as response
        return Response(
            content=pdf_content,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")

@router.post("/{invoice_id}/send-whatsapp")
async def send_invoice_via_whatsapp(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send invoice PDF to patient via WhatsApp"""
    try:
        _ensure_invoice_columns(db)
        # Get invoice
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.clinic_id == current_user.clinic_id
        ).first()
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Get patient
        patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        if not patient.phone:
            raise HTTPException(status_code=400, detail="Patient phone number is required")
        
        # Get clinic info
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Get template configuration
        from models import TemplateConfiguration
        config = db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == current_user.clinic_id,
            TemplateConfiguration.category == 'invoice'
        ).first()

        # 2. Generate PDF using engine
        html_content = generate_invoice_html(invoice, clinic, config)
        pdf_path = html_template_to_pdf(html_content)
        
        # 2. Upload to Nexus Media Service (Official Legacy Flow)
        NEXUS_SERVICES_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
        try:
            with open(pdf_path, 'rb') as f:
                files = {'file': (f'Invoice_{invoice.invoice_number}.pdf', f, 'application/pdf')}
                data = {'clinic_id': str(current_user.clinic_id), 'patient_id': str(patient.id)}
                resp = requests.post(f"{NEXUS_SERVICES_URL}/api/v1/notifications/media/upload", files=files, data=data, timeout=30)
                
            # Cleanup temp file
            if os.path.exists(pdf_path): os.remove(pdf_path)
            
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Nexus Upload Failed: {resp.text}")
            
            media_id = resp.json().get("media_id") # Nexus returns public R2 URL as media_id
        except Exception as e:
            if os.path.exists(pdf_path): os.remove(pdf_path)
            raise HTTPException(status_code=500, detail=f"Nexus Connection Error: {str(e)}")

        # 3. Dispatch WhatsApp event via Nexus (Universal Service)
        notify_event(
            "invoice_notification",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=patient.phone,
            to_name=patient.name,
            template_data={
                "patient_name": patient.name,
                "clinic_name": clinic.name,
                "invoice_number": invoice.invoice_number,
                "total_amount": float(invoice.total),
                "clinic_phone": clinic.phone or "",
                "media_id": media_id  # Nexus handles this public R2 URL
            }
        )

        return {"success": True, "message": "Invoice sharing initiated via official Nexus service"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending invoice via WhatsApp: {str(e)}")



