"""Signing a phone in by scanning a QR on the web.

What these pin: a code signs the phone in once, briefly, with the same checks
and the same session a password login gives; nobody can show a code for an
account they could not manage; and the screen that showed it can see which
phone used it and cut that phone off.
"""
import datetime

import pytest

from core.login_throttle import throttle
from models import AuditLog, PhoneLoginCode, User, UserDevice

CODE = "test-code-" + "x" * 33
QR_TEXT = "molarplus://login?code=" + CODE
PHONE = {"device_name": "Redmi Note 12", "device_type": "mobile", "device_platform": "Android"}


@pytest.fixture(autouse=True)
def _known_code_and_clean_throttle(monkeypatch):
    """The QR only carries the code as an image, so tests pin the code instead
    of decoding a picture. And the throttle is process-wide state."""
    import domains.auth.routes.phone_login as pl
    monkeypatch.setattr(pl.secrets, "token_urlsafe", lambda n=32: CODE)
    throttle.reset()
    yield
    throttle.reset()


def _headers_for(user):
    from domains.auth.services.auth_service import AuthService
    return {"Authorization": f"Bearer {AuthService(None, None, None).create_jwt_token(user.id)}"}


def _user(db, clinic, role="receptionist", email="rec@example.com", permissions=None, active=True):
    u = User(
        clinic_id=clinic.id, email=email, name=f"{role.title()} Person", role=role,
        first_name=role.title(), last_name="Person",
        is_active=active, permissions=permissions or {},
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _issue(client, headers, user_id=None):
    return client.post("/api/v1/auth/phone-login/code", json={"user_id": user_id}, headers=headers)


def _redeem(client, text=QR_TEXT, device=PHONE):
    return client.post("/api/v1/auth/phone-login/redeem", json={"code": text, "device": device})


# ── the happy path ─────────────────────────────────────────────────────────

def test_showing_a_code_returns_a_qr_that_lasts_two_minutes(client, auth_headers):
    r = _issue(client, auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["qr"].startswith("data:image/svg+xml;base64,")
    assert body["expires_in"] == 120
    assert "code" not in body   # only ever inside the picture


def test_scanning_signs_the_phone_in_as_that_person(client, auth_headers, test_user):
    code_id = _issue(client, auth_headers).json()["id"]
    r = _redeem(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token"]
    assert body["user"]["id"] == test_user.id
    # The same session a password login gives: it opens /auth/me.
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200, me.text

    s = client.get(f"/api/v1/auth/phone-login/code/{code_id}", headers=auth_headers).json()
    assert s["status"] == "used"
    assert s["device_name"] == "Redmi Note 12"
    assert s["blocked"] is False


def test_the_bare_code_works_as_well_as_the_whole_qr_text(client, auth_headers):
    _issue(client, auth_headers)
    assert _redeem(client, text=CODE).status_code == 200


def test_the_sign_in_is_audited(client, auth_headers, db_session, test_user):
    _issue(client, auth_headers)
    _redeem(client)
    row = db_session.query(AuditLog).filter(AuditLog.user_id == test_user.id).order_by(AuditLog.id.desc()).first()
    assert "with a QR code" in row.summary
    assert "Redmi Note 12" in row.summary


# ── once, and briefly ──────────────────────────────────────────────────────

def test_a_code_works_once(client, auth_headers):
    _issue(client, auth_headers)
    assert _redeem(client).status_code == 200
    again = _redeem(client)
    assert again.status_code == 400
    assert "already been used" in again.json()["detail"]


def test_an_expired_code_is_refused(client, auth_headers, db_session):
    code_id = _issue(client, auth_headers).json()["id"]
    row = db_session.query(PhoneLoginCode).get(code_id)
    row.expires_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
    db_session.commit()
    r = _redeem(client)
    assert r.status_code == 400
    assert "expired" in r.json()["detail"]
    assert client.get(f"/api/v1/auth/phone-login/code/{code_id}", headers=auth_headers).json()["status"] == "expired"


def test_showing_a_new_code_retires_the_last(client, auth_headers, db_session, monkeypatch):
    import domains.auth.routes.phone_login as pl
    first = _issue(client, auth_headers).json()["id"]
    monkeypatch.setattr(pl.secrets, "token_urlsafe", lambda n=32: CODE + "2")
    _issue(client, auth_headers)
    old = db_session.query(PhoneLoginCode).get(first)
    db_session.refresh(old)
    assert old.expires_at <= datetime.datetime.utcnow()
    assert _redeem(client).status_code == 400          # the first code
    assert _redeem(client, text=QR_TEXT + "2").status_code == 200


def test_a_made_up_code_is_refused(client):
    r = _redeem(client, text="molarplus://login?code=nothing-like-a-real-one")
    assert r.status_code == 400
    assert "isn't valid" in r.json()["detail"]


# ── who can show a code for whom ───────────────────────────────────────────

def test_the_owner_can_set_up_a_staff_phone(client, auth_headers, db_session, test_clinic, test_user):
    rec = _user(db_session, test_clinic)
    r = _issue(client, auth_headers, rec.id)
    assert r.status_code == 200, r.text
    assert r.json()["for_name"] == rec.name
    body = _redeem(client).json()
    assert body["user"]["id"] == rec.id
    issued = db_session.query(AuditLog).filter(AuditLog.action == "auth.phone_login_issued").first()
    assert issued is not None and rec.name in issued.summary
    signed_in = db_session.query(AuditLog).filter(AuditLog.user_id == rec.id).order_by(AuditLog.id.desc()).first()
    assert f"shown by {test_user.name}" in signed_in.summary


def test_without_staff_rights_you_can_only_do_your_own(client, db_session, test_clinic, test_user):
    rec = _user(db_session, test_clinic)
    other = _user(db_session, test_clinic, email="other@example.com")
    assert _issue(client, _headers_for(rec)).status_code == 200            # yourself: fine
    r = _issue(client, _headers_for(rec), other.id)
    assert r.status_code == 403


def test_a_manager_can_never_show_a_code_for_the_owner(client, db_session, test_clinic, test_user):
    manager = _user(db_session, test_clinic, role="receptionist", email="mgr@example.com",
                    permissions={"users": {"view": True, "edit": True}})
    r = _issue(client, _headers_for(manager), test_user.id)
    assert r.status_code == 403
    assert "Owner" in r.json()["detail"] or "owner" in r.json()["detail"]


def test_not_even_an_owner_for_another_owner(client, auth_headers, db_session, test_clinic):
    co_owner = _user(db_session, test_clinic, role="clinic_owner", email="co@example.com")
    assert _issue(client, auth_headers, co_owner.id).status_code == 403


def test_another_clinics_staff_are_not_found(client, auth_headers, db_session):
    from models import Clinic
    elsewhere = Clinic(name="Elsewhere")
    db_session.add(elsewhere)
    db_session.commit()
    stranger = _user(db_session, elsewhere, email="far@example.com")
    assert _issue(client, auth_headers, stranger.id).status_code == 404


def test_a_deactivated_account_gets_no_code(client, auth_headers, db_session, test_clinic):
    gone = _user(db_session, test_clinic, email="gone@example.com", active=False)
    r = _issue(client, auth_headers, gone.id)
    assert r.status_code == 400


def test_deactivated_between_showing_and_scanning(client, auth_headers, db_session, test_clinic):
    rec = _user(db_session, test_clinic)
    _issue(client, auth_headers, rec.id)
    rec.is_active = False
    db_session.commit()
    r = _redeem(client)
    assert r.status_code == 403
    assert "deactivated" in r.json()["detail"]


def test_only_the_person_who_showed_it_can_see_its_status(client, auth_headers, db_session, test_clinic):
    code_id = _issue(client, auth_headers).json()["id"]
    rec = _user(db_session, test_clinic)
    assert client.get(f"/api/v1/auth/phone-login/code/{code_id}", headers=_headers_for(rec)).status_code == 404


# ── "Not them?" ────────────────────────────────────────────────────────────

def test_blocking_signs_that_phone_out_at_once(client, auth_headers, db_session):
    code_id = _issue(client, auth_headers).json()["id"]
    token = _redeem(client).json()["token"]
    phone = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=phone).status_code == 200

    r = client.post(f"/api/v1/auth/phone-login/code/{code_id}/block", headers=auth_headers)
    assert r.status_code == 200, r.text
    out = client.get("/api/v1/auth/me", headers=phone)
    assert out.status_code == 401
    assert "blocked" in out.json()["detail"]
    assert client.get(f"/api/v1/auth/phone-login/code/{code_id}", headers=auth_headers).json()["blocked"] is True
    device = db_session.query(UserDevice).filter(UserDevice.device_name == "Redmi Note 12").first()
    assert device is not None and device.is_active is False


def test_a_blocked_phone_cannot_scan_back_in(client, auth_headers, monkeypatch):
    import domains.auth.routes.phone_login as pl
    code_id = _issue(client, auth_headers).json()["id"]
    _redeem(client)
    client.post(f"/api/v1/auth/phone-login/code/{code_id}/block", headers=auth_headers)
    monkeypatch.setattr(pl.secrets, "token_urlsafe", lambda n=32: CODE + "3")
    _issue(client, auth_headers)
    assert _redeem(client, text=QR_TEXT + "3").status_code == 403


def test_nothing_to_block_before_a_scan(client, auth_headers):
    code_id = _issue(client, auth_headers).json()["id"]
    assert client.post(f"/api/v1/auth/phone-login/code/{code_id}/block", headers=auth_headers).status_code == 404
