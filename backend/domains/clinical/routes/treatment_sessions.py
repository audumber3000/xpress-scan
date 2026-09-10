"""Courses of treatment sold as a fixed number of sittings.

A skin clinic sells "laser hair reduction, 6 sittings" and needs to know how
many are left. Nothing else in this product counts sittings.

Temporary, and built to stay that way — see the TreatmentSession model for why
this is its own table rather than counters hung off the treatment plan. This
module is the only place that knows the word "session"; deleting it and the one
card on the patient profile removes the feature.

Every route is clinic-scoped and permission-gated with the same dependencies the
patient routes use, so a course is exactly as private as the patient it belongs
to.
"""
import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth_utils import require_patients_edit, require_patients_view
from database import get_db
from models import CasePaper, Patient, TreatmentSession, User

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_SESSIONS = 200


class SessionCreate(BaseModel):
    patient_id: int
    label: str = Field(min_length=1, max_length=120)
    total_sessions: int = Field(ge=1, le=MAX_SESSIONS)
    case_paper_id: Optional[int] = None
    notes: Optional[str] = None


class SessionUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=120)
    total_sessions: Optional[int] = Field(default=None, ge=1, le=MAX_SESSIONS)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SessionUse(BaseModel):
    note: Optional[str] = None


class SessionOut(BaseModel):
    id: int
    patient_id: int
    case_paper_id: Optional[int] = None
    label: str
    total_sessions: int
    used_sessions: int
    remaining: int
    notes: Optional[str] = None
    is_active: bool
    ledger: list = []
    created_at: Optional[datetime.datetime] = None


def _serialize(row: TreatmentSession) -> SessionOut:
    used = int(row.used_sessions or 0)
    total = int(row.total_sessions or 0)
    return SessionOut(
        id=row.id,
        patient_id=row.patient_id,
        case_paper_id=row.case_paper_id,
        label=row.label,
        total_sessions=total,
        used_sessions=used,
        # Derived, never stored. A stored remaining count is a third number that
        # eventually disagrees with the two it comes from.
        remaining=max(total - used, 0),
        notes=row.notes,
        is_active=bool(row.is_active),
        ledger=list(row.ledger or []),
        created_at=row.created_at,
    )


def _get_owned(db: Session, session_id: int, user: User) -> TreatmentSession:
    row = db.query(TreatmentSession).filter(
        TreatmentSession.id == session_id,
        TreatmentSession.clinic_id == user.clinic_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="That course was not found.")
    return row


@router.get("/patients/{patient_id}", response_model=List[SessionOut])
def list_for_patient(
    patient_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_view),
):
    """Every course on this patient, newest first."""
    patient = db.query(Patient).filter(
        Patient.id == patient_id, Patient.clinic_id == current_user.clinic_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    q = db.query(TreatmentSession).filter(
        TreatmentSession.clinic_id == current_user.clinic_id,
        TreatmentSession.patient_id == patient_id,
    )
    if not include_inactive:
        q = q.filter(TreatmentSession.is_active.is_(True))
    return [_serialize(r) for r in q.order_by(TreatmentSession.created_at.desc()).all()]


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id, Patient.clinic_id == current_user.clinic_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # A case paper from another clinic, or another patient, is not a link worth
    # keeping — drop it rather than storing something that reads as history.
    case_paper_id = None
    if payload.case_paper_id:
        paper = db.query(CasePaper).filter(
            CasePaper.id == payload.case_paper_id,
            CasePaper.clinic_id == current_user.clinic_id,
            CasePaper.patient_id == payload.patient_id,
        ).first()
        case_paper_id = paper.id if paper else None

    row = TreatmentSession(
        clinic_id=current_user.clinic_id,
        patient_id=payload.patient_id,
        case_paper_id=case_paper_id,
        label=payload.label.strip(),
        total_sessions=payload.total_sessions,
        used_sessions=0,
        ledger=[],
        notes=(payload.notes or "").strip() or None,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.post("/{session_id}/use", response_model=SessionOut)
def use_session(
    session_id: int,
    payload: SessionUse,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    """Record one sitting as used.

    Refused past the total rather than allowed to run negative. A clinic that
    genuinely gave a seventh sitting on a six-sitting course should raise the
    total, which leaves a record of the decision; silently going to 7 of 6 does
    not.
    """
    row = _get_owned(db, session_id, current_user)

    if int(row.used_sessions or 0) >= int(row.total_sessions or 0):
        raise HTTPException(
            status_code=400,
            detail=(
                f"All {row.total_sessions} sittings on this course are used. "
                "Raise the total if you are adding more."
            ),
        )

    entry = {
        "used_at": datetime.datetime.utcnow().isoformat(),
        "used_by": current_user.id,
        "used_by_name": current_user.name or current_user.email or "",
        "note": (payload.note or "").strip() or None,
    }
    # Reassigned rather than appended in place: SQLAlchemy does not see a
    # mutation inside a JSON column, so an in-place append would not be saved.
    row.ledger = list(row.ledger or []) + [entry]
    row.used_sessions = int(row.used_sessions or 0) + 1
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.post("/{session_id}/undo", response_model=SessionOut)
def undo_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    """Take back the most recent sitting.

    Not optional. The count is advanced by hand, so it will be advanced by
    mistake, and a counter with no way back is one people stop trusting and go
    back to paper for — which is the problem this exists to solve.
    """
    row = _get_owned(db, session_id, current_user)
    if int(row.used_sessions or 0) <= 0:
        raise HTTPException(status_code=400, detail="No sittings have been used yet.")

    ledger = list(row.ledger or [])
    if ledger:
        ledger.pop()
    row.ledger = ledger
    row.used_sessions = int(row.used_sessions or 0) - 1
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    row = _get_owned(db, session_id, current_user)

    if payload.label is not None:
        row.label = payload.label.strip()
    if payload.notes is not None:
        row.notes = payload.notes.strip() or None
    if payload.is_active is not None:
        row.is_active = payload.is_active
    if payload.total_sessions is not None:
        # The total may be raised freely, but never below what has already been
        # given: that would make the record claim sittings happened that the
        # course does not contain.
        if payload.total_sessions < int(row.used_sessions or 0):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{row.used_sessions} sittings have already been used, so the "
                    f"total cannot be set to {payload.total_sessions}."
                ),
            )
        row.total_sessions = payload.total_sessions

    db.commit()
    db.refresh(row)
    return _serialize(row)
