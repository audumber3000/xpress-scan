"""Appointments finish themselves when there is evidence the patient was seen.

Nothing in this application ever wrote `completed`. The value was read by
appointment_stats.py and kpi_detail.py and written only by POST
/appointments/{id}/outcome, which somebody had to remember to call. Nobody did,
so appointments sat in `arrived` and the no-show rate had no denominator.

The line these tests defend: `completed` may be concluded from POSITIVE
EVIDENCE (a case paper, an invoice); `no_show` may never be concluded from
silence. /needs-outcome keeps handling the rest.
"""
import datetime

import pytest

from models import Appointment, CasePaper, Invoice


def _appointment(db, clinic, patient, status="arrived", when=None):
    a = Appointment(
        clinic_id=clinic.id,
        patient_id=patient.id,
        patient_name=patient.name,
        appointment_date=when or datetime.datetime.utcnow(),
        # NOT NULL on the table, both of them.
        start_time="11:00",
        end_time="11:30",
        duration=30,
        status=status,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _case_paper(client, headers, patient_id, appointment_id):
    return client.post(
        "/api/v1/clinical/case-papers",
        json={
            "patient_id": patient_id,
            "appointment_id": appointment_id,
            "date": datetime.datetime.utcnow().isoformat(),
            "chief_complaint": "Follow up",
        },
        headers=headers,
    )


# ── evidence completes ──────────────────────────────────────────────────────

def test_a_case_paper_completes_an_arrived_appointment(
    client, auth_headers, db_session, test_clinic, test_patient
):
    appt = _appointment(db_session, test_clinic, test_patient)
    r = _case_paper(client, auth_headers, test_patient.id, appt.id)
    assert r.status_code == 200, r.text

    db_session.refresh(appt)
    assert appt.status == "completed"
    assert appt.outcome_at is not None
    assert appt.outcome_by is not None
    assert appt.outcome_source == "case_paper"


@pytest.mark.parametrize("start", ["scheduled", "confirmed", "arrived"])
def test_every_open_status_completes(
    client, auth_headers, db_session, test_clinic, test_patient, start
):
    """A clinic that never checks anyone in still gets its outcomes."""
    appt = _appointment(db_session, test_clinic, test_patient, status=start)
    _case_paper(client, auth_headers, test_patient.id, appt.id)
    db_session.refresh(appt)
    assert appt.status == "completed"


def test_an_invoice_completes_an_arrived_appointment(
    client, auth_headers, db_session, test_clinic, test_patient
):
    appt = _appointment(db_session, test_clinic, test_patient)
    r = client.post(
        "/api/v1/invoices",
        json={"patient_id": test_patient.id, "appointment_id": appt.id, "items": []},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text

    db_session.refresh(appt)
    assert appt.status == "completed"
    assert appt.outcome_source == "invoice"


# ── and never overrides a human ─────────────────────────────────────────────

@pytest.mark.parametrize("terminal", ["cancelled", "no_show"])
def test_a_recorded_outcome_is_never_overridden(
    client, auth_headers, db_session, test_clinic, test_patient, terminal
):
    """They told us what happened. A later case paper does not get to argue."""
    appt = _appointment(db_session, test_clinic, test_patient, status=terminal)
    _case_paper(client, auth_headers, test_patient.id, appt.id)

    db_session.refresh(appt)
    assert appt.status == terminal
    assert appt.outcome_source is None


def test_nothing_is_ever_auto_marked_no_show(client, auth_headers, db_session,
                                             test_clinic, test_patient):
    """The whole distinction. A past appointment with no record stays open and
    goes through /needs-outcome, where a human answers — guessing absence from
    silence is what would poison the number."""
    past = datetime.datetime.utcnow() - datetime.timedelta(days=2)
    appt = _appointment(db_session, test_clinic, test_patient,
                        status="scheduled", when=past)

    r = client.get("/api/v1/appointments/needs-outcome", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert appt.id in [a["id"] for a in r.json()["appointments"]]

    db_session.refresh(appt)
    assert appt.status == "scheduled"


def test_completing_twice_is_a_no_op(client, auth_headers, db_session,
                                     test_clinic, test_patient):
    """A second case paper on the same appointment must not re-stamp it."""
    appt = _appointment(db_session, test_clinic, test_patient)
    _case_paper(client, auth_headers, test_patient.id, appt.id)
    db_session.refresh(appt)
    first_at = appt.outcome_at

    _case_paper(client, auth_headers, test_patient.id, appt.id)
    db_session.refresh(appt)
    assert appt.outcome_at == first_at


def test_a_case_paper_with_no_appointment_completes_nothing(
    client, auth_headers, db_session, test_clinic, test_patient
):
    """Walk-ins have no appointment. That must not error, and must not reach for
    an unrelated one."""
    other = _appointment(db_session, test_clinic, test_patient)
    r = client.post(
        "/api/v1/clinical/case-papers",
        json={"patient_id": test_patient.id,
              "date": datetime.datetime.utcnow().isoformat(),
              "chief_complaint": "Walk in"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    db_session.refresh(other)
    assert other.status == "arrived"


# ── the overloaded id, which is the trap ────────────────────────────────────

def test_an_invoice_whose_appointment_id_is_really_a_case_paper_id(
    client, auth_headers, db_session, test_clinic, test_patient
):
    """Older case-paper invoices overload `appointment_id` to hold a CASE PAPER
    id. Read naively that completes whichever appointment happens to share the
    number. The patient guard in appointment_for_invoice is what stops it."""
    from models import Clinic, Patient

    other_clinic = Clinic(name="Other", address="x", phone="9", email="o@c.com",
                          specialization="dental", subscription_plan="free")
    db_session.add(other_clinic); db_session.commit(); db_session.refresh(other_clinic)
    stranger = Patient(clinic_id=other_clinic.id, name="Someone Else", phone="9000000001")
    db_session.add(stranger); db_session.commit(); db_session.refresh(stranger)

    victim = _appointment(db_session, other_clinic, stranger)

    from domains.scheduling.services.appointment_completion import appointment_for_invoice
    invoice = Invoice(clinic_id=test_clinic.id, patient_id=test_patient.id,
                      appointment_id=victim.id, status="draft", total=0.0,
                      invoice_number="TEST-OVERLOAD-1")
    db_session.add(invoice); db_session.commit(); db_session.refresh(invoice)

    assert appointment_for_invoice(db_session, invoice) is None
    db_session.refresh(victim)
    assert victim.status == "arrived"


def test_an_invoice_resolves_through_its_case_paper(
    client, auth_headers, db_session, test_clinic, test_patient
):
    """case_paper_id is trusted first, so a paper's appointment is found even
    when the invoice carries no appointment_id of its own."""
    from domains.scheduling.services.appointment_completion import appointment_for_invoice

    appt = _appointment(db_session, test_clinic, test_patient)
    paper = CasePaper(clinic_id=test_clinic.id, patient_id=test_patient.id,
                      appointment_id=appt.id)
    db_session.add(paper); db_session.commit(); db_session.refresh(paper)

    invoice = Invoice(clinic_id=test_clinic.id, patient_id=test_patient.id,
                      case_paper_id=paper.id, status="draft", total=0.0,
                      invoice_number="TEST-PAPER-1")
    db_session.add(invoice); db_session.commit(); db_session.refresh(invoice)

    assert appointment_for_invoice(db_session, invoice).id == appt.id


def test_a_broken_hook_never_blocks_the_case_paper(
    client, auth_headers, db_session, test_clinic, test_patient, monkeypatch
):
    """Recording clinical work must not fail because a scheduling row would not
    update."""
    import domains.scheduling.services.appointment_completion as mod

    def boom(*a, **k):
        raise RuntimeError("scheduling unavailable")

    monkeypatch.setattr(mod, "complete_appointment_if_open", boom)
    appt = _appointment(db_session, test_clinic, test_patient)
    r = _case_paper(client, auth_headers, test_patient.id, appt.id)
    assert r.status_code == 200, r.text
