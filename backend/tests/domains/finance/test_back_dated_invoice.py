"""An invoice can be raised for a day that has already passed.

The invoice date is created_at, so what these tests defend is everything that
has to move with it: the day the bill prints and lists under, the day the
revenue counts on (finalized_at), and the day the patient sits in the register.
And what must NOT move: an old draft that nobody back-dated still issues today.
"""
import datetime

from core.clinic_time import clinic_today, clinic_day_of
from models import DailyVisit, Invoice


def _create(client, headers, patient_id, **extra):
    r = client.post("/api/v1/invoices", json={"patient_id": patient_id, **extra}, headers=headers)
    return r


def _add_line(client, headers, invoice_id):
    r = client.post(f"/api/v1/invoices/{invoice_id}/line-items",
                    json={"description": "Scaling", "quantity": 1, "unit_price": 500},
                    headers=headers)
    assert r.status_code == 200, r.text


def test_invoice_created_for_a_past_day(client, auth_headers, db_session, test_clinic, test_patient):
    past = clinic_today(test_clinic) - datetime.timedelta(days=5)
    r = _create(client, auth_headers, test_patient.id, invoice_date=past.isoformat())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["invoice_date"] == past.isoformat()
    assert body["back_dated"] is True

    inv = db_session.query(Invoice).get(body["id"])
    assert clinic_day_of(test_clinic, inv.created_at) == past

    # The patient was in on that day, not today.
    days = {v.visit_date for v in db_session.query(DailyVisit).filter(
        DailyVisit.patient_id == test_patient.id).all()}
    assert days == {past}

    # Issuing it books the revenue on its own day too.
    _add_line(client, auth_headers, inv.id)
    r = client.post(f"/api/v1/invoices/{inv.id}/finalize", headers=auth_headers)
    assert r.status_code == 200, r.text
    db_session.refresh(inv)
    assert clinic_day_of(test_clinic, inv.finalized_at) == past


def test_future_date_is_refused(client, auth_headers, test_clinic, test_patient):
    future = clinic_today(test_clinic) + datetime.timedelta(days=1)
    r = _create(client, auth_headers, test_patient.id, invoice_date=future.isoformat())
    assert r.status_code == 400


def test_draft_can_be_moved_and_register_follows(client, auth_headers, db_session, test_clinic, test_patient):
    today = clinic_today(test_clinic)
    r = _create(client, auth_headers, test_patient.id)
    assert r.status_code == 200, r.text
    inv_id = r.json()["id"]
    assert r.json()["back_dated"] is False

    past = today - datetime.timedelta(days=2)
    r = client.put(f"/api/v1/invoices/{inv_id}", json={"invoice_date": past.isoformat()}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["invoice_date"] == past.isoformat()
    assert r.json()["back_dated"] is True

    # Today's entry existed only because of this bill, so it moved with it.
    days = {v.visit_date for v in db_session.query(DailyVisit).filter(
        DailyVisit.patient_id == test_patient.id).all()}
    assert days == {past}

    # And back again.
    r = client.put(f"/api/v1/invoices/{inv_id}", json={"invoice_date": today.isoformat()}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["back_dated"] is False


def test_old_draft_nobody_back_dated_still_issues_today(client, auth_headers, db_session, test_clinic, test_patient):
    r = _create(client, auth_headers, test_patient.id)
    inv = db_session.query(Invoice).get(r.json()["id"])
    # A case-paper draft left open for a week.
    inv.created_at = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    db_session.commit()
    _add_line(client, auth_headers, inv.id)
    r = client.post(f"/api/v1/invoices/{inv.id}/finalize", headers=auth_headers)
    assert r.status_code == 200, r.text
    db_session.refresh(inv)
    assert clinic_day_of(test_clinic, inv.finalized_at) == clinic_today(test_clinic)


def test_issued_invoice_date_cannot_change(client, auth_headers, test_clinic, test_patient):
    r = _create(client, auth_headers, test_patient.id)
    inv_id = r.json()["id"]
    _add_line(client, auth_headers, inv_id)
    client.post(f"/api/v1/invoices/{inv_id}/finalize", headers=auth_headers)
    past = clinic_today(test_clinic) - datetime.timedelta(days=1)
    r = client.put(f"/api/v1/invoices/{inv_id}", json={"invoice_date": past.isoformat()}, headers=auth_headers)
    assert r.status_code == 400


def _paper(db, clinic, patient, when):
    from models import CasePaper
    cp = CasePaper(clinic_id=clinic.id, patient_id=patient.id, date=when)
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


def test_bill_from_a_case_paper_takes_its_date_and_time(client, auth_headers, db_session, test_clinic, test_patient):
    when = (datetime.datetime.utcnow() - datetime.timedelta(days=3)).replace(microsecond=0)
    cp = _paper(db_session, test_clinic, test_patient, when)
    r = _create(client, auth_headers, test_patient.id, case_paper_id=cp.id)
    assert r.status_code == 200, r.text
    inv = db_session.query(Invoice).get(r.json()["id"])
    assert inv.created_at == when
    assert r.json()["back_dated"] is True


def test_an_explicit_date_beats_the_case_paper(client, auth_headers, db_session, test_clinic, test_patient):
    cp = _paper(db_session, test_clinic, test_patient,
                datetime.datetime.utcnow() - datetime.timedelta(days=3))
    today = clinic_today(test_clinic)
    r = _create(client, auth_headers, test_patient.id, case_paper_id=cp.id, invoice_date=today.isoformat())
    assert r.status_code == 200, r.text
    assert r.json()["invoice_date"] == today.isoformat()
    assert r.json()["back_dated"] is False


def test_procedure_draft_follows_the_case_paper(db_session, test_clinic, test_patient):
    from domains.finance.routes.invoices import get_or_create_draft_invoice
    when = (datetime.datetime.utcnow() - datetime.timedelta(days=2)).replace(microsecond=0)
    cp = _paper(db_session, test_clinic, test_patient, when)
    inv = get_or_create_draft_invoice(db_session, test_clinic.id, test_patient.id, cp.id)
    assert inv.created_at == when


def test_date_and_time_can_be_set_exactly(client, auth_headers, db_session, test_clinic, test_patient):
    r = _create(client, auth_headers, test_patient.id)
    inv_id = r.json()["id"]
    when = (datetime.datetime.utcnow() - datetime.timedelta(days=4)).replace(microsecond=0)
    r = client.put(f"/api/v1/invoices/{inv_id}", json={"invoice_date": when.isoformat() + "Z"},
                   headers=auth_headers)
    assert r.status_code == 200, r.text
    inv = db_session.query(Invoice).get(inv_id)
    db_session.refresh(inv)
    assert inv.created_at == when
    future = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    r = client.put(f"/api/v1/invoices/{inv_id}", json={"invoice_date": future.isoformat() + "Z"},
                   headers=auth_headers)
    assert r.status_code == 400
