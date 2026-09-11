"""TEMPORARY marketing demo seeder for the Dental Labs app — fills the lab
dashboard / case board / billing with realistic data for screenshots.

LOCAL ONLY (points at the local dental_labs DB). Every row is tagged so it can
be removed cleanly: demo CLIENTS carry the MARKER in notes, and every case /
invoice / payment hangs off those tagged clients.

Run from dental-labs/backend/ with the app venv:
    ./venv/bin/python seed_demo_dashboard.py          # seed
    ./venv/bin/python seed_demo_dashboard.py clean     # remove everything it added

Target lab via env (defaults to 1):
    DEMO_LAB_ID=1 ./venv/bin/python seed_demo_dashboard.py
"""
import os
import sys
import random
import datetime

from database import SessionLocal
from models.case import Case, CaseItem, CaseStatusHistory
from models.client import Client
from models.billing import Invoice, InvoiceLineItem, Payment

LAB_ID = int(os.environ.get("DEMO_LAB_ID", "1"))
MARKER = "MKTDEMO"

DENTISTS = ["Dr. Sharma", "Dr. Patil", "Dr. Mehta", "Dr. Joshi", "Dr. Reddy", "Dr. Nair", "Dr. Gupta",
            "Dr. Iyer", "Dr. Deshmukh", "Dr. Shah", "Dr. Kulkarni", "Dr. Verma", "Dr. Rao", "Dr. Bose",
            "Dr. Khanna", "Dr. Menon", "Dr. Sinha", "Dr. Pillai"]
CLINICS = ["Smile Care Dental", "Perfect 32 Clinic", "Dental Studio", "City Dental Care", "Bright Smiles",
           "Apollo Dental", "Pearl Dental", "Sunrise Dental", "Oral Health Centre", "Dentmax Clinic",
           "Aastha Dental", "Crown Dental Care", "Gentle Dental", "Royal Dental", "MediTooth",
           "Care32 Dental", "Lifeline Dental", "Elite Dental Studio"]
CITIES = ["Pune", "Mumbai", "Nashik", "Nagpur", "Kolhapur", "Aurangabad", "Bangalore", "Hyderabad"]
PRODUCTS = [
    ("Zirconia Crown", "zirconia", (2500, 4500)),
    ("PFM Crown", "PFM", (1200, 2500)),
    ("E-max Veneer", "e.max", (3500, 6000)),
    ("Full Denture", "acrylic", (6000, 12000)),
    ("Cast Partial Denture", "cobalt-chrome", (4000, 9000)),
    ("Implant Crown", "titanium/zirconia", (5000, 9000)),
    ("3-Unit Bridge", "PFM", (4500, 9000)),
    ("Inlay / Onlay", "ceramic", (2000, 4000)),
    ("Night Guard", "acrylic", (1500, 3000)),
    ("Temporary Crown", "PMMA", (500, 1200)),
]
SHADES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "C1"]
PAY_METHODS = ["cash", "upi", "bank_transfer", "cheque"]


def _phone():
    return f"{random.choice('6789')}{''.join(random.choice('0123456789') for _ in range(9))}"


def _make_case(db, client_id, status, received_date, due_date, delivered_at, seq):
    items = []
    n = random.randint(1, 2)
    total = 0.0
    for _ in range(n):
        pname, material, (lo, hi) = random.choice(PRODUCTS)
        qty = random.randint(1, 3)
        unit = float(random.randint(lo, hi))
        line = qty * unit
        total += line
        items.append((pname, material, qty, unit, line))
    case = Case(
        lab_id=LAB_ID, client_id=client_id, case_number=f"DL-DEMO-{seq:04d}",
        doctor_name=random.choice(DENTISTS), patient_name=f"Patient {random.randint(100, 999)}",
        patient_age=random.randint(15, 75), patient_sex=random.choice(["male", "female"]),
        received_date=received_date, due_date=due_date, delivered_at=delivered_at,
        priority=random.choice(["normal", "normal", "normal", "rush"]),
        status=status, total_amount=total, notes=MARKER, created_by=2,
    )
    db.add(case)
    db.flush()
    for pname, material, qty, unit, line in items:
        db.add(CaseItem(case_id=case.id, product_name=pname, material=material,
                        tooth_numbers=[random.randint(11, 48) for _ in range(qty)],
                        shade=random.choice(SHADES), qty=qty, unit_price=unit, line_total=line))
    return case


def seed():
    db = SessionLocal()
    today = datetime.date.today()
    now = datetime.datetime.utcnow()
    month_start = today.replace(day=1)
    try:
        # ── Clients ──
        clients = []
        for i in range(18):
            c = Client(lab_id=LAB_ID, name=DENTISTS[i], clinic_name=CLINICS[i], phone=_phone(),
                       email=f"clinic{i+1}@example.com", address=random.choice(CITIES),
                       default_price_tier=random.choice(["standard", "premium"]),
                       is_active=True, notes=f"{MARKER} demo client")
            db.add(c)
            clients.append(c)
        db.flush()
        cids = [c.id for c in clients]

        seq = 1000 + random.randint(0, 500)
        n_cases = 0

        def rid(c):  # random client id
            return random.choice(cids)

        # A. Delivered — ~half forced into the CURRENT month for strong revenue
        for _ in range(48):
            d_day = random.randint(1, max(1, today.day))
            delivered = month_start.replace(day=d_day)
            turn = random.randint(3, 9)
            recv = delivered - datetime.timedelta(days=turn)
            seq += 1
            _make_case(db, rid(0), "delivered", recv, delivered,
                       datetime.datetime.combine(delivered, datetime.time(random.randint(10, 18))), seq)
            n_cases += 1
        # ...and ~45 delivered spread over the previous ~5 months (revenue history)
        for _ in range(45):
            days_ago = random.randint(31, 170)
            delivered = today - datetime.timedelta(days=days_ago)
            turn = random.randint(3, 9)
            recv = delivered - datetime.timedelta(days=turn)
            seq += 1
            _make_case(db, rid(0), "delivered", recv, delivered,
                       datetime.datetime.combine(delivered, datetime.time(random.randint(10, 18))), seq)
            n_cases += 1

        # B. In production (active board)
        for _ in range(26):
            recv = today - datetime.timedelta(days=random.randint(1, 18))
            seq += 1
            _make_case(db, rid(0), "in_production", recv, recv + datetime.timedelta(days=random.randint(4, 10)), None, seq)
            n_cases += 1

        # C. Received today
        for _ in range(6):
            seq += 1
            _make_case(db, rid(0), "received", today, today + datetime.timedelta(days=random.randint(4, 8)), None, seq)
            n_cases += 1

        # D. Due today (still in production)
        for _ in range(5):
            seq += 1
            _make_case(db, rid(0), "in_production", today - datetime.timedelta(days=5), today, None, seq)
            n_cases += 1

        # E. Overdue (not delivered)
        for _ in range(9):
            due = today - datetime.timedelta(days=random.randint(1, 14))
            seq += 1
            _make_case(db, rid(0), random.choice(["in_production", "ready"]), due - datetime.timedelta(days=6), due, None, seq)
            n_cases += 1

        # F. Ready / dispatched
        for _ in range(12):
            recv = today - datetime.timedelta(days=random.randint(3, 12))
            seq += 1
            _make_case(db, rid(0), random.choice(["ready", "dispatched"]), recv, recv + datetime.timedelta(days=6), None, seq)
            n_cases += 1

        # G. On hold / cancelled (scatter)
        for _ in range(10):
            recv = today - datetime.timedelta(days=random.randint(5, 120))
            seq += 1
            _make_case(db, rid(0), random.choice(["on_hold", "cancelled"]), recv, recv + datetime.timedelta(days=7), None, seq)
            n_cases += 1

        # ── Invoices + payments (billing page) ──
        n_inv = n_pay = 0
        inv_seq = seq
        for ci in random.sample(cids, 14):
            inv_seq += 1
            sub = float(random.choice([8000, 12000, 18000, 25000, 32000, 45000]))
            tax = round(sub * 0.18, 2)
            total = sub + tax
            status = random.choice(["paid", "paid", "sent", "partially_paid"])
            paid = total if status == "paid" else (round(total * 0.5, 2) if status == "partially_paid" else 0.0)
            inv = Invoice(lab_id=LAB_ID, client_id=ci, invoice_number=f"INV-DEMO-{inv_seq}",
                          period_start=month_start - datetime.timedelta(days=30), period_end=month_start - datetime.timedelta(days=1),
                          subtotal=sub, tax_rate=18.0, tax_amount=tax, total=total,
                          paid_amount=paid, due_amount=total - paid, status=status, notes=MARKER)
            db.add(inv)
            db.flush()
            db.add(InvoiceLineItem(invoice_id=inv.id, description="Lab work — monthly statement",
                                   qty=1.0, unit_price=sub, amount=sub))
            n_inv += 1
            if paid > 0:
                db.add(Payment(lab_id=LAB_ID, client_id=ci, invoice_id=inv.id, amount=paid,
                               method=random.choice(PAY_METHODS), reference_number=f"REF{random.randint(10000, 99999)}",
                               paid_at=now - datetime.timedelta(days=random.randint(0, 20)), notes=MARKER))
                n_pay += 1

        db.commit()
        print(f"✅ Seeded into lab {LAB_ID}: {len(clients)} clients, {n_cases} cases, {n_inv} invoices, {n_pay} payments.")
        print(f"   Marker: '{MARKER}'. Remove later with:  ./venv/bin/python seed_demo_dashboard.py clean")
    finally:
        db.close()


def clean():
    db = SessionLocal()
    try:
        cids = [cid for (cid,) in db.query(Client.id).filter(
            Client.lab_id == LAB_ID, Client.notes.like(f"%{MARKER}%")).all()]
        if not cids:
            print(f"Nothing to clean for lab {LAB_ID} (no clients tagged '{MARKER}').")
            return
        case_ids = [x for (x,) in db.query(Case.id).filter(Case.client_id.in_(cids)).all()]
        inv_ids = [x for (x,) in db.query(Invoice.id).filter(Invoice.client_id.in_(cids)).all()]
        if case_ids:
            db.query(CaseItem).filter(CaseItem.case_id.in_(case_ids)).delete(synchronize_session=False)
            db.query(CaseStatusHistory).filter(CaseStatusHistory.case_id.in_(case_ids)).delete(synchronize_session=False)
        if inv_ids or case_ids:
            from sqlalchemy import or_
            db.query(InvoiceLineItem).filter(
                or_(InvoiceLineItem.invoice_id.in_(inv_ids or [-1]),
                    InvoiceLineItem.case_id.in_(case_ids or [-1]))).delete(synchronize_session=False)
        n_pay = db.query(Payment).filter(Payment.client_id.in_(cids)).delete(synchronize_session=False)
        n_case = db.query(Case).filter(Case.client_id.in_(cids)).delete(synchronize_session=False)
        n_inv = db.query(Invoice).filter(Invoice.client_id.in_(cids)).delete(synchronize_session=False)
        n_cli = db.query(Client).filter(Client.id.in_(cids)).delete(synchronize_session=False)
        db.commit()
        print(f"🧹 Removed demo data from lab {LAB_ID}: {n_cli} clients, {n_case} cases, {n_inv} invoices, {n_pay} payments.")
    finally:
        db.close()


if __name__ == "__main__":
    (clean if len(sys.argv) > 1 and sys.argv[1] == "clean" else seed)()
