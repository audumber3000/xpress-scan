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


# ── Once you are paying, the only move is up ─────────────────────────────────
#
# Enforced in subscription_service.create_checkout_session. These cover the rule
# itself rather than the gateway call around it: the interesting part is WHICH
# subscriptions lock the plans below them, and a trial, a grant and an expired
# plan all deliberately do not.

def _live_paid(plan="pro"):
    return Subscription(
        plan_name=plan, status="active", provider="cashfree",
        is_trial=False, current_end=dt.datetime.utcnow() + dt.timedelta(days=20),
    )


def _locks_downgrade(sub, wanted, now=None):
    """The production predicate itself, not a copy of it.

    Reimplementing the rule here would let the test keep passing while the
    checkout drifted, which is the failure mode these tests exist to catch.
    """
    return plan_state.blocks_downgrade_to(sub, wanted, now)


def test_a_paying_clinic_cannot_drop_to_a_lower_plan():
    assert _locks_downgrade(_live_paid("pro"), "plus") is True
    assert _locks_downgrade(_live_paid("growth"), "pro") is True


def test_a_paying_clinic_can_always_move_up_or_stay():
    assert _locks_downgrade(_live_paid("plus"), "pro") is False
    assert _locks_downgrade(_live_paid("pro"), "pro") is False


def test_a_trial_does_not_lock_anything():
    """Converting a Plus trial into paid Plus is the normal path, not a downgrade."""
    sub = _live_paid("pro")
    sub.is_trial = True
    sub.provider = "trial"
    assert _locks_downgrade(sub, "plus") is False


def test_a_migration_grant_does_not_lock_anything():
    sub = _live_paid("plus")
    sub.provider = "migration"
    assert _locks_downgrade(sub, "plus") is False


def test_an_expired_plan_does_not_lock_anything():
    """Somebody whose Pro trial ran out has bought nothing; sell them Plus."""
    sub = _live_paid("pro")
    sub.current_end = dt.datetime.utcnow() - dt.timedelta(days=1)
    assert _locks_downgrade(sub, "plus") is False


# ── A branch is covered by its parent's plan, and its parent's lock ──────────
#
# owner_add_clinic creates branches with no subscription row, on the
# understanding that the parent's plan covers them. Nothing enforced that: the
# owner fallback in for_clinic looks for a clinic_owner sitting in *this*
# clinic, the owner is normally in the main one, so a branch resolved to no
# subscription at all, which evaluate() reads as healthy with no expiry.
# A locked parent had freely writable branches.

def _user(clinic_id, email, role):
    from models import User
    return User(clinic_id=clinic_id, email=email, first_name="A", last_name="B",
                name="A B", role=role, is_active=True)


@pytest.fixture()
def branch_setup(db):
    main = Clinic(name="Main"); branch = Clinic(name="Branch")
    db.add_all([main, branch]); db.commit()
    branch.parent_clinic_id = main.id
    owner = _user(main.id, "o@x.com", "clinic_owner")
    db.add_all([owner, _user(branch.id, "r@x.com", "receptionist")])
    db.commit()
    return main, branch, owner


def test_a_branch_inherits_its_parents_lock(db, branch_setup):
    main, branch, owner = branch_setup
    db.add(Subscription(
        clinic_id=main.id, user_id=owner.id, plan_name="pro", status="active",
        provider="cashfree", is_trial=False,
        current_end=dt.datetime.utcnow() - dt.timedelta(days=1),
    ))
    db.commit()

    assert plan_state.for_clinic(db, main)["blocks"] is True
    assert plan_state.for_clinic(db, branch)["blocks"] is True


def test_a_branch_inherits_a_healthy_parent_too(db, branch_setup):
    main, branch, owner = branch_setup
    db.add(Subscription(
        clinic_id=main.id, user_id=owner.id, plan_name="pro", status="active",
        provider="cashfree", is_trial=False,
        current_end=dt.datetime.utcnow() + dt.timedelta(days=30),
    ))
    db.commit()

    assert plan_state.for_clinic(db, branch)["state"] == plan_state.OK
    assert plan_state.for_clinic(db, branch)["blocks"] is False


def test_a_branch_with_its_own_row_uses_it(db, branch_setup):
    """The Aug 2026 backfill gave branches real grant rows. Those still win."""
    main, branch, owner = branch_setup
    db.add(Subscription(
        clinic_id=main.id, user_id=owner.id, plan_name="pro", status="active",
        provider="cashfree", is_trial=False,
        current_end=dt.datetime.utcnow() - dt.timedelta(days=1),      # parent lapsed
    ))
    db.add(Subscription(
        clinic_id=branch.id, plan_name="plus", status="active",
        provider="migration", is_trial=False,
        current_end=dt.datetime.utcnow() + dt.timedelta(days=30),     # branch granted
    ))
    db.commit()

    assert plan_state.for_clinic(db, branch)["blocks"] is False


def test_a_parent_cycle_cannot_hang_the_walk(db):
    """Defensive: bad data must not spin the request thread forever."""
    a = Clinic(name="A"); b = Clinic(name="B")
    db.add_all([a, b]); db.commit()
    a.parent_clinic_id = b.id
    b.parent_clinic_id = a.id
    db.commit()

    assert plan_state.for_clinic(db, a)["state"] == plan_state.OK
