"""Put the default prescription sets into a clinic, once.

The same shape as seed_medications and seed_consents, including the one-shot
flag: the sets become ordinary clinic rows, and deleting one must not bring it
back on the next page load.
"""
from sqlalchemy.orm import Session

from models import Clinic, MedicationGroup, MedicationGroupItem
from domains.inventory.starter_medication_sets import STARTER_SETS


def _add_set(db: Session, clinic_id: int, spec: dict, created_by=None) -> None:
    group = MedicationGroup(
        clinic_id=clinic_id,
        name=spec["name"],
        description=spec.get("description"),
        audience=spec.get("audience") or "adult",
        created_by=created_by,
        is_active=True,
    )
    db.add(group)
    db.flush()  # the items need the group's id
    for i, item in enumerate(spec["items"]):
        name = (item.get("medicine_name") or "").strip()
        if not name:
            continue
        db.add(MedicationGroupItem(
            group_id=group.id,
            medicine_name=name,
            dosage=(item.get("dosage") or "").strip() or None,
            duration=(item.get("duration") or "").strip() or None,
            quantity=(item.get("quantity") or "").strip() or None,
            notes=(item.get("notes") or "").strip() or None,
            sort_order=i,
        ))


def add_missing_sets(db: Session, clinic_id: int, created_by=None) -> list:
    """Add any default set this clinic does not have, matched by name. Returns
    the names added. Shared by first-use seeding and the "Add the common sets"
    button, so the two can never disagree about what the defaults are."""
    existing = {
        (n or "").strip().lower()
        for (n,) in db.query(MedicationGroup.name).filter(
            MedicationGroup.clinic_id == clinic_id
        ).all()
    }
    added = []
    for spec in STARTER_SETS:
        if spec["name"].strip().lower() in existing:
            continue
        _add_set(db, clinic_id, spec, created_by)
        added.append(spec["name"])
    return added


def seed_clinic_medication_groups(db: Session, clinic_id: int) -> int:
    """Seed the defaults into a clinic on first use. Idempotent, and once."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic or getattr(clinic, "medication_groups_seeded", False):
        return 0
    added = add_missing_sets(db, clinic_id)
    # Set even when nothing was added: a clinic that already built its own sets
    # under these names has made its choice, and this runs once regardless.
    clinic.medication_groups_seeded = True
    db.commit()
    return len(added)
