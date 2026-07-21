from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io
import uuid

from database import get_db
from models import User, Invoice, Expense, Patient, Vendor, InvoicePayment
from core.auth_utils import get_current_user
from schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut, LedgerItemOut
from domains.infrastructure.services.r2_storage import upload_bytes_to_r2

router = APIRouter(prefix="/ledger", tags=["Ledger"])

def enrich_expense(db: Session, expense: Expense):
    """Helper to add string names for Pydantic response"""
    expense_out = expense.__dict__.copy()
    if expense.vendor:
        expense_out['vendor_name'] = expense.vendor.name
    if expense.creator:
        expense_out['creator_name'] = expense.creator.name
    return expense_out

def _parse_ledger_dates(date_from: Optional[str], date_to: Optional[str]):
    """Parse optional YYYY-MM-DD strings into date objects for the movement window."""
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    return d_from, d_to


@router.get("/count")
async def count_ledger(
    type_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Total ledger rows matching the filter (for pagination). Income rows are
    individual payments, so this counts payments + expenses, not invoices. Shares
    the builder with the list so the count and the rows always agree."""
    d_from, d_to = _parse_ledger_dates(date_from, date_to)
    items = _build_ledger_items(db, current_user.clinic_id, type_filter, d_from, d_to)
    return {"total": len(items)}


def _build_ledger_items(db, clinic_id, type_filter=None, d_from=None, d_to=None):
    """Combined day book rows: money in = each payment received, money out = each
    expense. Optional date window filters on the movement date (paid_on / expense
    date). Sorted newest first. Shared by the list, and the CSV export."""
    items = []

    # Money in — one entry per payment actually received (not the invoice total).
    if not type_filter or type_filter == 'invoice':
        pq = (
            db.query(InvoicePayment, Invoice, Patient)
            .join(Invoice, InvoicePayment.invoice_id == Invoice.id)
            .outerjoin(Patient, Invoice.patient_id == Patient.id)
            .filter(InvoicePayment.clinic_id == clinic_id)
        )
        if d_from:
            pq = pq.filter(InvoicePayment.paid_on >= d_from)
        if d_to:
            pq = pq.filter(InvoicePayment.paid_on <= d_to)
        for pay, inv, pat in pq.all():
            if pay.paid_on:
                # Anchor a pure payment date at noon UTC so it renders as the same
                # calendar day in any clinic timezone (never rolls to the day before).
                item_date = datetime(pay.paid_on.year, pay.paid_on.month, pay.paid_on.day, 12, 0)
            else:
                item_date = pay.created_at or inv.created_at

            desc_txt = f"Payment for {inv.invoice_number}"
            if pay.note:
                desc_txt += f" — {pay.note}"

            items.append(
                LedgerItemOut(
                    id=pay.id,
                    type='invoice',
                    date=item_date,
                    amount=float(pay.amount or 0),
                    payment_method=pay.method or inv.payment_mode,
                    category="Patient Payment",
                    description=desc_txt,
                    entity_name=pat.name if pat else None,
                    entity_id=inv.patient_id,
                    status=inv.status,
                    invoice_number=inv.invoice_number,
                    invoice_id=inv.id,
                    recorded_at=pay.created_at,
                )
            )

    # Money out — one entry per expense.
    if not type_filter or type_filter == 'expense':
        eq = db.query(Expense).filter(Expense.clinic_id == clinic_id)
        if d_from:
            eq = eq.filter(Expense.date >= datetime(d_from.year, d_from.month, d_from.day))
        if d_to:
            eq = eq.filter(Expense.date < datetime(d_to.year, d_to.month, d_to.day) + timedelta(days=1))
        for exp in eq.all():
            vendor_name = exp.vendor.name if exp.vendor else None
            items.append(
                LedgerItemOut(
                    id=exp.id,
                    type='expense',
                    date=exp.date,
                    amount=exp.amount,
                    payment_method=exp.payment_method,
                    category=exp.category,
                    description=exp.notes or f"{exp.category} Expense",
                    entity_name=vendor_name,
                    entity_id=exp.vendor_id,
                    status="paid",
                    bill_file_url=exp.bill_file_url,
                    recorded_at=exp.date,
                )
            )

    items.sort(key=lambda x: x.date, reverse=True)
    return items


@router.get("", response_model=List[LedgerItemOut])
async def get_ledger(
    skip: int = 0,
    limit: int = 100,
    type_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Combined ledger of money in (each payment received) and money out (each
    expense). Income is per-payment, not per-invoice, so a procedure paid in
    small amounts shows every dated collection, like a real day book."""
    d_from, d_to = _parse_ledger_dates(date_from, date_to)
    items = _build_ledger_items(db, current_user.clinic_id, type_filter, d_from, d_to)
    return items[skip:skip + limit]


@router.get("/export")
async def export_ledger(
    type_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """CSV of the ledger: one row per money movement (payment in / expense out),
    with direction, party, description and method. Dates filter the movement date."""
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    items = _build_ledger_items(db, current_user.clinic_id, type_filter, d_from, d_to)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Direction", "Type", "Party", "Description", "Category",
        "Amount", "Method", "Invoice Number", "Bill URL",
    ])
    for it in items:
        is_in = it.type == 'invoice'
        writer.writerow([
            it.date.strftime("%Y-%m-%d") if it.date else "",
            "In" if is_in else "Out",
            "Payment" if is_in else "Expense",
            it.entity_name or "",
            (it.description or "").replace("\n", " "),
            it.category or "",
            f"{float(it.amount or 0):.2f}",
            it.payment_method or "",
            it.invoice_number or "",
            it.bill_file_url or "",
        ])

    tag = type_filter or "all"
    filename = f"ledger_{tag}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post("/expenses", response_model=ExpenseOut)
async def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record a new outgoing expense"""
    try:
        if expense.vendor_id:
            vendor = db.query(Vendor).filter(
                Vendor.id == expense.vendor_id,
                Vendor.clinic_id == current_user.clinic_id
            ).first()
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found")
                
        db_expense = Expense(
            clinic_id=current_user.clinic_id,
            vendor_id=expense.vendor_id,
            amount=expense.amount,
            payment_method=expense.payment_method,
            category=expense.category,
            notes=expense.notes,
            date=expense.date or datetime.utcnow(),
            created_by=current_user.id
        )
        
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        
        return enrich_expense(db, db_expense)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific expense by ID"""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.clinic_id == current_user.clinic_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    return enrich_expense(db, expense)

@router.put("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing expense"""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.clinic_id == current_user.clinic_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    try:
        if expense_update.vendor_id is not None:
            if expense_update.vendor_id != 0:
                vendor = db.query(Vendor).filter(
                    Vendor.id == expense_update.vendor_id,
                    Vendor.clinic_id == current_user.clinic_id
                ).first()
                if not vendor:
                    raise HTTPException(status_code=404, detail="Vendor not found")
                expense.vendor_id = expense_update.vendor_id
            else:
                expense.vendor_id = None

        if expense_update.amount is not None:
            expense.amount = expense_update.amount
        if expense_update.payment_method is not None:
            expense.payment_method = expense_update.payment_method
        if expense_update.category is not None:
            expense.category = expense_update.category
        if expense_update.notes is not None:
            expense.notes = expense_update.notes
        if expense_update.date is not None:
            expense.date = expense_update.date

        expense.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(expense)
        
        return enrich_expense(db, expense)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an expense"""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.clinic_id == current_user.clinic_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    try:
        db.delete(expense)
        db.commit()
        return {"success": True, "message": "Expense deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/expenses/{expense_id}/bill")
async def upload_expense_bill(
    expense_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a bill image/pdf for an expense"""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.clinic_id == current_user.clinic_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    try:
        content = await file.read()
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'dat'
        safe_filename = f"expense_bill_{expense.id}_{uuid.uuid4().hex[:8]}.{file_ext}"

        # Using standardized r2 storage path
        url = upload_bytes_to_r2(
            data=content,
            filename=safe_filename,
            content_type=file.content_type,
            clinic_id=current_user.clinic_id,
            category=StorageCategory.EXPENSES
        )
        
        if not url:
            raise Exception("Failed to upload to R2 storage")
            
        expense.bill_file_url = url
        db.commit()
        db.refresh(expense)
        
        return enrich_expense(db, expense)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
