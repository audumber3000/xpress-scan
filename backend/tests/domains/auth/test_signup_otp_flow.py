"""Signup verification: the OTP step that blocks the end of onboarding.

These exist because of a live incident. A clinic signing up on Android was sent
more than twenty codes and could not use any of them, and uninstalled the app.
Three separate things combined:

  * a resend invalidated the code before it, so with several messages on a phone
    exactly one worked and the rest answered "Incorrect code";
  * the send endpoint had no rate limit of its own, unlike every other OTP path
    here, so a client that re-sent on mount was never told to stop;
  * the only throttle was component state, which reset on every remount.

The tests below pin the behaviour that fixes it. The first one is the incident:
a code from two resends ago must still be accepted.

They drive the route functions directly against SQLite rather than going through
the app, so they need no Postgres and no Nexus: the only stub is delivery, which
captures the code that would have been sent.
"""
import pytest
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Clinic, NotificationLog, OtpVerification
import domains.auth.routes.security as sec


PHONE = "+919876543210"
EMAIL = "owner@clinic.test"


class _Owner:
    """Stands in for the `require_clinic_owner` dependency's return value."""

    def __init__(self, clinic_id):
        self.clinic_id = clinic_id


@pytest.fixture
def outbox(monkeypatch):
    """Every code delivery, captured instead of sent."""
    sent = []

    def fake_deliver(db, clinic, channel, target, code):
        sent.append({"channel": channel, "target": target, "code": code})
        return None  # no error: both channels "worked"

    monkeypatch.setattr(sec, "_deliver_otp", fake_deliver)
    return sent


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        bind=engine,
        tables=[Clinic.__table__, OtpVerification.__table__, NotificationLog.__table__],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def clinic(db):
    c = Clinic(name="Test Dental", created_at=datetime.utcnow())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def owner(clinic):
    return _Owner(clinic.id)


def send(db, owner, phone=PHONE, email=EMAIL):
    return sec.send_signup_otp(
        sec.SignupOtpSend(phone=phone, email=email), db=db, current_user=owner
    )


def verify(db, owner, code):
    return sec.verify_signup_otp(
        sec.SignupOtpVerify(code=code), db=db, current_user=owner
    )


def age_rows(db, seconds):
    """Push every existing row back in time, so a resend clears the cooldown."""
    for row in db.query(OtpVerification).all():
        row.created_at = row.created_at - timedelta(seconds=seconds)
    db.commit()


def resend(db, owner, **kw):
    age_rows(db, sec.RESEND_COOLDOWN_SEC + 1)
    return send(db, owner, **kw)


# ── The incident ─────────────────────────────────────────────────────────────

def test_a_code_from_two_resends_ago_still_works(db, owner, clinic, outbox):
    """The bug that cost a customer. Resending must not kill what came before."""
    send(db, owner)
    first = outbox[0]["code"]
    resend(db, owner)
    resend(db, owner)

    codes = {row["code"] for row in outbox}
    assert len(codes) == 3, "each send should mint its own code"

    assert verify(db, owner, first)["verified"] is True
    assert clinic.security_phone_verified and clinic.security_email_verified


def test_the_middle_code_works_too(db, owner, outbox):
    send(db, owner)
    resend(db, owner)
    middle = outbox[2]["code"]
    resend(db, owner)

    assert verify(db, owner, middle)["verified"] is True


def test_the_newest_code_still_works(db, owner, outbox):
    send(db, owner)
    resend(db, owner)
    assert verify(db, owner, outbox[-1]["code"])["verified"] is True


def test_only_the_newest_generations_stay_live(db, owner, outbox):
    """Forgiving, not unbounded: codes past the window are retired."""
    send(db, owner)
    oldest = outbox[0]["code"]
    for _ in range(sec.SIGNUP_ACTIVE_CODES):
        resend(db, owner)

    live = db.query(OtpVerification).filter(OtpVerification.consumed == False).count()
    assert live == sec.SIGNUP_ACTIVE_CODES * 2, "two rows per generation, one per channel"

    with pytest.raises(HTTPException) as e:
        verify(db, owner, oldest)
    assert e.value.status_code == 400


# ── Rate limiting ────────────────────────────────────────────────────────────

def test_an_immediate_resend_is_refused_with_a_wait(db, owner, outbox):
    send(db, owner)
    with pytest.raises(HTTPException) as e:
        send(db, owner)

    assert e.value.status_code == 429
    wait = int(e.value.headers["X-Retry-After-Seconds"])
    assert 0 < wait <= sec.RESEND_COOLDOWN_SEC
    assert e.value.headers["Retry-After"] == str(wait)
    assert len(outbox) == 2, "the refused send must not have messaged anyone"


def test_resending_is_allowed_once_the_cooldown_passes(db, owner, outbox):
    send(db, owner)
    age_rows(db, sec.RESEND_COOLDOWN_SEC + 1)
    send(db, owner)
    assert len(outbox) == 4


def test_correcting_a_typo_skips_the_cooldown(db, owner, outbox):
    """Someone fixing their own number should not be made to wait for it."""
    send(db, owner)
    send(db, owner, phone="+919999999999")
    assert len(outbox) == 4


def test_a_runaway_client_cannot_exceed_the_hourly_ceiling(db, owner, outbox):
    """The limit that bounds a re-send-on-mount loop, and its WhatsApp bill."""
    for _ in range(sec.SIGNUP_MAX_SENDS_PER_HOUR):
        resend(db, owner)

    with pytest.raises(HTTPException) as e:
        resend(db, owner)
    assert e.value.status_code == 429
    assert len(outbox) // 2 == sec.SIGNUP_MAX_SENDS_PER_HOUR


# ── Attempts ─────────────────────────────────────────────────────────────────

def test_the_real_code_survives_a_run_of_mistypes(db, owner, outbox):
    good = send(db, owner) and outbox[0]["code"]
    wrong = "000000" if good != "000000" else "111111"

    for _ in range(sec.SIGNUP_MAX_ATTEMPTS - 1):
        with pytest.raises(HTTPException):
            verify(db, owner, wrong)

    assert verify(db, owner, good)["verified"] is True


def test_the_attempt_budget_ends_in_a_429_not_a_silent_dead_end(db, owner, outbox):
    send(db, owner)
    statuses = []
    for _ in range(sec.SIGNUP_MAX_ATTEMPTS + 1):
        with pytest.raises(HTTPException) as e:
            verify(db, owner, "000000")
        statuses.append(e.value.status_code)

    assert statuses[-1] == 429
    assert set(statuses[:-1]) == {400}


# ── Saying the right thing ───────────────────────────────────────────────────

def test_an_expired_code_says_expired(db, owner, outbox):
    """Distinct from "no active code": one means wait, the other means resend."""
    send(db, owner)
    for row in db.query(OtpVerification).all():
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.commit()

    with pytest.raises(HTTPException) as e:
        verify(db, owner, outbox[0]["code"])
    assert "expired" in e.value.detail.lower()


def test_verifying_before_anything_was_sent_says_so(db, owner):
    with pytest.raises(HTTPException) as e:
        verify(db, owner, "123456")
    assert "no active code" in e.value.detail.lower()


def test_the_response_carries_the_cooldown_and_the_ttl(db, owner):
    res = send(db, owner)
    assert res["resend_in"] == sec.RESEND_COOLDOWN_SEC
    assert res["expires_in"] == sec.OTP_TTL_MIN * 60


# ── Idempotency ──────────────────────────────────────────────────────────────

def test_verifying_twice_succeeds_twice(db, owner, outbox):
    """A verify whose response was lost must not look like a failure on retry."""
    send(db, owner)
    code = outbox[0]["code"]
    assert verify(db, owner, code)["verified"] is True

    again = verify(db, owner, code)
    assert again["verified"] is True
    assert again["already_verified"] is True


def test_sending_to_a_verified_clinic_messages_nobody(db, owner, outbox):
    send(db, owner)
    verify(db, owner, outbox[0]["code"])

    before = len(outbox)
    res = send(db, owner)
    assert res["already_verified"] is True
    assert len(outbox) == before


# ── Changed contacts ─────────────────────────────────────────────────────────

def test_correcting_a_number_voids_the_whole_old_generation(db, owner, outbox):
    """Including its email twin, which would otherwise keep the code alive."""
    send(db, owner, phone="+919111111111")
    stale = outbox[0]["code"]
    send(db, owner, phone="+919222222222")

    with pytest.raises(HTTPException) as e:
        verify(db, owner, stale)
    assert e.value.status_code == 400

    assert verify(db, owner, outbox[-1]["code"])["verified"] is True
