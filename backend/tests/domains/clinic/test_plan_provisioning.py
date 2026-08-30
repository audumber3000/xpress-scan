"""
The invariant: a clinic always owns exactly one subscription row.

Breaking it is what produced nineteen clinics that read as Plus, cost nothing,
never expired, and raised no warning, because "no subscription row" and
"everything is fine" are the same thing to plan_state.

These tests use their own in-memory SQLite session rather than the postgres
fixtures in tests/conftest.py: what is under test is the shape of the row that
gets written, which is the same on either engine, and a unit test that needs a
running database is a unit test that stops being run.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core import plan_bootstrap, plan_state, plans
from models import Base, Clinic, Subscription


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def clinic(db):
    c = Clinic(name="Test Clinic", email="t@c.com", specialization="dental")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_new_clinic_gets_a_seven_day_plus_trial(db, clinic):
    now = dt.datetime(2026, 9, 1, 12, 0, 0)
    sub = plan_bootstrap.provision_new_clinic(db, clinic, user_id=None, now=now)
    db.commit()

    assert sub.plan_name == "plus"
    assert sub.status == "active"
    assert sub.provider == "trial"
    assert sub.is_trial is True
    assert sub.current_start == now
    assert sub.current_end == dt.datetime(2026, 9, 8, 12, 0, 0)


def test_the_signup_trial_consumes_the_one_trial(db, clinic):
    """trial_used is set at signup, so /start-trial cannot hand out a second."""
    sub = plan_bootstrap.provision_new_clinic(db, clinic)
    db.commit()
    assert sub.trial_used is True


def test_clinic_column_agrees_with_the_row(db, clinic):
    """The header reads clinics.subscription_plan; the page reads the row.

    They disagreeing on screen is the bug plans.effective_plan was written to
    end, so provisioning has to set both.
    """
    sub = plan_bootstrap.provision_new_clinic(db, clinic)
    db.commit()
    assert clinic.subscription_plan == sub.plan_name == "plus"


def test_never_writes_a_second_row(db, clinic):
    """Re-provisioning must not reset a clinic, least of all a paying one."""
    first = plan_bootstrap.provision_new_clinic(db, clinic)
    db.commit()

    first.plan_name = "pro"
    first.provider = "cashfree"
    first.is_trial = False
    db.commit()

    again = plan_bootstrap.provision_new_clinic(db, clinic)
    db.commit()

    assert again.id == first.id
    assert again.plan_name == "pro"          # untouched
    assert again.provider == "cashfree"      # not reset to a trial
    assert db.query(Subscription).filter(Subscription.clinic_id == clinic.id).count() == 1


def test_a_provisioned_clinic_is_visible_to_the_state_machine(db, clinic):
    """The whole point: the clinic now has an end date, so it can be warned.

    Before the fix this returned state 'ok' with days_left None forever, which
    is indistinguishable from a healthy paying clinic.
    """
    now = dt.datetime(2026, 9, 1, 12, 0, 0)
    sub = plan_bootstrap.provision_new_clinic(db, clinic, now=now)
    db.commit()

    healthy = plan_state.evaluate(sub, now=now + dt.timedelta(days=1))
    assert healthy["state"] == plan_state.OK
    assert healthy["days_left"] is not None

    expired = plan_state.evaluate(sub, now=now + dt.timedelta(days=8))
    assert expired["state"] == plan_state.TRIAL_ENDED
    assert expired["blocks"] is True         # read-only until they pay


def test_row_less_clinic_reads_as_a_healthy_plus_forever(db, clinic):
    """Characterises the bug itself, so a regression is visible as a failure here.

    A clinic with no row is reported OK with no expiry, and 'free' resolves to
    Plus. Nothing in that picture is distinguishable from a clinic in good
    standing, which is exactly why nobody noticed for five days.
    """
    assert plans.key_of("free") == "plus"

    state = plan_state.evaluate(None)
    assert state["state"] == plan_state.OK
    assert state["days_left"] is None
    assert state["blocks"] is False
