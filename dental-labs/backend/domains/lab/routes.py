"""
Lab routes — profile management, staff CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from core.auth import get_current_user, hash_password, require_role
from models import LabUser, Lab
from schemas.lab import (
    LabResponse, LabUpdateRequest,
    StaffCreateRequest, StaffUpdateRequest, StaffResponse,
)

router = APIRouter()


# ── Lab profile ─────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(user: LabUser = Depends(get_current_user)):
    if not user.lab:
        raise HTTPException(status_code=404, detail="Lab not found — complete onboarding first")
    return {"lab": LabResponse.model_validate(user.lab).model_dump()}


@router.put("/profile")
def update_profile(
    body: LabUpdateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    lab = user.lab
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(lab, key):
            setattr(lab, key, value)

    db.commit()
    db.refresh(lab)
    return {"lab": LabResponse.model_validate(lab).model_dump()}


# ── Staff management ────────────────────────────────────────────────────

@router.get("/staff")
def list_staff(
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    staff = db.query(LabUser).filter(
        LabUser.lab_id == user.lab_id,
        LabUser.id != user.id,  # Exclude the owner themselves
    ).all()

    return {
        "staff": [StaffResponse.model_validate(s).model_dump() for s in staff],
        "total": len(staff),
    }


@router.post("/staff")
def create_staff(
    body: StaffCreateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    # Check email uniqueness
    existing = db.query(LabUser).filter(LabUser.email == body.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    staff = LabUser(
        lab_id=user.lab_id,
        email=body.email.lower().strip(),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        name=f"{body.first_name.strip()} {body.last_name.strip()}",
        password_hash=hash_password(body.password),
        role="lab_staff",
        is_active=True,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)

    return {"staff": StaffResponse.model_validate(staff).model_dump()}


@router.put("/staff/{staff_id}")
def update_staff(
    staff_id: int,
    body: StaffUpdateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    staff = db.query(LabUser).filter(
        LabUser.id == staff_id,
        LabUser.lab_id == user.lab_id,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(staff, key):
            setattr(staff, key, value)

    # Recompute full name if name fields changed
    if "first_name" in update_data or "last_name" in update_data:
        staff.name = f"{staff.first_name} {staff.last_name}"

    db.commit()
    db.refresh(staff)
    return {"staff": StaffResponse.model_validate(staff).model_dump()}


@router.delete("/staff/{staff_id}")
def deactivate_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    staff = db.query(LabUser).filter(
        LabUser.id == staff_id,
        LabUser.lab_id == user.lab_id,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    staff.is_active = False
    db.commit()
    return {"message": "Staff member deactivated"}
