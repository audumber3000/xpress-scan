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
from models import Invoice, InvoiceLineItem, InvoiceAuditLog, Patient, User, Clinic, Appointment
from core.auth_utils import get_current_user
from core.clinic_time import clinic_today, clinic_day_bounds_utc
from schemas import (
    InvoiceOut, InvoiceLineItemCreate, InvoiceLineItemOut,
    MarkAsPaidRequest, InvoiceCreate, InvoicePaymentCreate, ProcedureChargeCreate
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

def enrich_invoice(db: Session, invoice: Invoice):
    """Enrich invoice with related data"""
    total_amount = float(invoice.total or 0)
    paid_amount = float(getattr(invoice, 'paid_amount', 0) or 0)
    due_amount = getattr(invoice, 'due_amount', None)
    if due_amount is None:
        due_amount = max(0.0, total_amount - paid_amount)

    invoice_dict = {
        'id': invoice.id,
        'clinic_id': invoice.clinic_id,
        'patient_id': invoice.patient_id,
        'patient_name': invoice.patient.name if invoice.patient else None,
        'patient_phone': invoice.patient.phone if invoice.patient else None,
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
                'sync_status': getattr(item, 'sync_status', 'local')
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
        })

    return {
        "entries": entries,
        "total": round(total, 2),
        "cash": round(cash, 2),
        "online": round(online, 2),
        "count": len(entries),
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
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
        "Status", "Total", "Paid", "Due", "Payment Mode", "Payments", "Notes",
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
        writer.writerow([
            inv.invoice_number,
            inv.created_at.strftime("%Y-%m-%d") if inv.created_at else "",
            (pat.display_id if pat else "") or "",
            (pat.name if pat else "") or "",
            (pat.phone if pat else "") or "",
            INVOICE_STATUS_LABELS.get(inv.status, inv.status),
            f"{total:.2f}", f"{paid:.2f}", f"{due:.2f}",
            inv.payment_mode or "",
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """CSV of money received in a date window (default today). One row per payment,
    so partials on older invoices each appear. Matches the Today's Collection view."""
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

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Invoice Number", "Patient ID", "Patient Name", "Phone",
        "Amount Collected", "Method", "Invoice Status", "Note",
    ])
    for pay, inv, pat in rows:
        writer.writerow([
            pay.paid_on.isoformat() if pay.paid_on else "",
            inv.invoice_number,
            (pat.display_id if pat else "") or "",
            (pat.name if pat else "") or "",
            (pat.phone if pat else "") or "",
            f"{float(pay.amount or 0):.2f}",
            pay.method or "",
            INVOICE_STATUS_LABELS.get(inv.status, inv.status),
            (pay.note or "").replace("\n", " "),
        ])

    filename = f"collections_{d_from.isoformat()}_to_{d_to.isoformat()}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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

    payment = InvoicePayment(
        invoice_id=invoice.id, clinic_id=current_user.clinic_id,
        amount=float(payload.amount), paid_on=paid_on,
        method=payload.method, note=payload.note,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a line item"""
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

        # Detach ledger/lab-order rows that reference this line so the FK doesn't
        # block the delete. The stock movement / lab order itself stays; it's
        # just no longer billed to this line.
        from models import InventoryTransaction, LabOrder
        db.query(InventoryTransaction).filter(
            InventoryTransaction.invoice_line_item_id == line_item_id
        ).update({InventoryTransaction.invoice_line_item_id: None}, synchronize_session=False)
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
        db.add(InvoicePayment(
            invoice_id=invoice.id, clinic_id=current_user.clinic_id,
            amount=float(payment_amount), paid_on=clinic_today(invoice.clinic),
            method=payment_data.payment_mode, note=None,
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



