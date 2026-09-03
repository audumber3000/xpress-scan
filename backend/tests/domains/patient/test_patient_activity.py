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

    # created_at explicitly, not left to the column default: the feed sorts on
    # it, and a default of "now" would put the file's own beginning at the top.
    p = Patient(clinic_id=cid, name="Rahul", phone="9876543210",
                registered_on=dt.date(2026, 8, 1), created_by=owner.id,
                created_at=dt.datetime(2026, 8, 1, 9, 30))
    db.add(p)
    db.commit()

    db.add(Appointment(
        clinic_id=cid, patient_id=p.id, patient_name="Rahul", doctor_id=doctor.id,
        created_by=owner.id,
        appointment_date=dt.datetime(2026, 8, 20, 10, 0), start_time="10:00",
        end_time="10:30", duration=30, status="completed", treatment="Root canal",
    ))
    db.add(DailyVisit(clinic_id=cid, patient_id=p.id, visit_date=dt.date(2026, 8, 20),
                      source="manual", reason="Tooth pain", doctor_id=doctor.id,
                      created_by=owner.id,
                      created_at=dt.datetime(2026, 8, 20, 9, 55)))
    paper = CasePaper(clinic_id=cid, patient_id=p.id, dentist_id=doctor.id,
                      date=dt.datetime(2026, 8, 20, 10, 15), status="Completed",
                      chief_complaint='["Pain in upper left molar"]')
    db.add(paper)
    db.commit()
    db.add(Prescription(clinic_id=cid, patient_id=p.id, case_paper_id=paper.id,
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
    assert cp["by_verb"] == "By"
    assert cp["detail"] == "Pain in upper left molar"   # unwrapped from its JSON


def test_the_registration_says_who_and_at_what_time(world):
    """A file has to begin somewhere, and "somewhere" is a person and a clock.

    created_at, not registered_on: the second is a bare clinic-local day staff
    can back-date, so on its own it can never carry an hour."""
    reg = next(e for e in _feed(world) if e["kind"] == "registered")
    assert reg["by"] == "Dr. Audi"
    assert reg["by_verb"] == "Registered by"
    assert reg["at"] == "2026-08-01T09:30:00"
    assert reg["detail"] is None        # registered_on agrees, nothing to explain


def test_a_back_dated_registration_opens_the_file_rather_than_topping_it(world):
    """Somebody first seen in 2019 and typed in last week has two true dates.

    The one that decides where the row sits is the day it is about. Using the
    typing timestamp would put "Patient registered" above that patient's own
    2019 case papers, which reads as the file having begun today. The other
    date is not thrown away, it is said out loud."""
    client, _, db, cid = world
    old = Patient(clinic_id=cid, name="Old", phone="7", created_by=None,
                  registered_on=dt.date(2019, 3, 4),
                  created_at=dt.datetime(2026, 8, 28, 16, 0))
    db.add(old)
    db.commit()
    db.add(CasePaper(clinic_id=cid, patient_id=old.id,
                     date=dt.datetime(2019, 6, 1, 10, 0), status="Completed"))
    db.commit()

    feed = client.get(f"/api/v1/patients/{old.id}/activity").json()
    reg = next(e for e in feed if e["kind"] == "registered")
    assert reg["at"] == "2019-03-04"           # no hour claimed, none is known
    assert reg["detail"] == "Registration date recorded as 04 Mar 2019"
    assert feed[-1] is reg or feed[-1]["kind"] == "registered"   # oldest, at the foot


def test_a_back_dated_register_entry_keeps_the_day_it_is_about(world):
    """Same rule for the daily register: a Monday visit entered on Wednesday is
    a Monday event. Otherwise it jumps the queue over that day's own bill."""
    client, pid, db, cid = world
    db.add(DailyVisit(clinic_id=cid, patient_id=pid, visit_date=dt.date(2026, 8, 19),
                      source="manual", reason="Entered late",
                      created_at=dt.datetime(2026, 8, 25, 11, 0)))
    db.commit()

    v = next(e for e in _feed(world)
             if e["kind"] == "walk_in" and e["at"].startswith("2026-08-19"))
    assert v["at"] == "2026-08-19"


def test_events_at_the_same_instant_fall_in_the_order_they_must_have_happened(world):
    """A busy front desk lands several of these in one second, and the clock
    cannot separate them. A bill is raised after the patient walked in and paid
    after it was raised, so that is the order shown."""
    client, pid, db, cid = world
    same = dt.datetime(2026, 8, 22, 15, 0)
    db.add(DailyVisit(clinic_id=cid, patient_id=pid, visit_date=dt.date(2026, 8, 22),
                      source="manual", created_at=same))
    inv = Invoice(clinic_id=cid, patient_id=pid, invoice_number="INV-2026-0043",
                  total=500.0, status="paid_verified", created_at=same)
    db.add(inv)
    db.commit()
    db.add(InvoicePayment(invoice_id=inv.id, clinic_id=cid, amount=500.0,
                          method="Cash", paid_on=dt.date(2026, 8, 22), created_at=same))
    db.commit()

    tied = [e["kind"] for e in _feed(world) if e["at"] == same.isoformat()]
    assert tied == ["payment", "invoice", "walk_in"]     # newest first


def test_the_appointment_says_who_booked_it_not_who_it_was_with(world):
    """Two different people, and the feed reads as "who did this". The doctor
    the patient is seeing is a fact about the visit, so it belongs in the
    detail line, not in the actor's place."""
    a = next(e for e in _feed(world) if e["kind"] == "appointment")
    assert a["by"] == "Dr. Audi"                    # the one who booked it
    assert a["by_verb"] == "Booked by"
    assert "with Dr. Ritika Shah" in a["detail"]    # the one it is with
    assert a["at"] == "2026-08-20T10:00:00"


def test_the_walk_in_carries_the_hour_it_was_entered(world):
    """The register stores a bare day. The row itself knows the hour, and that
    is the one worth showing on a timeline."""
    v = next(e for e in _feed(world) if e["kind"] == "walk_in")
    assert v["at"] == "2026-08-20T09:55:00"
    assert v["by"] == "Dr. Audi"
    assert v["by_verb"] == "Added by"
    assert "seen by Dr. Ritika Shah" in v["detail"]


def test_the_prescription_borrows_its_prescriber_from_its_case_paper(world):
    """A prescription records no author of its own. The dentist on the visit it
    was written during is the one who wrote it."""
    rx = next(e for e in _feed(world) if e["kind"] == "prescription")
    assert rx["by"] == "Dr. Ritika Shah"
    assert rx["detail"] == "Amoxicillin"


def test_the_staff_name_map_survives_the_prescription_loop(world):
    """Regression: the medicine list was once bound to the same name as the
    staff lookup, which emptied every name resolved after it."""
    feed = _feed(world)
    assert next(e for e in feed if e["kind"] == "invoice")["by"] == "Dr. Audi"
    assert all(e.get("by_verb") for e in feed)


def test_the_payment_carries_the_money_and_the_person_who_took_it(world):
    pay = next(e for e in _feed(world) if e["kind"] == "payment")
    assert pay["by_verb"] == "Recorded by"
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
