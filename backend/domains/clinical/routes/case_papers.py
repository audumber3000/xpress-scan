from fastapi import APIRouter, HTTPException, Depends, status, Response
from sqlalchemy.orm import Session
from database import get_db
from models import (
    CasePaper, User, Appointment, Clinic, Patient,
    Invoice, LabOrder, Prescription, CaseCost, InventoryTransaction,
)
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
    """Delete a clinical case paper, and say why when it cannot be deleted.

    Five tables point at case_papers, and this used to hand all of them to a
    bare `db.delete()`. Any paper with so much as one linked row raised a
    ForeignKeyViolation, which reached the front desk as a 500 with no
    explanation and no way to tell which record was in the way.

    The children are not equivalent, so they are not treated alike:

      * Invoices and lab orders BLOCK the delete. Both are commitments made
        outside this record — money a patient owes, work a lab has been asked
        for — and neither should vanish because somebody tidied up a visit, nor
        be silently cut loose from the visit that explains it.
      * Case costs are DELETED with it. A consultant's fee exists only to
        attribute this visit's work; with the visit gone it attributes nothing.
      * Prescriptions and stock movements are DETACHED. A prescription was
        handed to a patient and the stock really did leave the shelf; both
        outlive the paperwork, so they keep existing and lose the link.
    """
    db_paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()

    if not db_paper:
        raise HTTPException(status_code=404, detail="Case paper not found")

    invoices = db.query(Invoice).filter(Invoice.case_paper_id == paper_id).count()
    lab_orders = db.query(LabOrder).filter(LabOrder.case_paper_id == paper_id).count()

    if invoices or lab_orders:
        blockers = []
        if invoices:
            blockers.append(f"{invoices} invoice{'s' if invoices != 1 else ''}")
        if lab_orders:
            blockers.append(f"{lab_orders} lab order{'s' if lab_orders != 1 else ''}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This visit has {' and '.join(blockers)} attached to it. "
                "Cancel or move those first, then delete the visit."
            ),
        )

    db.query(CaseCost).filter(CaseCost.case_paper_id == paper_id).delete(synchronize_session=False)
    db.query(Prescription).filter(Prescription.case_paper_id == paper_id).update(
        {Prescription.case_paper_id: None}, synchronize_session=False
    )
    db.query(InventoryTransaction).filter(InventoryTransaction.case_paper_id == paper_id).update(
        {InventoryTransaction.case_paper_id: None}, synchronize_session=False
    )

    db.delete(db_paper)
    db.commit()
    return {"message": "Case paper deleted successfully"}


# ── Visit summary ────────────────────────────────────────────────────────────
# The visit told to the patient rather than to the file. Lives here because it
# is a view of a case paper, not a thing of its own.

def _summary_pdf(db: Session, cp) -> bytes:
    import os
    from models import Clinic, User as U
    from domains.clinical.summary_pdf import render_summary
    from domains.infrastructure.services.pdf_service import html_template_to_pdf

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    dentist = db.query(U).filter(U.id == cp.dentist_id).first() if cp.dentist_id else None
    # A clinic on the general case paper does not employ a "Dentist", and the
    # summary is signed off with a role the patient will recognise.
    is_dental = (getattr(clinic, "case_paper_type", None) or "dental") != "general"
    html = render_summary(cp, clinic, dentist.name if dentist else "", is_dental)
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _load_paper(db: Session, paper_id: int, current_user):
    cp = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id,
    ).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Case paper not found")
    return cp


@router.get("/{paper_id}/summary-pdf")
async def visit_summary_pdf(paper_id: int, db: Session = Depends(get_db),
                            current_user=Depends(get_current_user)):
    cp = _load_paper(db, paper_id, current_user)
    return Response(
        content=_summary_pdf(db, cp),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Visit_summary_{paper_id}.pdf"'},
    )


@router.post("/{paper_id}/send-summary")
async def send_visit_summary(paper_id: int, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    """WhatsApp the visit summary to the patient.

    Manual rather than automatic on completion. A case paper is marked complete
    while the patient is still in the chair and often edited afterwards, so
    firing on that would send half-written summaries — and every send costs
    wallet credit. The clinic presses this when the note is actually finished.
    """
    from models import Clinic, NotificationPreference
    from core.notification_dispatch import notify_event, InsufficientWalletBalance

    cp = _load_paper(db, paper_id, current_user)
    if not cp.patient or not cp.patient.phone:
        raise HTTPException(status_code=400, detail="This patient has no phone number on file.")

    pref = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == current_user.clinic_id,
        NotificationPreference.event_type == "treatment_summary",
    ).first()
    if not pref or not pref.is_enabled:
        return {"sent": False, "reason": "not_configured",
                "message": "Visit summaries aren't switched on for this clinic. "
                           "Download the PDF and send it yourself."}

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    try:
        notify_event(
            "treatment_summary",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=cp.patient.phone,
            to_name=cp.patient.name,
            required=True,
            template_data={
                "patient_name": cp.patient.name,
                "clinic_name": clinic.name if clinic else "",
                "visit_date": cp.date.strftime("%d %B %Y") if cp.date else "",
                "clinic_phone": getattr(clinic, "phone", "") or "",
            },
        )
    except InsufficientWalletBalance:
        raise
    return {"sent": True}
