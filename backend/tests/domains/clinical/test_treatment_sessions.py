"""Courses of treatment sold as a fixed number of sittings.

A temporary accommodation for one skin clinic, deliberately isolated in its own
table and router so it can be removed cleanly. These tests pin the rules that
make the count trustworthy — because a counter people do not trust gets worked
around on paper, which is the problem it exists to solve.
"""
import pytest

from models import Clinic, Patient, TreatmentSession


def _create(client, headers, patient_id, total=6, label="Laser hair reduction", **extra):
    body = {"patient_id": patient_id, "label": label, "total_sessions": total}
    body.update(extra)
    return client.post("/api/v1/treatment-sessions", json=body, headers=headers)


@pytest.fixture
def course(client, auth_headers, test_patient):
    r = _create(client, auth_headers, test_patient.id)
    assert r.status_code == 201, r.text
    return r.json()


def test_a_course_starts_with_nothing_used(course):
    assert course["total_sessions"] == 6
    assert course["used_sessions"] == 0
    assert course["remaining"] == 6
    assert course["ledger"] == []


def test_using_a_sitting_counts_down(client, auth_headers, course):
    for expected in (1, 2, 3):
        r = client.post(f"/api/v1/treatment-sessions/{course['id']}/use",
                        json={}, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["used_sessions"] == expected
        assert r.json()["remaining"] == 6 - expected


def test_the_ledger_records_who_and_when(client, auth_headers, course, test_user):
    client.post(f"/api/v1/treatment-sessions/{course['id']}/use",
                json={"note": "third sitting, mild erythema"}, headers=auth_headers)
    r = client.get(f"/api/v1/treatment-sessions/patients/{course['patient_id']}",
                   headers=auth_headers)
    entry = r.json()[0]["ledger"][-1]
    assert entry["used_by"] == test_user.id
    assert entry["note"] == "third sitting, mild erythema"
    assert entry["used_at"]


def test_it_refuses_to_go_past_the_total(client, auth_headers, course):
    """Silently allowing 7 of 6 would make the record claim sittings the course
    does not contain. Raising the total is a decision, and leaves a trace."""
    for _ in range(6):
        client.post(f"/api/v1/treatment-sessions/{course['id']}/use",
                    json={}, headers=auth_headers)
    r = client.post(f"/api/v1/treatment-sessions/{course['id']}/use",
                    json={}, headers=auth_headers)
    assert r.status_code == 400
    assert "used" in r.json()["detail"].lower()


def test_undo_takes_back_the_last_sitting(client, auth_headers, course):
    """The count is advanced by hand, so it will be advanced by mistake."""
    client.post(f"/api/v1/treatment-sessions/{course['id']}/use", json={}, headers=auth_headers)
    client.post(f"/api/v1/treatment-sessions/{course['id']}/use", json={}, headers=auth_headers)

    r = client.post(f"/api/v1/treatment-sessions/{course['id']}/undo", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["used_sessions"] == 1
    assert len(r.json()["ledger"]) == 1


def test_undo_on_an_untouched_course_is_refused(client, auth_headers, course):
    r = client.post(f"/api/v1/treatment-sessions/{course['id']}/undo", headers=auth_headers)
    assert r.status_code == 400


def test_the_total_can_be_raised_but_not_below_what_was_given(
    client, auth_headers, course
):
    for _ in range(3):
        client.post(f"/api/v1/treatment-sessions/{course['id']}/use", json={}, headers=auth_headers)

    ok = client.patch(f"/api/v1/treatment-sessions/{course['id']}",
                      json={"total_sessions": 10}, headers=auth_headers)
    assert ok.status_code == 200
    assert ok.json()["remaining"] == 7

    bad = client.patch(f"/api/v1/treatment-sessions/{course['id']}",
                       json={"total_sessions": 2}, headers=auth_headers)
    assert bad.status_code == 400


def test_deactivating_hides_it_from_the_default_list(client, auth_headers, course):
    client.patch(f"/api/v1/treatment-sessions/{course['id']}",
                 json={"is_active": False}, headers=auth_headers)
    pid = course["patient_id"]
    assert client.get(f"/api/v1/treatment-sessions/patients/{pid}", headers=auth_headers).json() == []
    shown = client.get(f"/api/v1/treatment-sessions/patients/{pid}?include_inactive=true",
                       headers=auth_headers).json()
    assert len(shown) == 1


# ── isolation ───────────────────────────────────────────────────────────────

def test_another_clinics_course_is_invisible_and_untouchable(
    client, auth_headers, db_session, test_clinic
):
    other = Clinic(name="Other Skin Clinic", address="x", phone="9", email="o@c.com",
                   specialization="dermatology", subscription_plan="free")
    db_session.add(other); db_session.commit(); db_session.refresh(other)
    stranger = Patient(clinic_id=other.id, name="Someone Else", phone="9000000002")
    db_session.add(stranger); db_session.commit(); db_session.refresh(stranger)

    theirs = TreatmentSession(clinic_id=other.id, patient_id=stranger.id,
                              label="Chemical peel", total_sessions=4, used_sessions=0)
    db_session.add(theirs); db_session.commit(); db_session.refresh(theirs)

    assert client.get(f"/api/v1/treatment-sessions/patients/{stranger.id}",
                      headers=auth_headers).status_code == 404
    assert client.post(f"/api/v1/treatment-sessions/{theirs.id}/use",
                       json={}, headers=auth_headers).status_code == 404

    db_session.refresh(theirs)
    assert theirs.used_sessions == 0


def test_a_case_paper_from_another_patient_is_not_linked(
    client, auth_headers, db_session, test_clinic, test_patient
):
    """A link to somebody else's paper would read as history that never
    happened, so it is dropped rather than stored."""
    from models import CasePaper
    other_patient = Patient(clinic_id=test_clinic.id, name="Second Patient", phone="9000000003")
    db_session.add(other_patient); db_session.commit(); db_session.refresh(other_patient)
    paper = CasePaper(clinic_id=test_clinic.id, patient_id=other_patient.id)
    db_session.add(paper); db_session.commit(); db_session.refresh(paper)

    r = _create(client, auth_headers, test_patient.id, case_paper_id=paper.id)
    assert r.status_code == 201
    assert r.json()["case_paper_id"] is None


def test_a_course_needs_at_least_one_sitting(client, auth_headers, test_patient):
    assert _create(client, auth_headers, test_patient.id, total=0).status_code == 422


def test_requires_auth(client, test_patient):
    assert client.get(f"/api/v1/treatment-sessions/patients/{test_patient.id}").status_code in (401, 403)
    assert client.post("/api/v1/treatment-sessions", json={}).status_code in (401, 403, 422)
