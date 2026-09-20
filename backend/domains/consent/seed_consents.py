"""Put the default consent forms into a clinic, once.

Mirrors seed_medications.seed_clinic_medications deliberately, including the
one-shot flag: the forms are copied in as ordinary clinic rows, so they can be
edited and deleted like anything else, and deleting one must not bring it back
on the next page load.

Copied, never referenced. The clinic owns the wording from the moment it lands,
editing it changes nobody else's, and a later change to starter_templates.py
must never silently alter a form a clinic has already read and put its name to.
"""
from sqlalchemy.orm import Session

from models import Clinic, ConsentTemplate
from domains.consent.starter_templates import STARTER_TEMPLATES


def seed_clinic_consents(db: Session, clinic_id: int) -> int:
    """Copy the default consent forms into a clinic. Idempotent, and once."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic or getattr(clinic, "consent_defaults_seeded", False):
        return 0

    existing = {
        (n or "").strip().lower()
        for (n,) in db.query(ConsentTemplate.name).filter(
            ConsentTemplate.clinic_id == clinic_id
        ).all()
    }

    inserted = 0
    for t in STARTER_TEMPLATES:
        if t["name"].strip().lower() in existing:
            continue
        db.add(ConsentTemplate(
            clinic_id=clinic_id,
            name=t["name"],
            content=t["content"],
            category=t["category"],
            is_active=True,
        ))
        inserted += 1

    # Set even when nothing was inserted. A clinic that already wrote its own
    # forms under these names has made its choice, and the point of the flag is
    # that this runs exactly once either way.
    clinic.consent_defaults_seeded = True
    db.commit()
    return inserted
