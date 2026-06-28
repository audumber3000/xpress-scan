"""Seed a catalogue of common dental medications as *system* medications.

System medications have `clinic_id = NULL` and are visible to every clinic via
`GET /medications` (which returns clinic-specific + system rows). They power the
prescription typeahead so a doctor can pick a drug with sensible default
dosage/duration/quantity instead of typing everything from scratch.

Idempotent: only inserts names that don't already exist as a system medication,
so it is safe to run on every startup.
"""
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Medication

# (name, dosage [M-A-N], duration, quantity, category, notes)
COMMON_DENTAL_MEDICATIONS = [
    # ── Antibiotics ──────────────────────────────────────────────────────────
    ("Amoxicillin 500mg", "1-1-1", "5 days", "15", "Antibiotic", "After food"),
    ("Amoxicillin + Clavulanate 625mg", "1-0-1", "5 days", "10", "Antibiotic", "After food"),
    ("Metronidazole 400mg", "1-1-1", "5 days", "15", "Antibiotic", "After food"),
    ("Azithromycin 500mg", "1-0-0", "3 days", "3", "Antibiotic", "Before food"),
    ("Cefixime 200mg", "1-0-1", "5 days", "10", "Antibiotic", "After food"),
    ("Doxycycline 100mg", "1-0-1", "5 days", "10", "Antibiotic", "After food"),
    ("Clindamycin 300mg", "1-1-1", "5 days", "15", "Antibiotic", "For penicillin allergy"),
    # ── Analgesics / Anti-inflammatory ───────────────────────────────────────
    ("Ibuprofen 400mg", "1-0-1", "3 days", "6", "Analgesic", "After food"),
    ("Paracetamol 650mg", "1-1-1", "3 days", "9", "Analgesic", "After food"),
    ("Aceclofenac + Paracetamol", "1-0-1", "3 days", "6", "Analgesic", "After food"),
    ("Diclofenac 50mg", "1-0-1", "3 days", "6", "Analgesic", "After food"),
    ("Ketorolac 10mg", "1-0-1", "2 days", "4", "Analgesic", "Short-term, after food"),
    ("Mefenamic Acid 500mg", "1-0-1", "3 days", "6", "Analgesic", "After food"),
    # ── Gastric protection (cover for NSAIDs) ────────────────────────────────
    ("Pantoprazole 40mg", "1-0-0", "5 days", "5", "Gastric", "Before breakfast"),
    ("Rabeprazole 20mg", "1-0-0", "5 days", "5", "Gastric", "Before breakfast"),
    # ── Topical / Mouthwash ──────────────────────────────────────────────────
    ("Chlorhexidine 0.2% Mouthwash", "0-0-1", "7 days", "1", "Mouthwash", "Rinse, do not swallow"),
    ("Betadine Gargle", "1-1-1", "5 days", "1", "Mouthwash", "Gargle after food"),
    ("Mucopain / Lignocaine Gel", "SOS", "Ongoing", "1", "Topical", "Apply to affected area"),
    # ── Supplements ──────────────────────────────────────────────────────────
    ("Vitamin C 500mg", "1-0-0", "10 days", "10", "Supplement", "After food"),
    ("Becosules (B-Complex)", "1-0-0", "10 days", "10", "Supplement", "After food"),
    ("Calcium + Vitamin D3", "1-0-0", "1 month", "30", "Supplement", "After food"),
]


def seed_system_medications(db: Session | None = None) -> int:
    """Insert any missing system medications. Returns the number inserted."""
    own_session = db is None
    db = db or SessionLocal()
    inserted = 0
    try:
        existing = {
            name for (name,) in db.query(Medication.name).filter(
                Medication.clinic_id.is_(None)
            ).all()
        }
        for name, dosage, duration, quantity, category, notes in COMMON_DENTAL_MEDICATIONS:
            if name in existing:
                continue
            db.add(Medication(
                clinic_id=None,
                name=name,
                dosage=dosage,
                duration=duration,
                quantity=quantity,
                category=category,
                notes=notes,
                is_active=True,
            ))
            inserted += 1
        if inserted:
            db.commit()
        return inserted
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    n = seed_system_medications()
    print(f"Seeded {n} system medications.")
