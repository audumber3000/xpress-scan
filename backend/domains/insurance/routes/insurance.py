"""Insurers a clinic bills, the cover a patient holds, and what a bill splits to."""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import InsurancePayer, PatientInsurance, Patient, User
from core.auth_utils import get_current_user
from domains.insurance.estimator import (
    BENEFIT_CATEGORIES, estimate_lines, policy_to_dict, normalise_category,
)

router = APIRouter()


class PayerDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    payer_code: Optional[str] = Field(None, max_length=64)
    phone: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None
    is_active: bool = True


class CoverageDTO(BaseModel):
    payer_id: int
    policy_number: Optional[str] = Field(None, max_length=64)
    subscriber_name: Optional[str] = Field(None, max_length=200)
    subscriber_relation: Optional[str] = Field(None, pattern="^(self|spouse|child|other)$")
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    coverage: Optional[dict] = None
    deductible: Optional[float] = Field(None, ge=0)
    deductible_met: Optional[float] = Field(None, ge=0)
    annual_max: Optional[float] = Field(None, ge=0)
    annual_used: Optional[float] = Field(None, ge=0)
    is_active: bool = True


class EstimateLineDTO(BaseModel):
    description: Optional[str] = None
    amount: float = 0.0
    benefit_category: Optional[str] = None


class EstimateDTO(BaseModel):
    patient_id: int
    lines: List[EstimateLineDTO] = []


def _clean_coverage(raw: Optional[dict]) -> dict:
    """Keep only the four bands, as numbers between 0 and 100.

    A percentage typed as 800 would otherwise have the insurer paying eight
    times the fee, and the estimate is the one figure here nobody re-checks.
    """
    out = {}
    for k, v in (raw or {}).items():
        band = normalise_category(k)
        if (k or "").strip().lower() not in BENEFIT_CATEGORIES:
            continue
        try:
            out[band] = max(0.0, min(100.0, float(v)))
        except (TypeError, ValueError):
            continue
    return out


@router.get("/payers")
async def list_payers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (db.query(InsurancePayer)
            .filter(InsurancePayer.clinic_id == current_user.clinic_id)
            .order_by(InsurancePayer.name).all())
    return [{"id": p.id, "name": p.name, "payer_code": p.payer_code,
             "phone": p.phone, "notes": p.notes, "is_active": p.is_active} for p in rows]


@router.post("/payers")
async def create_payer(payload: PayerDTO, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    p = InsurancePayer(clinic_id=current_user.clinic_id, **payload.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return {"id": p.id, "name": p.name}


@router.put("/payers/{payer_id}")
async def update_payer(payer_id: int, payload: PayerDTO, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    p = db.query(InsurancePayer).filter(
        InsurancePayer.id == payer_id,
        InsurancePayer.clinic_id == current_user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Insurer not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return {"id": p.id, "name": p.name}


@router.delete("/payers/{payer_id}")
async def delete_payer(payer_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    p = db.query(InsurancePayer).filter(
        InsurancePayer.id == payer_id,
        InsurancePayer.clinic_id == current_user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Insurer not found")
    # Patients still point at it, and their policy numbers would become
    # unreadable. Retire it instead so history stays legible.
    held = db.query(PatientInsurance).filter(PatientInsurance.payer_id == payer_id).count()
    if held:
        p.is_active = False
        db.commit()
        return {"deleted": False, "deactivated": True, "patients": held}
    db.delete(p); db.commit()
    return {"deleted": True}


@router.get("/patient/{patient_id}")
async def get_patient_cover(patient_id: int, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    rows = (db.query(PatientInsurance)
            .filter(PatientInsurance.patient_id == patient_id,
                    PatientInsurance.clinic_id == current_user.clinic_id)
            .order_by(PatientInsurance.is_active.desc(), PatientInsurance.id.desc()).all())
    today = date.today()
    return [{
        "id": r.id, "payer_id": r.payer_id,
        "payer_name": r.payer.name if r.payer else None,
        "policy_number": r.policy_number,
        "subscriber_name": r.subscriber_name,
        "subscriber_relation": r.subscriber_relation,
        "valid_from": r.valid_from.isoformat() if r.valid_from else None,
        "valid_to": r.valid_to.isoformat() if r.valid_to else None,
        "coverage": r.coverage or {},
        "deductible": r.deductible, "deductible_met": r.deductible_met,
        "annual_max": r.annual_max, "annual_used": r.annual_used,
        "is_active": r.is_active,
        # Said plainly rather than left for the caller to work out, because an
        # expired policy that still looks active is how a patient gets quoted a
        # discount they will not receive.
        "expired": bool(r.valid_to and r.valid_to < today),
        "remaining_deductible": max((r.deductible or 0) - (r.deductible_met or 0), 0),
        "remaining_annual": (None if r.annual_max is None
                             else max((r.annual_max or 0) - (r.annual_used or 0), 0)),
    } for r in rows]


@router.post("/patient/{patient_id}")
async def add_patient_cover(patient_id: int, payload: CoverageDTO, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(
        Patient.id == patient_id, Patient.clinic_id == current_user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    payer = db.query(InsurancePayer).filter(
        InsurancePayer.id == payload.payer_id,
        InsurancePayer.clinic_id == current_user.clinic_id).first()
    if not payer:
        raise HTTPException(404, "Insurer not found")

    data = payload.model_dump()
    data["coverage"] = _clean_coverage(data.get("coverage"))
    row = PatientInsurance(clinic_id=current_user.clinic_id, patient_id=patient_id, **data)
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id}


@router.put("/patient-cover/{cover_id}")
async def update_patient_cover(cover_id: int, payload: CoverageDTO, db: Session = Depends(get_db),
                               current_user: User = Depends(get_current_user)):
    row = db.query(PatientInsurance).filter(
        PatientInsurance.id == cover_id,
        PatientInsurance.clinic_id == current_user.clinic_id).first()
    if not row:
        raise HTTPException(404, "Cover not found")
    data = payload.model_dump()
    data["coverage"] = _clean_coverage(data.get("coverage"))
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    return {"id": row.id}


@router.delete("/patient-cover/{cover_id}")
async def delete_patient_cover(cover_id: int, db: Session = Depends(get_db),
                               current_user: User = Depends(get_current_user)):
    row = db.query(PatientInsurance).filter(
        PatientInsurance.id == cover_id,
        PatientInsurance.clinic_id == current_user.clinic_id).first()
    if not row:
        raise HTTPException(404, "Cover not found")
    db.delete(row); db.commit()
    return {"deleted": True}


def active_policy_for(db: Session, clinic_id: int, patient_id: int):
    """The cover to estimate against: active, and in date if it says a date.

    Shared so quotations and invoices pick the same policy as this endpoint —
    a quote and the bill that follows it disagreeing on which card was used is
    the kind of thing a patient notices.
    """
    today = date.today()
    rows = (db.query(PatientInsurance)
            .filter(PatientInsurance.patient_id == patient_id,
                    PatientInsurance.clinic_id == clinic_id,
                    PatientInsurance.is_active.is_(True))
            .order_by(PatientInsurance.id.desc()).all())
    for r in rows:
        if r.valid_to and r.valid_to < today:
            continue
        if r.valid_from and r.valid_from > today:
            continue
        return r
    return None


@router.post("/estimate")
async def estimate(payload: EstimateDTO, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Split a set of lines into insurer and patient shares."""
    policy = active_policy_for(db, current_user.clinic_id, payload.patient_id)
    result = estimate_lines([l.model_dump() for l in payload.lines], policy_to_dict(policy))
    result["payer_name"] = policy.payer.name if policy and policy.payer else None
    result["policy_number"] = policy.policy_number if policy else None
    return result


@router.get("/categories")
async def categories(current_user: User = Depends(get_current_user)):
    return {"categories": list(BENEFIT_CATEGORIES)}
