"""Integration tests for notification_admin.py (previously zero coverage).

Same shadowed get_db() bug as invoices.py/wareach.py, fixed alongside these
tests. Also found PATCH /logs/{log_id}: documented as "no auth required —
only reachable from the private network", but config/nginx.conf only
proxies /api/v1/consent/ to nexus; everything else, this route included,
falls through to backend's own `location /` and is reachable from the
public internet. Anyone who found the URL could rewrite any clinic's
notification log by id. Fixed the same way consents_internal.py guards its
own internal endpoint — a shared-secret header, fail closed if unset — and
updated nexus-service's callback to actually send it (it sent nothing
before). test_update_log_* below are the regression tests.
"""
import pytest


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/notification-admin/channel-status"),
    ("get", "/api/v1/notification-admin/preferences"),
    ("put", "/api/v1/notification-admin/preferences"),
    ("get", "/api/v1/notification-admin/logs"),
    ("get", "/api/v1/notification-admin/wallet"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {"preferences": []}} if method == "put" else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code}"


def test_preferences_are_seeded_with_defaults_on_first_read(client, auth_headers):
    r = client.get("/api/v1/notification-admin/preferences", headers=auth_headers)
    assert r.status_code == 200
    types = {p["event_type"] for p in r.json()}
    assert "invoice_notification" in types
    assert "appointment_booked" in types
    # daily_report is hidden from the preferences UI on purpose
    assert "daily_report" not in types


def test_lab_order_placed_defaults_to_disabled(client, auth_headers):
    """A cost decision the clinic must opt into — see _SEED_OVERRIDES."""
    r = client.get("/api/v1/notification-admin/preferences", headers=auth_headers)
    lab = next(p for p in r.json() if p["event_type"] == "lab_order_placed")
    assert lab["is_enabled"] is False


def test_update_preferences_persists(client, auth_headers):
    client.get("/api/v1/notification-admin/preferences", headers=auth_headers)  # seed first

    r = client.put(
        "/api/v1/notification-admin/preferences",
        json={"preferences": [{"event_type": "invoice_notification", "channels": ["email"], "is_enabled": False}]},
        headers=auth_headers,
    )
    assert r.status_code == 200

    prefs = client.get("/api/v1/notification-admin/preferences", headers=auth_headers).json()
    updated = next(p for p in prefs if p["event_type"] == "invoice_notification")
    assert updated["channels"] == ["email"]
    assert updated["is_enabled"] is False


def test_wallet_starts_at_zero_with_no_transactions(client, auth_headers):
    r = client.get("/api/v1/notification-admin/wallet", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["balance"] == 0
    assert data["transactions"] == []


def test_logs_list_is_scoped_to_the_caller_clinic(client, auth_headers, db_session, test_clinic):
    from models import NotificationLog, Clinic

    other = Clinic(name="Other Clinic 3", address="x", phone="4", email="other4@clinic.com",
                    specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    db_session.add(NotificationLog(clinic_id=test_clinic.id, channel="whatsapp", recipient="+1", event_type="invoice_notification", status="sent"))
    db_session.add(NotificationLog(clinic_id=other.id, channel="whatsapp", recipient="+2", event_type="invoice_notification", status="sent"))
    db_session.commit()

    r = client.get("/api/v1/notification-admin/logs", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert len(body["logs"]) == 1
    assert body["logs"][0]["recipient"] == "+1"


# ── PATCH /logs/{id}: the internal-auth regression ─────────────────────────

def test_update_log_fails_closed_when_internal_key_not_configured(client, db_session, test_clinic, monkeypatch):
    from models import NotificationLog
    import domains.notification.routes.notification_admin as notification_admin

    log = NotificationLog(clinic_id=test_clinic.id, channel="whatsapp", recipient="+1",
                           event_type="invoice_notification", status="queued")
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)

    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    r = client.patch(f"/api/v1/notification-admin/logs/{log.id}", json={"status": "sent"})
    assert r.status_code == 503


def test_update_log_rejects_wrong_secret(client, db_session, test_clinic, monkeypatch):
    from models import NotificationLog

    log = NotificationLog(clinic_id=test_clinic.id, channel="whatsapp", recipient="+1",
                           event_type="invoice_notification", status="queued")
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)

    monkeypatch.setenv("INTERNAL_API_KEY", "the-real-secret")
    r = client.patch(
        f"/api/v1/notification-admin/logs/{log.id}",
        json={"status": "sent"},
        headers={"X-Internal-Auth": "wrong"},
    )
    assert r.status_code == 403


def test_update_log_succeeds_with_correct_secret(client, db_session, test_clinic, monkeypatch):
    from models import NotificationLog

    log = NotificationLog(clinic_id=test_clinic.id, channel="whatsapp", recipient="+1",
                           event_type="invoice_notification", status="queued")
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)

    monkeypatch.setenv("INTERNAL_API_KEY", "the-real-secret")
    r = client.patch(
        f"/api/v1/notification-admin/logs/{log.id}",
        json={"status": "sent", "provider_message_id": "msg91-req-123"},
        headers={"X-Internal-Auth": "the-real-secret"},
    )
    assert r.status_code == 200

    db_session.refresh(log)
    assert log.status == "sent"
    assert log.provider_message_id == "msg91-req-123"
