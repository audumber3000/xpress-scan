"""One feed of what has happened to a patient, merged from six tables.

The overview used to carry two cards here, "Latest visit" and "Recent visits",
which showed the same case papers twice, could say who nothing was by, and
between them mentioned neither the appointment that brought the patient in nor
the money that changed hands afterwards.

There is no per-patient audit trail to read back: AuditLog keeps only
consequential actions and ActivityLog is a ten-row FIFO for the dashboard. So
this is assembled from the source rows, each of which already records its own
actor, in the same way the invoice timeline is.
"""
import datetime as dt

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.auth_utils import require_patients_view
from database import get_db
from domains.patient.routes import patients_clean
from models import (
    Appointment, Base, CasePaper, Clinic, DailyVisit, Invoice, InvoicePayment,
    Patient, Prescription, User,
)


@pytest.fixture()
def world():
    """One patient with one of everything, all on the same day."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()

    db.add(Clinic(name="C", email="c@c.com", specialization="dental", phone="1"))
    db.commit()
    cid = db.query(Clinic).first().id

    doctor = User(clinic_id=cid, email="r@c.com", first_name="Ritika",
                  last_name="Shah", name="Dr. Ritika Shah", role="doctor")
    owner = User(clinic_id=cid, email="a@c.com", first_name="Audi",
                 last_name="C", name="Dr. Audi", role="clinic_owner")
    db.add_all([doctor, owner])
    db.commit()

    p = Patient(clinic_id=cid, name="Rahul", phone="9876543210",
                registered_on=dt.date(2026, 8, 1))
    db.add(p)
    db.commit()

    db.add(Appointment(
        clinic_id=cid, patient_id=p.id, patient_name="Rahul", doctor_id=doctor.id,
        appointment_date=dt.datetime(2026, 8, 20, 10, 0), start_time="10:00",
        end_time="10:30", duration=30, status="completed", treatment="Root canal",
    ))
    db.add(DailyVisit(clinic_id=cid, patient_id=p.id, visit_date=dt.date(2026, 8, 20),
                      source="manual", reason="Tooth pain", doctor_id=doctor.id))
    db.add(CasePaper(clinic_id=cid, patient_id=p.id, dentist_id=doctor.id,
                     date=dt.datetime(2026, 8, 20, 10, 15), status="Completed",
                     chief_complaint='["Pain in upper left molar"]'))
    db.add(Prescription(clinic_id=cid, patient_id=p.id,
                        created_at=dt.datetime(2026, 8, 20, 11, 0),
                        items=[{"medicine_name": "Amoxicillin"}]))
    inv = Invoice(clinic_id=cid, patient_id=p.id, invoice_number="INV-2026-0042",
                  total=1500.0, status="partially_paid", created_by=owner.id,
                  created_at=dt.datetime(2026, 8, 20, 12, 11))
    db.add(inv)
    db.commit()
    db.add(InvoicePayment(invoice_id=inv.id, clinic_id=cid, amount=120.0,
                          method="UPI", reference="UPI/4220", recorded_by=owner.id,
                          paid_on=dt.date(2026, 8, 20),
                          created_at=dt.datetime(2026, 8, 20, 17, 41)))
    db.commit()

    app = FastAPI()
    app.include_router(patients_clean.router, prefix="/api/v1/patients")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_patients_view] = lambda: owner
    return TestClient(app), p.id, db, cid


def _feed(world):
    client, pid, _, _ = world
    res = client.get(f"/api/v1/patients/{pid}/activity")
    assert res.status_code == 200
    return res.json()


def test_every_kind_of_event_reaches_the_feed(world):
    kinds = [e["kind"] for e in _feed(world)]
    assert set(kinds) == {
        "registered", "appointment", "walk_in", "case_paper",
        "prescription", "invoice", "payment",
    }


def test_newest_first(world):
    ats = [e["at"] for e in _feed(world)]
    assert ats == sorted(ats, reverse=True)
    assert _feed(world)[0]["kind"] == "payment"


def test_the_case_paper_says_who_wrote_it(world):
    """The whole point of the card: attribution the old ones could not give."""
    cp = next(e for e in _feed(world) if e["kind"] == "case_paper")
    assert cp["by"] == "Dr. Ritika Shah"
    assert cp["detail"] == "Pain in upper left molar"   # unwrapped from its JSON


def test_the_payment_carries_the_money_and_the_person_who_took_it(world):
    pay = next(e for e in _feed(world) if e["kind"] == "payment")
    assert pay["amount"] == 120.0
    assert pay["method"] == "UPI"
    assert pay["reference"] == "UPI/4220"
    assert pay["by"] == "Dr. Audi"


def test_a_walk_in_is_told_apart_from_a_check_in(world):
    """'Direct register' and 'arrived for their appointment' are different
    events and must not both read as the same word."""
    client, pid, db, cid = world
    db.add(DailyVisit(clinic_id=cid, patient_id=pid, visit_date=dt.date(2026, 8, 21),
                      source="check_in", reason="Follow up"))
    db.commit()

    kinds = {e["kind"] for e in _feed(world)}
    assert "walk_in" in kinds and "check_in" in kinds


def test_another_clinics_patient_is_not_reachable(world):
    client, _, db, _ = world
    db.add(Clinic(name="Other", email="o@c.com", specialization="dental", phone="2"))
    db.commit()
    other_clinic = db.query(Clinic).filter(Clinic.name == "Other").first()
    stranger = Patient(clinic_id=other_clinic.id, name="Someone", phone="1")
    db.add(stranger)
    db.commit()

    assert client.get(f"/api/v1/patients/{stranger.id}/activity").status_code == 404


def test_a_patient_with_nothing_recorded_still_has_a_beginning(world):
    client, _, db, cid = world
    fresh = Patient(clinic_id=cid, name="New", phone="5", registered_on=dt.date(2026, 9, 1))
    db.add(fresh)
    db.commit()

    feed = client.get(f"/api/v1/patients/{fresh.id}/activity").json()
    assert [e["kind"] for e in feed] == ["registered"]
