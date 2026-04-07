from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import Prescription, User, Patient
from schemas import PrescriptionCreate, PrescriptionOut
from core.auth_utils import get_current_user, require_doctor_or_owner
from typing import List, Optional
from datetime import datetime
from domains.activity.routes.activity_log import push_activity

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

@router.get("/patient/{patient_id}", response_model=List[PrescriptionOut])
def get_patient_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all medication prescriptions for a patient."""
    return db.query(Prescription).filter(
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id
    ).order_by(Prescription.created_at.desc()).all()

@router.post("", response_model=PrescriptionOut)
def create_prescription(
    prescription: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """
    Create a new medication prescription.
    Stores the prescription data in the main backend.
    PDF generation triggers separately via Nexus.
    """
    # Convert item models to dicts for JSON storage
    items_data = [item.model_dump() for item in prescription.items]
    
    db_prescription = Prescription(
        **prescription.model_dump(exclude={"clinic_id", "items"}),
        items=items_data,
        clinic_id=current_user.clinic_id
    )
    db.add(db_prescription)
    db.commit()
    db.refresh(db_prescription)
    try:
        patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
        actor = getattr(current_user, 'name', None) or getattr(current_user, 'email', 'Doctor')
        push_activity(db, current_user.clinic_id, 'prescription_saved',
            f"Prescription saved for {patient.name if patient else 'patient'}",
            link=f"/patients/{prescription.patient_id}",
            actor_name=actor)
        db.commit()
    except Exception:
        pass
    return db_prescription

@router.delete("/{prescription_id}")
def delete_prescription(
    prescription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Delete a medication prescription."""
    db_prescription = db.query(Prescription).filter(
        Prescription.id == prescription_id,
        Prescription.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
        
    db.delete(db_prescription)
    db.commit()
    return {"message": "Prescription deleted successfully"}
