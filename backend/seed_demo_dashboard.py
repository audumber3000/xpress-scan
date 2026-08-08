"""TEMPORARY marketing demo seeder — populates a clinic with realistic-looking
data so the dashboard/calendar/payments screens look full for screenshots.

LOCAL ONLY. Every row it creates is tagged so it can be removed cleanly:
  - patients get notes containing the MARKER
  - all appointments / invoices / payments hang off those tagged patients

Usage (run from backend/ with the app venv so it uses the local .env DB):
    ./venv/bin/python seed_demo_dashboard.py          # seed
    ./venv/bin/python seed_demo_dashboard.py clean     # remove everything it added

Target clinic via env (defaults to 2 = Sharma Dental):
    DEMO_CLINIC_ID=2 ./venv/bin/python seed_demo_dashboard.py
"""
import os
import sys
import random
import datetime

from database import SessionLocal
from models import Patient, Appointment, Invoice, InvoiceLineItem, Payment

CLINIC_ID = int(os.environ.get("DEMO_CLINIC_ID", "2"))
MARKER = "MKTDEMO"  # appears in every demo patient's notes — the cleanup key

FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
         "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Riya", "Myra", "Aarohi",
         "Rohan", "Kabir", "Dev", "Om", "Yash", "Neha", "Pooja", "Sneha", "Priya", "Kavya",
         "Rahul", "Amit", "Suresh", "Manish", "Deepak", "Sunita", "Meena", "Asha", "Geeta", "Lata"]
LAST = ["Sharma", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Gupta", "Mehta", "Shah", "Verma", "Nair",
        "Reddy", "Iyer", "Pawar", "Jadhav", "More", "Shinde", "Kale", "Gaikwad", "Bhosale", "Chavan"]
CITIES = ["Pune", "Mumbai", "Nashik", "Aurangabad", "Kolhapur", "Nagpur", "Beed", "Solapur", "Satara", "Latur"]
TREATMENTS = ["Root Canal", "Teeth Cleaning", "Tooth Extraction", "Dental Filling", "Crown & Bridge",
              "Dental Implant", "Braces / Aligners", "Teeth Whitening", "Consultation", "Wisdom Tooth"]
PAY_METHODS = ["Cash", "UPI", "Card", "Net Banking"]
GENDERS = ["male", "female"]
APPT_STATUSES = (["completed"] * 55 + ["confirmed"] * 18 + ["checking"] * 12 +
                 ["accepted"] * 8 + ["cancelled"] * 7)


def _phone():
    return f"{random.choice('6789')}{''.join(random.choice('0123456789') for _ in range(9))}"


def seed():
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    try:
        base_id = 900000 + random.randint(0, 5000)
        patients = []
        # ~150 patients, weighted toward recent months for a growth trend.
        for i in range(150):
            # skew: square of a uniform → more recent
            days_ago = int((random.random() ** 2) * 178)
            created = now - datetime.timedelta(days=days_ago,
                                               hours=random.randint(0, 10), minutes=random.randint(0, 59))
            name = f"{random.choice(FIRST)} {random.choice(LAST)}"
            p = Patient(
                clinic_id=CLINIC_ID,
                name=name,
                age=random.randint(6, 72),
                gender=random.choice(GENDERS),
                phone=_phone(),
                village=random.choice(CITIES),
                treatment_type=random.choice(TREATMENTS),
                payment_type=random.choice(["Cash", "UPI", "Card"]),
                display_id=str(base_id + i),
                notes=f"{MARKER} demo patient",
                created_at=created,
                updated_at=created,
            )
            db.add(p)
            patients.append(p)
        db.flush()  # assign patient ids

        appts = invoices = payments = 0
        inv_counter = base_id

        for p in patients:
            # 1–4 historical appointments per patient, on/after their creation
            for _ in range(random.randint(1, 4)):
                span = max(1, (now - p.created_at).days)
                appt_dt = p.created_at + datetime.timedelta(days=random.randint(0, span),
                                                            hours=random.randint(0, 8))
                if appt_dt > now:
                    appt_dt = now - datetime.timedelta(days=1)
                hour = random.randint(9, 18)
                status = random.choice(APPT_STATUSES)
                db.add(Appointment(
                    clinic_id=CLINIC_ID, patient_id=p.id, patient_name=p.name, patient_phone=p.phone,
                    treatment=p.treatment_type, appointment_date=appt_dt,
                    start_time=f"{hour:02d}:00", end_time=f"{hour+1:02d}:00", duration=60,
                    status=status, patient_age=p.age, patient_gender=p.gender, patient_village=p.village,
                    created_at=appt_dt, updated_at=appt_dt,
                ))
                appts += 1

                # most completed visits produce a paid invoice + payment (= revenue)
                if status == "completed" and random.random() < 0.8:
                    total = float(random.choice([500, 800, 1200, 1500, 2500, 3500, 5000, 8000, 12000, 18000]))
                    inv_counter += 1
                    inv = Invoice(
                        clinic_id=CLINIC_ID, patient_id=p.id, invoice_number=f"INV-{MARKER}-{inv_counter}",
                        status="paid_verified", payment_mode=random.choice(PAY_METHODS),
                        subtotal=total, total=total, paid_amount=total, due_amount=0.0,
                        notes=f"{MARKER}", created_at=appt_dt, updated_at=appt_dt,
                        finalized_at=appt_dt, paid_at=appt_dt,
                    )
                    db.add(inv)
                    db.flush()
                    db.add(InvoiceLineItem(invoice_id=inv.id, description=p.treatment_type,
                                           quantity=1.0, unit_price=total, amount=total, created_at=appt_dt))
                    db.add(Payment(
                        clinic_id=CLINIC_ID, patient_id=p.id, amount=total, payment_method=random.choice(PAY_METHODS),
                        status="success", notes=f"{MARKER}", created_at=appt_dt, updated_at=appt_dt,
                    ))
                    invoices += 1
                    payments += 1

        # A busy upcoming schedule (next 14 days) for the calendar screenshot.
        upcoming_patients = random.sample(patients, 30)
        for p in upcoming_patients:
            appt_dt = now + datetime.timedelta(days=random.randint(0, 14), hours=random.randint(0, 8))
            hour = random.randint(9, 18)
            db.add(Appointment(
                clinic_id=CLINIC_ID, patient_id=p.id, patient_name=p.name, patient_phone=p.phone,
                treatment=p.treatment_type, appointment_date=appt_dt,
                start_time=f"{hour:02d}:00", end_time=f"{hour+1:02d}:00", duration=60,
                status=random.choice(["confirmed", "checking", "accepted"]),
                patient_age=p.age, patient_gender=p.gender, patient_village=p.village,
                created_at=now, updated_at=now,
            ))
            appts += 1

        db.commit()
        print(f"✅ Seeded into clinic {CLINIC_ID}: {len(patients)} patients, {appts} appointments, "
              f"{invoices} paid invoices, {payments} payments.")
        print(f"   Marker: '{MARKER}'. Remove later with:  ./venv/bin/python seed_demo_dashboard.py clean")
    finally:
        db.close()


def clean():
    db = SessionLocal()
    try:
        pids = [pid for (pid,) in db.query(Patient.id).filter(
            Patient.clinic_id == CLINIC_ID, Patient.notes.like(f"%{MARKER}%")).all()]
        if not pids:
            print(f"Nothing to clean for clinic {CLINIC_ID} (no patients tagged '{MARKER}').")
            return
        inv_ids = [iid for (iid,) in db.query(Invoice.id).filter(Invoice.patient_id.in_(pids)).all()]
        if inv_ids:
            db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
        n_inv = db.query(Invoice).filter(Invoice.patient_id.in_(pids)).delete(synchronize_session=False)
        n_pay = db.query(Payment).filter(Payment.patient_id.in_(pids)).delete(synchronize_session=False)
        n_appt = db.query(Appointment).filter(Appointment.patient_id.in_(pids)).delete(synchronize_session=False)
        n_pat = db.query(Patient).filter(Patient.id.in_(pids)).delete(synchronize_session=False)
        db.commit()
        print(f"🧹 Removed demo data from clinic {CLINIC_ID}: "
              f"{n_pat} patients, {n_appt} appointments, {n_inv} invoices, {n_pay} payments.")
    finally:
        db.close()


if __name__ == "__main__":
    (clean if len(sys.argv) > 1 and sys.argv[1] == "clean" else seed)()
