from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import CasePaper, User, Appointment
from schemas import CasePaperCreate, CasePaperUpdate, CasePaperOut
from core.auth_utils import get_current_user, require_doctor_or_owner
from typing import List, Optional, Any
from datetime import datetime
import json

router = APIRouter(prefix="/case-papers", tags=["case-papers"])

@router.get("/patient/{patient_id}", response_model=List[CasePaperOut])
def get_patient_case_papers(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all clinical case papers for a specific patient."""
    return db.query(CasePaper).filter(
        CasePaper.patient_id == patient_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).order_by(CasePaper.date.desc()).all()

@router.post("", response_model=CasePaperOut)
def create_case_paper(
    case_paper: CasePaperCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Create a new clinical case paper for a patient visit."""
    # Serialize lists to JSON strings for Text columns
    data = case_paper.model_dump(exclude={"clinic_id"})
    if isinstance(data.get('chief_complaint'), list):
        data['chief_complaint'] = json.dumps(data['chief_complaint'])
    if isinstance(data.get('dental_history'), list):
        data['dental_history'] = json.dumps(data['dental_history'])

    # Drop a stale appointment link silently — FK is nullable, so a deleted
    # or wrong-clinic appointment_id should produce an unlinked case paper
    # rather than a 500 ForeignKeyViolation.
    if data.get("appointment_id") is not None:
        exists = db.query(Appointment.id).filter(
            Appointment.id == data["appointment_id"],
            Appointment.clinic_id == current_user.clinic_id
        ).first()
        if not exists:
            data["appointment_id"] = None

    db_paper = CasePaper(
        **data,
        clinic_id=current_user.clinic_id
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)
    return db_paper

@router.get("/{paper_id}", response_model=CasePaperOut)
def get_case_paper(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch a specific case paper by ID."""
    paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Case paper not found")
    return paper

@router.put("/{paper_id}", response_model=CasePaperOut)
def update_case_paper(
    paper_id: int,
    case_paper_update: CasePaperUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Update clinical details in an existing case paper."""
    db_paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_paper:
        raise HTTPException(status_code=404, detail="Case paper not found")
        
    update_data = case_paper_update.model_dump(exclude_unset=True)
    
    # Serialize lists to JSON strings for Text columns
    if 'chief_complaint' in update_data and isinstance(update_data['chief_complaint'], list):
        update_data['chief_complaint'] = json.dumps(update_data['chief_complaint'])
    if 'dental_history' in update_data and isinstance(update_data['dental_history'], list):
        update_data['dental_history'] = json.dumps(update_data['dental_history'])
        
    for key, value in update_data.items():
        setattr(db_paper, key, value)
        
    db_paper.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_paper)
    return db_paper

@router.delete("/{paper_id}")
def delete_case_paper(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Delete a clinical case paper."""
    db_paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_paper:
        raise HTTPException(status_code=404, detail="Case paper not found")
        
    db.delete(db_paper)
    db.commit()
    return {"message": "Case paper deleted successfully"}
