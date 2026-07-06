"""
Clean up phantom appointments that were auto-created from treatment-plan items.

Background
----------
Until this was fixed, saving a patient / case paper silently created an
"accepted" calendar appointment for every planned procedure (see
PatientProfile.savePatientData + TreatmentPlanService._create_appointment_from_plan).
This script removes those phantom rows *conservatively*.

A row is considered a phantom (and eligible for deletion) ONLY when ALL hold:
  1. Its id is referenced by some Patient.treatment_plan[*].appointment_id.
     (The auto-creation path is the ONLY thing that writes that back-link, so
     this alone strongly identifies a plan-generated appointment.)
  2. Its status is still 'accepted' — i.e. nobody ever progressed it
     (checking / completed / rejected / cancelled are all left ALONE).
  3. Nothing is attached to it: no Invoice, CasePaper, Prescription or XrayImage
     references the appointment. If anything is attached, it is KEPT and reported.

When applied, each deleted appointment's id is also cleared from the
treatment_plan item(s) that pointed at it, so plans don't dangle.

Usage
-----
  # Safe: report only, change nothing (DEFAULT)
  python scripts/cleanup_phantom_appointments.py

  # Restrict to one clinic while reviewing
  python scripts/cleanup_phantom_appointments.py --clinic-id 12

  # Actually delete (after reviewing the dry-run output)
  python scripts/cleanup_phantom_appointments.py --apply

DATABASE_URL / local DB config is taken from the app's database.py, so run it
with the environment pointed at whichever DB you intend to clean.
"""
import argparse
import sys

# Make the backend package importable when run as `python scripts/...`
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal  # noqa: E402
from models import (  # noqa: E402
    Patient,
    Appointment,
    Invoice,
    CasePaper,
    Prescription,
    XrayImage,
)

PRISTINE_STATUS = "accepted"  # the status the auto-creator stamps and nothing else touches


def _iter_plan_appointment_links(patient):
    """Yield (index, appointment_id) for treatment_plan items that carry one."""
    plan = patient.treatment_plan
    if not isinstance(plan, list):
        return
    for idx, item in enumerate(plan):
        if not isinstance(item, dict):
            continue
        appt_id = item.get("appointment_id")
        if isinstance(appt_id, int):
            yield idx, appt_id


def _has_attached_records(db, appt_id):
    """Return a list of human-readable reasons the appointment must be kept."""
    reasons = []
    if db.query(Invoice.id).filter(Invoice.appointment_id == appt_id).first():
        reasons.append("invoice")
    if db.query(CasePaper.id).filter(CasePaper.appointment_id == appt_id).first():
        reasons.append("case_paper")
    if db.query(Prescription.id).filter(Prescription.appointment_id == appt_id).first():
        reasons.append("prescription")
    if db.query(XrayImage.id).filter(XrayImage.appointment_id == appt_id).first():
        reasons.append("xray")
    return reasons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="Actually delete. Without this flag the script only reports (dry run).")
    parser.add_argument("--clinic-id", type=int, default=None,
                        help="Limit to a single clinic while reviewing.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        # 1. Build appt_id -> [(patient, plan_index), ...] from treatment_plan back-links.
        q = db.query(Patient).filter(Patient.treatment_plan.isnot(None))
        if args.clinic_id is not None:
            q = q.filter(Patient.clinic_id == args.clinic_id)

        links = {}  # appt_id -> list of (patient, idx)
        for patient in q.all():
            for idx, appt_id in _iter_plan_appointment_links(patient):
                links.setdefault(appt_id, []).append((patient, idx))

        if not links:
            print("No treatment-plan items reference any appointment. Nothing to do.")
            return

        candidate_ids = list(links.keys())

        # 2. Load the referenced appointments that are still pristine ('accepted').
        appts = db.query(Appointment).filter(
            Appointment.id.in_(candidate_ids),
            Appointment.status == PRISTINE_STATUS,
        ).all()
        appts_by_id = {a.id: a for a in appts}

        # Referenced ids that are NOT pristine (were acted on) — reported, never touched.
        acted_on = [aid for aid in candidate_ids
                    if aid not in appts_by_id
                    and db.query(Appointment.id).filter(Appointment.id == aid).first()]

        to_delete = []   # (appointment, [(patient, idx), ...])
        kept_refs = []   # (appointment, reasons)
        for aid, appt in appts_by_id.items():
            reasons = _has_attached_records(db, aid)
            if reasons:
                kept_refs.append((appt, reasons))
            else:
                to_delete.append((appt, links[aid]))

        # 3. Report.
        print("=" * 72)
        print(f"Phantom appointment cleanup — {'APPLY' if args.apply else 'DRY RUN'}"
              + (f" (clinic {args.clinic_id})" if args.clinic_id is not None else ""))
        print("=" * 72)
        print(f"Treatment-plan items linking to appointments : {len(candidate_ids)}")
        print(f"Pristine 'accepted' & unattached (DELETE)     : {len(to_delete)}")
        print(f"Linked but has records — KEPT                 : {len(kept_refs)}")
        print(f"Already acted on (not 'accepted') — KEPT      : {len(acted_on)}")
        print("-" * 72)

        for appt, refs in kept_refs:
            print(f"  KEEP  appt#{appt.id:<7} {appt.appointment_date}  {appt.patient_name}"
                  f"  — has {', '.join(refs)}")
        for appt, _links in to_delete:
            print(f"  DEL   appt#{appt.id:<7} {appt.appointment_date}  {appt.patient_name}"
                  f"  [{appt.status}]  {(appt.notes or '')[:40]}")

        if not to_delete:
            print("\nNothing eligible for deletion.")
            return

        if not args.apply:
            print(f"\nDRY RUN — no changes made. Re-run with --apply to delete {len(to_delete)} row(s).")
            return

        # 4. Apply inside one transaction.
        patients_touched = {}
        for appt, plan_links in to_delete:
            for patient, idx in plan_links:
                # Clear the dangling back-link in the treatment_plan JSON.
                plan = list(patient.treatment_plan or [])
                if 0 <= idx < len(plan) and isinstance(plan[idx], dict):
                    plan[idx] = {**plan[idx], "appointment_id": None}
                patient.treatment_plan = plan
                patients_touched[patient.id] = patient
            db.delete(appt)

        db.commit()
        print(f"\n✅ Deleted {len(to_delete)} phantom appointment(s); "
              f"cleared links on {len(patients_touched)} patient plan(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
