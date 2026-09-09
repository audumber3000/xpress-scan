"""Integration tests for the WA Reach domain (previously zero coverage).

wareach.py had the same shadowed-get_db() bug as invoices.py (fixed
alongside these tests). It also skipped signature verification entirely on
its unauthenticated /webhook when WAREACH_WEBHOOK_SECRET wasn't set — which
it never has been in any deploy config in this repo, so that endpoint was
live and open in prod. Now fails closed (503) instead; the tests below for
that are the regression coverage.
"""
import pytest
from domains.notification.routes import wareach


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/integrations/wareach/status"),
    ("post", "/api/v1/integrations/wareach/connect"),
    ("get", "/api/v1/integrations/wareach/qr"),
    ("post", "/api/v1/integrations/wareach/disconnect"),
])
def test_requires_auth(client, method, path):
    r = getattr(client, method)(path)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code}"


def test_status_for_a_fresh_clinic_is_disconnected(client, auth_headers):
    r = client.get("/api/v1/integrations/wareach/status", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["connected"] is False
    assert data["is_pro"] is True  # WA Reach is free for every clinic now


def test_connect_creates_a_session_and_returns_a_qr(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        wareach.wareach_service, "create_session",
        lambda clinic_id: {"session_id": "sess-123", "status": "connecting", "qr": "data:image/png;base64,fake"},
    )
    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "connecting"
    assert r.json()["qr"]

    status = client.get("/api/v1/integrations/wareach/status", headers=auth_headers)
    assert status.json()["status"] == "connecting"


def test_connect_failure_upstream_is_a_clean_502_not_a_crash(client, auth_headers, monkeypatch):
    def _boom(clinic_id):
        raise RuntimeError("WA Reach unreachable")
    monkeypatch.setattr(wareach.wareach_service, "create_session", _boom)

    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 502


def test_disconnect_resets_status(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        wareach.wareach_service, "create_session",
        lambda clinic_id: {"session_id": "sess-123", "status": "connected", "qr": None},
    )
    client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    monkeypatch.setattr(wareach.wareach_service, "delete_session", lambda session_id: None)

    r = client.post("/api/v1/integrations/wareach/disconnect", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "disconnected"


# ── Webhook: no user auth, only the shared secret ──────────────────────────

def test_webhook_fails_closed_when_secret_not_configured(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", "")
    r = client.post("/api/v1/integrations/wareach/webhook", json={"clinic_id": 1, "event": "connected"})
    assert r.status_code == 503


def test_webhook_rejects_wrong_signature(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", "the-real-secret")
    r = client.post(
        "/api/v1/integrations/wareach/webhook",
        json={"clinic_id": 1, "event": "connected"},
        headers={"X-WAReach-Secret": "wrong"},
    )
    assert r.status_code == 401


def test_webhook_updates_status_with_correct_signature(client, auth_headers, test_clinic, monkeypatch):
    # Ensure the integration row exists first.
    client.get("/api/v1/integrations/wareach/status", headers=auth_headers)

    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", "the-real-secret")
    r = client.post(
        "/api/v1/integrations/wareach/webhook",
        json={"clinic_id": test_clinic.id, "event": "connected", "phone_number": "+919876543210"},
        headers={"X-WAReach-Secret": "the-real-secret"},
    )
    assert r.status_code == 200

    status = client.get("/api/v1/integrations/wareach/status", headers=auth_headers)
    assert status.json()["status"] == "connected"
    assert status.json()["phone_number"] == "+919876543210"


def test_webhook_delivery_receipt_only_advances_status_never_downgrades(
    client, db_session, test_clinic, monkeypatch
):
    from models import NotificationLog

    log = NotificationLog(clinic_id=test_clinic.id, event_type="invoice_notification",
                           channel="whatsapp", recipient="+919876543210", status="delivered")
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)

    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", "the-real-secret")
    r = client.post(
        "/api/v1/integrations/wareach/webhook",
        json={"log_id": log.id, "message_status": "sent"},  # "sent" ranks below "delivered"
        headers={"X-WAReach-Secret": "the-real-secret"},
    )
    assert r.status_code == 200

    db_session.refresh(log)
    assert log.status == "delivered", "a lower-ranked receipt must not downgrade an already-delivered log"
