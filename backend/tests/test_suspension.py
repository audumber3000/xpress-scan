"""What a suspended clinic is told, and that it is actually stopped.

The bug these exist to prevent already happened once, for months: the CRM could
suspend an account, `clinics.status` said `suspended`, and the product let
everybody carry on working. Nothing read the column. So the tests that matter
most here are not about wording — they are the two that assert a suspended
account cannot sign in and cannot read.

    ./venv/bin/python -m pytest tests/test_suspension.py -q
"""
import datetime
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

# Assigned, not setdefault, for the reason the contract suite spells out: a
# developer with DATABASE_URL exported would otherwise point these at it.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret"

import jwt                                                          # noqa: E402
from fastapi import Depends, FastAPI                                # noqa: E402
from fastapi.testclient import TestClient                           # noqa: E402
from sqlalchemy import create_engine                                # noqa: E402
from sqlalchemy.orm import sessionmaker                             # noqa: E402
from sqlalchemy.pool import StaticPool                              # noqa: E402

import database                                                     # noqa: E402
from core import suspension                                         # noqa: E402
from models import Base, Clinic, User                               # noqa: E402

NOW = datetime.datetime(2026, 9, 19, 9, 0, 0)


@pytest.fixture()
def db(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[Clinic.__table__, User.__table__])
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()

    session.add_all([
        Clinic(id=1, name="Smile Dental Care", status="active"),
        Clinic(id=2, name="Smile Dental — Kothrud", status="active", parent_clinic_id=1),
        Clinic(id=3, name="Bright Smiles", status="active"),
        User(id=10, clinic_id=1, role="clinic_owner", is_active=True, name="Priya Sharma",
             first_name="Priya", last_name="Sharma", email="priya@smiledental.in"),
        User(id=11, clinic_id=2, role="receptionist", is_active=True, name="Asha Rao",
             first_name="Asha", last_name="Rao", email="asha@smiledental.in"),
        User(id=12, clinic_id=3, role="clinic_owner", is_active=True, name="Dana Cole",
             first_name="Dana", last_name="Cole", email="dana@brightsmiles.com"),
    ])
    session.commit()

    # The middleware opens its own session, the way it does in the app.
    monkeypatch.setattr(database, "SessionLocal", Session)
    yield session
    session.close()


def suspend(db, clinic_id, code="duplicate_accounts", note=None):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    clinic.status = "suspended"
    clinic.suspension_reason = code
    clinic.suspension_note = note
    clinic.suspended_at = NOW
    db.commit()
    return clinic


# ── The card ─────────────────────────────────────────────────────────────────

def test_the_card_says_what_happened_and_how_to_reach_a_person(db):
    clinic = suspend(db, 1, "duplicate_accounts", note="Accounts 1, 8 and 22 share a number.")
    card = suspension.payload(clinic)

    assert card["reason"] == "account_suspended"
    assert card["code"] == "duplicate_accounts"
    assert "more than one MolarPlus account" in card["message"]
    assert card["examples"], "a policy suspension says what leads to it"
    # The operator's line about this clinic, under the policy rather than
    # instead of it.
    assert card["note"] == "Accounts 1, 8 and 22 share a number."
    assert card["reference"] == "MP-1"

    support = card["support"]
    assert support["whatsapp"].startswith("https://wa.me/")
    assert "Smile%20Dental%20Care" in support["whatsapp"], "support opens with who is asking"
    assert "MP-1" in support["whatsapp"]
    assert "@" in support["email"] and support["phone"]


def test_a_suspension_nobody_gave_a_reason_for_reads_as_policy(db):
    clinic = suspend(db, 1, code=None)
    assert suspension.payload(clinic)["code"] == "policy_violation"


def test_every_reason_has_words_of_its_own(db):
    for entry in suspension.catalogue():
        assert entry["label"] and entry["title"] and entry["message"]
        assert entry["code"] in suspension.CODES
    titles = {entry["message"] for entry in suspension.catalogue()}
    assert len(titles) == len(suspension.CODES), "two reasons sharing a message is one reason"


def test_being_on_hold_does_not_read_like_being_thrown_off(db):
    """Tone is the feature. A clinic we are checking something about must not
    be told it broke the rules, and one we cut off for copying us must not be
    told it is a temporary hold."""
    review = dict(suspension.REASONS[suspension.UNDER_REVIEW])
    assert "temporarily" in review["title"] or "hold" in review["title"].lower()
    assert "policies" not in review["message"]
    assert "breach of our terms" in suspension.REASONS[suspension.COPYING_PLATFORM]["message"]


# ── Who is blocked ───────────────────────────────────────────────────────────

def test_the_owner_of_a_suspended_clinic_is_blocked(db):
    suspend(db, 1)
    user = db.query(User).filter(User.id == 10).first()
    assert suspension.blocked_for_user(db, user)["code"] == "duplicate_accounts"


def test_a_branch_of_a_suspended_account_is_blocked_too(db):
    """The suspension is applied to every clinic in the group, but a branch
    created afterwards would not have it — and would otherwise be a working way
    into a suspended account."""
    suspend(db, 1)
    branch = db.query(Clinic).filter(Clinic.id == 2).first()
    branch.status = "active"          # never carried the suspension
    db.commit()

    user = db.query(User).filter(User.id == 11).first()
    card = suspension.blocked_for_user(db, user)
    assert card is not None
    assert card["code"] == "duplicate_accounts"
    # The account's reason, the branch's reference — support is being called
    # about the clinic in front of them.
    assert card["reference"] == "MP-2"


def test_another_clinic_is_not_touched(db):
    suspend(db, 1)
    user = db.query(User).filter(User.id == 12).first()
    assert suspension.blocked_for_user(db, user) is None


def test_a_cancelled_clinic_is_not_a_suspended_one(db):
    clinic = db.query(Clinic).filter(Clinic.id == 1).first()
    clinic.status = "cancelled"       # they closed down; we did not cut them off
    db.commit()
    user = db.query(User).filter(User.id == 10).first()
    assert suspension.blocked_for_user(db, user) is None


# ── The lock ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def app_client(db):
    app = FastAPI()

    @app.get("/api/v1/patients")
    def patients():
        return {"data": ["a patient the clinic should not be reading"]}

    @app.post("/api/v1/patients")
    def create_patient():
        return {"created": True}

    @app.post("/api/v1/auth/logout")
    def logout():
        return {"ok": True}

    @app.post("/webhook/cashfree")
    def webhook():
        return {"ok": True}

    suspension.install_suspension_lock(app)
    return TestClient(app)


def token_for(user_id):
    return {"Authorization": "Bearer " + jwt.encode({"user_id": user_id}, "test-secret",
                                                    algorithm="HS256")}


def test_a_suspended_clinic_cannot_even_read(db, app_client):
    """Not the read-only lock. A trial that ended leaves the clinic reading its
    own records; a suspension ends the session, and the app shows one card."""
    suspend(db, 1)
    response = app_client.get("/api/v1/patients", headers=token_for(10))
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["reason"] == "account_suspended"
    assert detail["title"] and detail["support"]["whatsapp"]

    assert app_client.post("/api/v1/patients", headers=token_for(10)).status_code == 403


def test_signing_out_still_works_while_suspended(db, app_client):
    """Or the card is a trap: the one button on it has to be able to do
    something."""
    suspend(db, 1)
    assert app_client.post("/api/v1/auth/logout", headers=token_for(10)).status_code == 200


def test_a_webhook_is_not_the_clinic(db, app_client):
    suspend(db, 1)
    assert app_client.post("/webhook/cashfree", headers=token_for(10)).status_code == 200


def test_everybody_else_carries_on(db, app_client):
    suspend(db, 1)
    assert app_client.get("/api/v1/patients", headers=token_for(12)).status_code == 200
    assert app_client.get("/api/v1/patients").status_code == 200


def test_the_lock_fails_open(db, app_client, monkeypatch):
    """A bug in this file must never be the reason a dentist cannot open a
    patient's record. Every other guard in this codebase fails open; so does
    this one."""
    def explode(*args, **kwargs):
        raise RuntimeError("the database is having a day")

    monkeypatch.setattr(suspension, "blocked_for_user", explode)
    suspend(db, 1)
    assert app_client.get("/api/v1/patients", headers=token_for(10)).status_code == 200


def test_signing_in_is_refused_with_the_same_card(db):
    """Not left to the middleware. A token handed out first means the app
    loads, draws a dashboard, and only then fills with errors — so the sign-in
    itself is refused, and the card is the first thing anybody sees."""
    from fastapi import HTTPException

    from domains.auth.routes.auth_clean import refuse_if_suspended

    user = db.query(User).filter(User.id == 10).first()
    refuse_if_suspended(db, user)     # nothing to refuse yet

    suspend(db, 1, "copying_platform")
    with pytest.raises(HTTPException) as raised:
        refuse_if_suspended(db, user)
    assert raised.value.status_code == 403
    assert raised.value.detail["reason"] == "account_suspended"
    assert raised.value.detail["code"] == "copying_platform"
