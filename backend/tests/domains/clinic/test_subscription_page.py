"""The Subscription page's supporting numbers: honest, and said once.

  * Plus is 600 new patients and appointments a month
  * the trust line is a real count, rounded down, and silent while small
  * the locked banner's "your 97 patients and 134 invoices" come from the clinic's own rows
  * paid plans get renewal reminders at 7, 3 and 1 days, once per threshold per period,
    and trials and the migration grant get none
"""
import datetime as dt

import pytest

from core import plans, plan_renewal, social_proof


NOW = dt.datetime.utcnow


def test_plus_allows_600_patients_and_appointments():
    assert plans.limit("plus", "patients") == 600
    assert plans.limit("plus", "appointments") == 600
    plus = plans.catalogue()["plans"][0]
    assert "600 new patients and appointments a month" in plus["features"]
    assert "100 GB for X-rays, photos and files" in plus["features"]
    assert plus["tagline"] == "Best for a single clinic and small team"


@pytest.mark.parametrize("n,shown", [(50, 50), (59, 50), (99, 90), (256, 250), (299, 250), (1234, 1200)])
def test_social_proof_rounds_down(n, shown):
    assert social_proof._floor_round(n) == shown


def test_social_proof_is_silent_while_the_number_is_small(db_session, test_clinic, monkeypatch):
    monkeypatch.setenv("SOCIAL_PROOF_MIN_CLINICS", "50")
    assert social_proof.compute(db_session) is None
    monkeypatch.setenv("SOCIAL_PROOF_MIN_CLINICS", "1")
    proof = social_proof.compute(db_session)
    assert proof["clinics"] >= 1 and "dental clinics in" in proof["text"]


def test_plans_endpoint_carries_trust_and_no_invented_testimonial(client, auth_headers):
    body = client.get("/api/v1/subscriptions/plans", headers=auth_headers).json()
    assert "social_proof" in body
    assert body["testimonial"] is None


def test_usage_reports_the_clinics_own_records(client, auth_headers, db_session, test_clinic):
    from models import Patient
    for i in range(3):
        db_session.add(Patient(clinic_id=test_clinic.id, name=f"P{i}", phone=f"98765000{i}"))
    db_session.commit()
    usage = client.get("/api/v1/subscriptions/usage", headers=auth_headers).json()
    assert usage["records"]["patients"] == 3
    assert usage["records"]["invoices"] == 0


# ── renewal reminders ────────────────────────────────────────────────────────

def _sub(db, clinic, provider="cashfree", days=6, trial=False, status="active"):
    from models import Subscription
    s = Subscription(clinic_id=clinic.id, plan_name="plus", provider=provider, status=status, is_trial=trial,
                     current_start=NOW() - dt.timedelta(days=24), current_end=NOW() + dt.timedelta(days=days))
    db.add(s)
    db.commit()
    return s


def _reminders(db, clinic):
    from models import Notification
    return db.query(Notification).filter(Notification.clinic_id == clinic.id,
                                         Notification.event_type == "plan_renewal_due").count()


def test_paid_plan_is_reminded_once_per_threshold(db_session, test_clinic, test_user):
    sub = _sub(db_session, test_clinic, days=6)
    assert plan_renewal.send_due(db_session) == 1
    assert plan_renewal.send_due(db_session) == 0, "the 7-day reminder is said once"
    sub.current_end = NOW() + dt.timedelta(hours=20)
    db_session.commit()
    assert plan_renewal.send_due(db_session) == 1, "then the 1-day one"
    assert plan_renewal.send_due(db_session) == 0
    assert _reminders(db_session, test_clinic) >= 1


def test_paying_again_starts_the_count_afresh(db_session, test_clinic, test_user):
    sub = _sub(db_session, test_clinic, days=1)
    plan_renewal.send_due(db_session)
    sub.current_end = NOW() + dt.timedelta(days=5)   # renewed: a new period
    db_session.commit()
    assert plan_renewal.send_due(db_session) == 1


@pytest.mark.parametrize("provider,trial", [("trial", True), ("migration", False)])
def test_trials_and_grants_get_no_renewal_reminder(db_session, test_clinic, test_user, provider, trial):
    _sub(db_session, test_clinic, provider=provider, trial=trial, days=2)
    assert plan_renewal.send_due(db_session) == 0


def test_nothing_is_said_more_than_a_week_out(db_session, test_clinic, test_user):
    _sub(db_session, test_clinic, days=12)
    assert plan_renewal.send_due(db_session) == 0


def test_renewal_job_is_registered():
    import ast
    import pathlib
    src = pathlib.Path(__file__).resolve().parents[3] / "core" / "scheduler.py"
    ids = {kw.value.value for node in ast.walk(ast.parse(src.read_text())) if isinstance(node, ast.Call)
           for kw in node.keywords if kw.arg == "id" and isinstance(kw.value, ast.Constant)}
    assert "plan_renewal_reminder" in ids
