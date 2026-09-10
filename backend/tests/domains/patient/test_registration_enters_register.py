"""Registering a patient puts them in the day book.

The daily register was fed by check-in, by a case paper and by an invoice —
every path except the one the front desk actually uses first. So a receptionist
registered a patient, opened Today's Patients, and did not find the person they
had just typed in. Nothing errored; the register simply had no idea the
registration had happened.
"""
import datetime

import pytest

from models import DailyVisit


def _register(client, headers, **over):
    body = {"name": "Walk In", "phone": "9812345678", "age": 31, "gender": "Male"}
    body.update(over)
    return client.post("/api/v1/patients", json=body, headers=headers)


def test_registering_a_patient_adds_them_to_todays_register(
    client, auth_headers, db_session, test_clinic
):
    r = _register(client, auth_headers)
    assert r.status_code == 201, r.text
    patient_id = r.json()["id"]

    visit = db_session.query(DailyVisit).filter(
        DailyVisit.patient_id == patient_id,
        DailyVisit.clinic_id == test_clinic.id,
    ).one_or_none()
    assert visit is not None, "the patient never reached the day register"
    assert visit.source == "registration"


def test_a_brand_new_patient_counts_as_new_not_repeat(
    client, auth_headers, db_session, test_clinic
):
    """is_repeat is stored at registration, and drives the new/repeat split the
    front desk reads off the top of the register."""
    r = _register(client, auth_headers)
    patient_id = r.json()["id"]

    visit = db_session.query(DailyVisit).filter(
        DailyVisit.patient_id == patient_id
    ).one()
    assert visit.is_repeat is False


def test_the_register_shows_them_the_same_day(client, auth_headers):
    """The whole complaint, end to end: register somebody, open Today's
    Patients, and they are in it."""
    r = _register(client, auth_headers, name="Seen Today")
    assert r.status_code == 201, r.text

    reg = client.get("/api/v1/daily-register", headers=auth_headers)
    assert reg.status_code == 200, reg.text
    body = reg.json()
    names = [e["patient_name"] for e in body["entries"]]
    assert "Seen Today" in names
    assert body["kpis"]["total"] >= 1
    assert body["kpis"]["new"] >= 1


def test_a_back_dated_registration_lands_on_its_own_day(
    client, auth_headers, db_session
):
    """Catching up yesterday's paperwork this morning must not put the patient
    in today's count — the register is a record of who was actually in."""
    yesterday = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()
    r = _register(client, auth_headers, name="Came Earlier", registered_on=yesterday)
    assert r.status_code == 201, r.text

    visit = db_session.query(DailyVisit).filter(
        DailyVisit.patient_id == r.json()["id"]
    ).one()
    assert visit.visit_date.isoformat() == yesterday


def test_the_patients_own_file_shows_the_visit(client, auth_headers):
    """The other half of the same gap: with no case paper the file used to say
    the patient had never been in."""
    r = _register(client, auth_headers, name="Has A File")
    patient_id = r.json()["id"]

    hist = client.get(f"/api/v1/daily-register/patient/{patient_id}", headers=auth_headers)
    assert hist.status_code == 200, hist.text
    rows = hist.json()
    assert len(rows) == 1
    assert rows[0]["source"] == "registration"


def test_a_failed_register_entry_never_costs_the_patient(
    client, auth_headers, monkeypatch
):
    """The day book is a convenience on top of the patient record. If it breaks,
    the clinic still keeps the patient."""
    import domains.patient.routes.daily_register as reg

    def boom(*a, **k):
        raise RuntimeError("register unavailable")

    monkeypatch.setattr(reg, "record_daily_visit", boom)
    r = _register(client, auth_headers, name="Still Saved", phone="9800000001")
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Still Saved"
