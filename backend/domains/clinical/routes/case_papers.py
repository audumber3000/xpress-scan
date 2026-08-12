from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import CasePaper, User, Appointment, Clinic, Patient
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
    papers = db.query(CasePaper).filter(
        CasePaper.patient_id == patient_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).order_by(CasePaper.date.desc()).all()

    # Resolve the dentist's name onto each row. A bare dentist_id tells the case
    # paper list nothing, so every card read "Not assigned" even when the visit
    # plainly had a dentist. Set here rather than in the schema because FastAPI
    # reads attributes straight off the ORM object and never calls the schema's
    # own model_validate, so a classmethod override there is silently ignored.
    for paper in papers:
        paper.dentist_name = paper.dentist.name if paper.dentist else None

    return papers

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
    db.flush()

    # A case paper means the patient was in the clinic, so they belong in the
    # day's register even if reception never entered them. Idempotent per patient
    # per day, so someone already registered by hand isn't counted twice.
    # Best-effort: never block recording clinical work.
    try:
        from domains.patient.routes.daily_register import record_daily_visit
        reg_clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        reg_patient = db.query(Patient).filter(Patient.id == db_paper.patient_id).first()
        if reg_clinic and reg_patient:
            record_daily_visit(
                db, reg_clinic, reg_patient,
                source='case_paper',
                doctor_id=db_paper.dentist_id,
                created_by=current_user.id,
            )
    except Exception as e:
        print(f"⚠️ Could not add case paper {db_paper.id} to the daily register: {e}")

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

def _sync_fee(db, paper, actor_id):
    """Keep the treating doctor's fee in step with the case.

    Imported lazily so this module does not depend on the case-costs domain at
    import time; the fee is an add-on to the clinical record, not part of it.
    """
    try:
        from domains.clinical.routes.case_costs import sync_consultant_fee
        from models import Invoice
        inv = (
            db.query(Invoice)
            .filter(Invoice.case_paper_id == paper.id)
            .order_by(Invoice.created_at.desc())
            .first()
        )
        sync_consultant_fee(
            db, clinic_id=paper.clinic_id, patient_id=paper.patient_id,
            case_paper_id=paper.id, invoice_id=inv.id if inv else None,
            doctor_user_id=paper.dentist_id, actor_id=actor_id,
        )
    except Exception:  # noqa: BLE001 — never block a clinical save
        pass


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

    # The treating doctor may have just been set or changed, so the fee owed
    # for this case follows from their configured rate. Nobody types an amount.
    _sync_fee(db, db_paper, current_user.id)

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
