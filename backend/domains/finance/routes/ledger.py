from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import uuid

from database import get_db
from models import User, Invoice, Expense, Patient, Vendor
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

@router.get("", response_model=List[LedgerItemOut])
async def get_ledger(
    skip: int = 0,
    limit: int = 100,
    type_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get combined ledger of invoices (income) and expenses (outflow)"""
    items = []
    
    # Get Invoices
    if not type_filter or type_filter == 'invoice':
        invoices = db.query(Invoice).filter(
            Invoice.clinic_id == current_user.clinic_id
        ).all()
        
        for inv in invoices:
            patient_name = None
            if inv.patient:
                patient_name = inv.patient.name
            
            # Use paid_at for date if available, else created_at
            item_date = inv.paid_at if inv.paid_at else inv.created_at
            
            items.append(
                LedgerItemOut(
                    id=inv.id,
                    type='invoice',
                    date=item_date,
                    amount=inv.total,
                    payment_method=inv.payment_mode,
                    category="Patient Payment",
                    description=f"Invoice {inv.invoice_number}",
                    entity_name=patient_name,
                    entity_id=inv.patient_id,
                    status=inv.status,
                    invoice_number=inv.invoice_number
                )
            )

    # Get Expenses
    if not type_filter or type_filter == 'expense':
        expenses = db.query(Expense).filter(
            Expense.clinic_id == current_user.clinic_id
        ).all()
        
        for exp in expenses:
            vendor_name = None
            if exp.vendor:
                vendor_name = exp.vendor.name
                
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
                    bill_file_url=exp.bill_file_url
                )
            )
            
    # Sort by date descending
    items.sort(key=lambda x: x.date, reverse=True)
    
    # Paginate
    return items[skip:skip+limit]

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
