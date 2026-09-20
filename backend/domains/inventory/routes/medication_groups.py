"""
Prescription sets: a named group of medication lines a doctor applies in one go.

The clinic's own prescriptions are the argument. Across 18 of them, Paracetamol
650mg had been typed 10 times and Candid Mouth Paint 7, combinations repeated,
and one entry read "Amoxicillin 500mq". That typo is now permanently in a
patient's record, and it is what retyping the same drug every visit eventually
produces.

Two rules this module keeps:

  A set is applied, never auto-applied. The endpoint returns lines for the
  prescription form to fill in; the doctor reviews and edits before saving.
  Prescribing is the one place a convenience feature must not become an
  automation, because allergies, age and pregnancy change what is safe.

  Applying copies, it never references. The saved prescription holds its own
  copy of the lines, so editing a set next month cannot alter a prescription
  written last month.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import (MedicationGroup, MedicationGroupItem, MedicationStock,
                    TreatmentType, User)
from domains.inventory.starter_medication_sets import STARTER_SETS
from domains.inventory.seed_medication_groups import (
    add_missing_sets, seed_clinic_medication_groups,
)

router = APIRouter(prefix="/medication-groups", tags=["medication-groups"])


class GroupItemIn(BaseModel):
    medicine_name: str
    medication_stock_id: Optional[int] = None
    dosage: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None


class GroupIn(BaseModel):
    name: str
    description: Optional[str] = None
    treatment_type_id: Optional[int] = None
    audience: Optional[str] = None          # adult | child
    is_active: bool = True
    items: List[GroupItemIn] = []


def _serialise(g: MedicationGroup) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "treatment_type_id": g.treatment_type_id,
        "treatment_name": g.treatment_type.name if g.treatment_type else None,
        "audience": g.audience,
        "is_active": bool(g.is_active),
        "items": [
            {
                "id": i.id,
                "medicine_name": i.medicine_name,
                "medication_stock_id": i.medication_stock_id,
                "dosage": i.dosage,
                "duration": i.duration,
                "quantity": i.quantity,
                "notes": i.notes,
            }
            for i in sorted(g.items, key=lambda x: (x.sort_order or 0, x.id))
        ],
    }


@router.get("")
def list_groups(
    treatment_type_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every set this clinic has.

    `treatment_type_id` does not filter, it ORDERS: sets for the treatment in
    hand come first, and everything else stays reachable underneath. Filtering
    would hide the general painkiller set the moment a treatment was chosen,
    which is exactly when it is most likely wanted.
    """
    # Defaults land here, lazily and once per clinic. This endpoint is also
    # what the prescription drawer calls, so they are in place the first time
    # a doctor writes a prescription, not only once someone visits settings.
    seed_clinic_medication_groups(db, current_user.clinic_id)

    groups = (
        db.query(MedicationGroup)
        .filter(MedicationGroup.clinic_id == current_user.clinic_id,
                MedicationGroup.is_active == True)  # noqa: E712
        .all()
    )
    rows = [_serialise(g) for g in groups]
    if treatment_type_id:
        rows.sort(key=lambda r: (r["treatment_type_id"] != treatment_type_id, r["name"].lower()))
    else:
        rows.sort(key=lambda r: r["name"].lower())
    return rows


@router.post("")
def create_group(
    payload: GroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="A set needs at least one medicine")

    group = MedicationGroup(
        clinic_id=current_user.clinic_id,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        treatment_type_id=payload.treatment_type_id,
        audience=payload.audience,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(group)
    db.flush()
    _replace_items(db, group, payload.items)
    db.commit()
    db.refresh(group)
    return _serialise(group)


@router.put("/{group_id}")
def update_group(
    group_id: int,
    payload: GroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = _owned(db, group_id, current_user)
    group.name = payload.name.strip()
    group.description = (payload.description or "").strip() or None
    group.treatment_type_id = payload.treatment_type_id
    group.audience = payload.audience
    group.is_active = payload.is_active
    # Replaced wholesale rather than diffed: a set is edited as a whole in the
    # UI, and matching lines up by index would silently rewrite the wrong drug
    # the moment somebody reorders them.
    _replace_items(db, group, payload.items)
    db.commit()
    db.refresh(group)
    return _serialise(group)


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = _owned(db, group_id, current_user)
    db.delete(group)
    db.commit()
    return {"message": "Set removed"}


def _owned(db: Session, group_id: int, current_user: User) -> MedicationGroup:
    group = db.query(MedicationGroup).filter(
        MedicationGroup.id == group_id,
        MedicationGroup.clinic_id == current_user.clinic_id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Set not found")
    return group


def _replace_items(db: Session, group: MedicationGroup, items: List[GroupItemIn]):
    db.query(MedicationGroupItem).filter(
        MedicationGroupItem.group_id == group.id
    ).delete(synchronize_session=False)
    for i, item in enumerate(items):
        name = (item.medicine_name or "").strip()
        if not name:
            continue
        db.add(MedicationGroupItem(
            group_id=group.id,
            medication_stock_id=item.medication_stock_id,
            medicine_name=name,
            dosage=(item.dosage or "").strip() or None,
            duration=(item.duration or "").strip() or None,
            quantity=(item.quantity or "").strip() or None,
            notes=(item.notes or "").strip() or None,
            sort_order=i,
        ))


# ── Starter sets ─────────────────────────────────────────────────────────────
#
# The list lives in domains/inventory/starter_medication_sets.py and is seeded
# into each clinic on first use. What remains here is the empty-state button:
# a clinic that deleted every set can bring the defaults back on purpose.


@router.get("/starter-sets")
def starter_sets(current_user: User = Depends(get_current_user)):
    """The sets on offer, for the empty state to install."""
    return {
        "note": "Common adult doses, offered as a starting point. Read and adjust "
                "them to your own practice before using.",
        "sets": STARTER_SETS,
    }


@router.post("/install-starters")
def install_starters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add any starter set this clinic does not already have.

    Matched on name so pressing it twice does not produce five duplicates, and
    a clinic that has renamed or edited one keeps their version.
    """
    created = add_missing_sets(db, current_user.clinic_id, created_by=current_user.id)
    db.commit()
    return {"created": created, "skipped": len(STARTER_SETS) - len(created)}
