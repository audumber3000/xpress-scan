from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from database import get_db
from models import LabOrder, User, Patient, Vendor
from schemas import LabOrderCreate, LabOrderUpdate, LabOrderOut
from core.auth_utils import get_current_user
from typing import List, Optional

router = APIRouter(prefix="/lab-orders", tags=["lab-orders"])

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
        
    db.delete(db_order)
    db.commit()
    return {"message": "Lab order deleted successfully"}
