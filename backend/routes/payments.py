from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional
from datetime import datetime, timedelta

from database import SessionLocal
from models import Payment, Patient, ScanType, User, Clinic
from schemas import PaymentCreate, PaymentUpdate, PaymentOut
from auth import get_current_user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()

@router.post("/", response_model=PaymentOut)
async def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new payment record"""
    try:
        # Verify patient exists and belongs to user's clinic
        patient = db.query(Patient).filter(
            and_(
                Patient.id == payment_data.patient_id,
                Patient.clinic_id == current_user.clinic_id
            )
        ).first()
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Create payment record
        db_payment = Payment(
            clinic_id=current_user.clinic_id,
            patient_id=payment_data.patient_id,
            report_id=payment_data.report_id,
            scan_type_id=payment_data.scan_type_id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            status=payment_data.status,
            transaction_id=payment_data.transaction_id,
            notes=payment_data.notes,
            paid_by=payment_data.paid_by or patient.name,
            received_by=payment_data.received_by or current_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(db_payment)
        db.commit()
        db.refresh(db_payment)
        
        # Return enriched payment data
        return get_enriched_payment(db, db_payment)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating payment: {str(e)}")

@router.get("/", response_model=List[PaymentOut])
async def get_payments(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(100, description="Number of records to return"),
    status: Optional[str] = Query(None, description="Filter by payment status"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    patient_name: Optional[str] = Query(None, description="Search by patient name"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments for the current user's clinic with optional filters"""
    try:
        query = db.query(Payment).filter(Payment.clinic_id == current_user.clinic_id)
        
        # Apply filters
        if status:
            query = query.filter(Payment.status == status)
        
        if payment_method:
            query = query.filter(Payment.payment_method == payment_method)
        
        if patient_name:
            query = query.join(Patient).filter(
                Patient.name.ilike(f"%{patient_name}%")
            )
        
        if date_from:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d")
                query = query.filter(Payment.created_at >= from_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(Payment.created_at < to_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
        
        # Order by creation date (newest first) and apply pagination
        payments = query.order_by(desc(Payment.created_at)).offset(skip).limit(limit).all()
        
        # Return enriched payment data
        return [get_enriched_payment(db, payment) for payment in payments]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching payments: {str(e)}")

@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific payment by ID"""
    payment = db.query(Payment).filter(
        and_(
            Payment.id == payment_id,
            Payment.clinic_id == current_user.clinic_id
        )
    ).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return get_enriched_payment(db, payment)

@router.put("/{payment_id}", response_model=PaymentOut)
async def update_payment(
    payment_id: int,
    payment_update: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a payment record"""
    try:
        payment = db.query(Payment).filter(
            and_(
                Payment.id == payment_id,
                Payment.clinic_id == current_user.clinic_id
            )
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update fields that are provided
        update_data = payment_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(payment, field, value)
        
        payment.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(payment)
        
        return get_enriched_payment(db, payment)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating payment: {str(e)}")

@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a payment record"""
    try:
        payment = db.query(Payment).filter(
            and_(
                Payment.id == payment_id,
                Payment.clinic_id == current_user.clinic_id
            )
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        db.delete(payment)
        db.commit()
        
        return {"message": "Payment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting payment: {str(e)}")

@router.get("/stats/summary")
async def get_payment_stats(
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment statistics for the clinic"""
    try:
        query = db.query(Payment).filter(Payment.clinic_id == current_user.clinic_id)
        
        # Apply date filters
        if date_from:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d")
                query = query.filter(Payment.created_at >= from_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(Payment.created_at < to_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
        
        all_payments = query.all()
        
        total_amount = sum(p.amount for p in all_payments)
        successful_payments = [p for p in all_payments if p.status == 'success']
        pending_payments = [p for p in all_payments if p.status == 'pending']
        failed_payments = [p for p in all_payments if p.status == 'failed']
        refunded_payments = [p for p in all_payments if p.status == 'refunded']
        
        successful_amount = sum(p.amount for p in successful_payments)
        pending_amount = sum(p.amount for p in pending_payments)
        failed_amount = sum(p.amount for p in failed_payments)
        refunded_amount = sum(p.amount for p in refunded_payments)
        
        # Payment method breakdown
        payment_methods = {}
        for payment in all_payments:
            method = payment.payment_method
            if method not in payment_methods:
                payment_methods[method] = {"count": 0, "amount": 0}
            payment_methods[method]["count"] += 1
            payment_methods[method]["amount"] += payment.amount
        
        return {
            "total_payments": len(all_payments),
            "total_amount": total_amount,
            "successful_payments": len(successful_payments),
            "successful_amount": successful_amount,
            "pending_payments": len(pending_payments),
            "pending_amount": pending_amount,
            "failed_payments": len(failed_payments),
            "failed_amount": failed_amount,
            "refunded_payments": len(refunded_payments),
            "refunded_amount": refunded_amount,
            "payment_methods": payment_methods
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching payment stats: {str(e)}")

def get_enriched_payment(db: Session, payment: Payment) -> PaymentOut:
    """Helper function to enrich payment data with related information"""
    # Get patient info
    patient = db.query(Patient).filter(Patient.id == payment.patient_id).first()
    
    # Get scan type info
    scan_type = None
    if payment.scan_type_id:
        scan_type = db.query(ScanType).filter(ScanType.id == payment.scan_type_id).first()
    
    # Get received by user info
    received_by_user = None
    if payment.received_by:
        received_by_user = db.query(User).filter(User.id == payment.received_by).first()
    
    # Build enriched payment object
    payment_dict = {
        "id": payment.id,
        "clinic_id": payment.clinic_id,
        "patient_id": payment.patient_id,
        "display_id": payment.display_id,  # Invoice Number
        "report_id": payment.report_id,
        "scan_type_id": payment.scan_type_id,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "status": payment.status,
        "transaction_id": payment.transaction_id,
        "notes": payment.notes,
        "paid_by": payment.paid_by,
        "received_by": payment.received_by,
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
        "patient_name": patient.name if patient else None,
        "patient_phone": patient.phone if patient else None,
        "patient_email": getattr(patient, 'email', None) if patient else None,
        "scan_type_name": scan_type.name if scan_type else None,
        "received_by_name": received_by_user.name if received_by_user else None
    }
    
    return PaymentOut(**payment_dict)
