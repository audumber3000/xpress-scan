"""Own-number WhatsApp (WA Reach) — connection routes, webhooks, routing, billing.

WA Reach's old /api/sessions contract was unauthenticated and has been removed
on its side. MolarPlus now provisions a workspace per clinic through WA Reach's
partner API, sends through nexus with the workspace key, and hears back through
HMAC-signed webhooks. These tests pin every piece of that on this side:

  * the connect flow (provision once, re-provision when WA Reach lost it)
  * the webhook (signature, replay window, cross-clinic isolation, receipts
    that only move forward)
  * routing: a connected clinic goes through its number, everyone else hits
    the unchanged MSG91 path
  * the MSG91 fallback is charged exactly once, and takes the number offline
"""
import json
import time

import pytest

from domains.notification.routes import wareach
from domains.notification.services import wareach_service
from domains.notification.services.wareach_service import WAReachError, WorkspaceGone

SECRET = "the-real-secret"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(wareach_service, "WAREACH_URL", "http://wareach.test:3000")
    monkeypatch.setattr(wareach_service, "WAREACH_PARTNER_KEY", "partner-key")
    monkeypatch.setattr(wareach_service, "WAREACH_MOCK", False)


@pytest.fixture
def fake_wareach(monkeypatch, configured):
    """A stand-in partner API that records what MolarPlus asked for."""
    calls = {"provision": 0, "connect": [], "status": [], "disconnect": []}
    state = {"remote": {"status": "connecting", "qr": "data:image/png;base64,QR", "phone_number": None}}

    def provision(clinic):
        calls["provision"] += 1
        return {"workspace_id": f"ws-{clinic.id}-{calls['provision']}", "api_key": f"wr_key_{calls['provision']}",
                "status": "disconnected", "qr": ""}

    def connect(ws):
        calls["connect"].append(ws)
        return dict(state["remote"])

    def fetch_status(ws):
        calls["status"].append(ws)
        return dict(state["remote"])

    def disconnect(ws):
        calls["disconnect"].append(ws)
        return {"status": "disconnected"}

    monkeypatch.setattr(wareach_service, "provision", provision)
    monkeypatch.setattr(wareach_service, "connect", connect)
    monkeypatch.setattr(wareach_service, "fetch_status", fetch_status)
    monkeypatch.setattr(wareach_service, "disconnect", disconnect)
    return calls, state


def _row(db_session, clinic_id):
    from models import WhatsAppIntegration
    db_session.expire_all()
    return db_session.query(WhatsAppIntegration).filter(WhatsAppIntegration.clinic_id == clinic_id).first()


def _connected_row(db_session, clinic, workspace="ws-live", phone="919812345678"):
    from models import WhatsAppIntegration
    row = WhatsAppIntegration(
        clinic_id=clinic.id, provider="wareach", status="connected", session_id=workspace,
        api_key_enc=wareach_service.encrypt_key("wr_live_key"), phone_number=phone,
    )
    db_session.add(row)
    db_session.commit()
    return row


def _signed(payload: dict, secret=SECRET, ts=None):
    body = json.dumps(payload).encode()
    ts = str(int(time.time()) if ts is None else ts)
    return body, {
        "Content-Type": "application/json",
        "X-WAReach-Timestamp": ts,
        "X-WAReach-Signature": wareach_service.sign(secret, ts, body),
    }


# ── Connection routes ─────────────────────────────────────────────────────────

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


def test_connect_is_unavailable_when_wareach_is_not_configured(client, auth_headers, monkeypatch):
    monkeypatch.setattr(wareach_service, "WAREACH_URL", "")
    monkeypatch.setattr(wareach_service, "WAREACH_MOCK", False)
    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 503


def test_connect_provisions_a_workspace_and_returns_a_qr(client, auth_headers, test_clinic, db_session, fake_wareach):
    calls, _ = fake_wareach
    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == {"status": "connecting", "qr": "data:image/png;base64,QR"}

    row = _row(db_session, test_clinic.id)
    assert row.session_id == f"ws-{test_clinic.id}-1"
    assert row.api_key_enc and "wr_key_1" not in row.api_key_enc, "the key is stored encrypted"
    assert wareach_service.decrypt_key(row.api_key_enc) == "wr_key_1"
    assert calls["connect"] == [row.session_id]


def test_connect_again_reuses_the_workspace(client, auth_headers, fake_wareach):
    calls, _ = fake_wareach
    client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert calls["provision"] == 1


def test_connect_reprovisions_when_wareach_lost_the_workspace(client, auth_headers, test_clinic, db_session, fake_wareach, monkeypatch):
    calls, state = fake_wareach
    client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)

    seen = []

    def connect(ws):
        seen.append(ws)
        if len(seen) == 1:
            raise WorkspaceGone(404, "Workspace not found")
        return dict(state["remote"])

    monkeypatch.setattr(wareach_service, "connect", connect)
    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 200
    assert calls["provision"] == 2
    assert _row(db_session, test_clinic.id).session_id == f"ws-{test_clinic.id}-2"


def test_connect_failure_upstream_is_a_clean_502_not_a_crash(client, auth_headers, configured, monkeypatch):
    def _boom(clinic):
        raise WAReachError(0, "ConnectError")
    monkeypatch.setattr(wareach_service, "provision", _boom)

    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 502


def test_qr_poll_picks_up_the_connection(client, auth_headers, test_clinic, db_session, fake_wareach):
    _, state = fake_wareach
    client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    state["remote"] = {"status": "connected", "qr": "", "phone_number": "919812345678"}

    r = client.get("/api/v1/integrations/wareach/qr", headers=auth_headers)
    assert r.json() == {"status": "connected", "qr": ""}
    status = client.get("/api/v1/integrations/wareach/status", headers=auth_headers).json()
    assert status["connected"] is True
    assert status["phone_number"] == "919812345678"


def test_stale_status_is_refreshed_from_wareach(client, auth_headers, test_clinic, db_session, fake_wareach):
    import datetime
    calls, state = fake_wareach
    row = _connected_row(db_session, test_clinic)
    row.last_status_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    db_session.commit()
    state["remote"] = {"status": "disconnected", "qr": "", "phone_number": None}

    r = client.get("/api/v1/integrations/wareach/status", headers=auth_headers)
    assert r.json()["status"] == "disconnected"
    assert calls["status"] == ["ws-live"]


def test_fresh_status_is_served_from_cache(client, auth_headers, test_clinic, db_session, fake_wareach):
    import datetime
    calls, _ = fake_wareach
    row = _connected_row(db_session, test_clinic)
    row.last_status_at = datetime.datetime.utcnow()
    db_session.commit()
    client.get("/api/v1/integrations/wareach/status", headers=auth_headers)
    assert calls["status"] == []


def test_disconnect_unlinks_on_wareach_and_resets_status(client, auth_headers, test_clinic, db_session, fake_wareach):
    calls, _ = fake_wareach
    _connected_row(db_session, test_clinic)
    r = client.post("/api/v1/integrations/wareach/disconnect", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "disconnected"
    assert calls["disconnect"] == ["ws-live"]
    assert _row(db_session, test_clinic.id).status == "disconnected"


def test_disconnect_does_not_pretend_when_wareach_is_unreachable(client, auth_headers, test_clinic, db_session, configured, monkeypatch):
    _connected_row(db_session, test_clinic)

    def _down(ws):
        raise WAReachError(0, "ConnectError")
    monkeypatch.setattr(wareach_service, "disconnect", _down)

    r = client.post("/api/v1/integrations/wareach/disconnect", headers=auth_headers)
    assert r.status_code == 502
    assert _row(db_session, test_clinic.id).status == "connected", "the phone is still linked on WA Reach"


# ── Webhook: no user auth, only the HMAC signature ────────────────────────────

def test_webhook_fails_closed_when_secret_not_configured(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", "")
    body, headers = _signed({"event": "session.connected", "org_id": "x"})
    r = client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers)
    assert r.status_code == 503


def test_webhook_rejects_wrong_signature(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    body, headers = _signed({"event": "session.connected", "org_id": "x"}, secret="not-the-secret")
    r = client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers)
    assert r.status_code == 401


def test_webhook_rejects_the_old_shared_secret_header(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    r = client.post(
        "/api/v1/integrations/wareach/webhook",
        json={"clinic_id": 1, "event": "connected"},
        headers={"X-WAReach-Secret": SECRET},
    )
    assert r.status_code == 401


def test_webhook_rejects_a_replayed_delivery(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    body, headers = _signed({"event": "session.connected", "org_id": "x"}, ts=int(time.time()) - 3600)
    r = client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers)
    assert r.status_code == 401


def test_webhook_rejects_a_tampered_body(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    body, headers = _signed({"event": "session.disconnected", "org_id": "ws-live"})
    tampered = body.replace(b"disconnected", b"connected")
    r = client.post("/api/v1/integrations/wareach/webhook", content=tampered, headers=headers)
    assert r.status_code == 401


def test_webhook_session_events_move_the_connection(client, test_clinic, db_session, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    _connected_row(db_session, test_clinic, phone=None)

    body, headers = _signed({"event": "session.disconnected", "org_id": "ws-live",
                             "data": {"status": "disconnected", "phone_number": None}})
    assert client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers).status_code == 200
    assert _row(db_session, test_clinic.id).status == "disconnected"

    body, headers = _signed({"event": "session.connected", "org_id": "ws-live",
                             "data": {"status": "connected", "phone_number": "919812345678"}})
    assert client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers).status_code == 200
    row = _row(db_session, test_clinic.id)
    assert row.status == "connected"
    assert row.phone_number == "919812345678"


def test_webhook_for_an_unknown_workspace_is_acknowledged_and_ignored(client, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    body, headers = _signed({"event": "session.connected", "org_id": "never-provisioned"})
    r = client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers)
    assert r.status_code == 200
    assert r.json()["ignored"] == "unknown workspace"


def _log(db_session, clinic_id, status, provider="wareach"):
    from models import NotificationLog
    log = NotificationLog(clinic_id=clinic_id, event_type="invoice_notification", channel="whatsapp",
                          recipient="919876543210", status=status, provider=provider, cost=0.0)
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    return log


def _receipt(client, log_id, event, workspace="ws-live"):
    body, headers = _signed({"event": event, "org_id": workspace,
                             "data": {"reference": str(log_id), "status": event.split(".")[1]}})
    return client.post("/api/v1/integrations/wareach/webhook", content=body, headers=headers)


def test_receipts_move_forward_only(client, test_clinic, db_session, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    _connected_row(db_session, test_clinic)
    log = _log(db_session, test_clinic.id, "sent")

    _receipt(client, log.id, "message.read")
    db_session.refresh(log)
    assert log.status == "read"

    _receipt(client, log.id, "message.delivered")
    db_session.refresh(log)
    assert log.status == "read", "a late 'delivered' must not walk back 'read'"

    _receipt(client, log.id, "message.failed")
    db_session.refresh(log)
    assert log.status == "read", "a delivered message cannot un-deliver"


def test_a_timed_out_send_is_healed_by_its_receipt(client, test_clinic, db_session, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    _connected_row(db_session, test_clinic)
    log = _log(db_session, test_clinic.id, "failed")
    _receipt(client, log.id, "message.delivered")
    db_session.refresh(log)
    assert log.status == "delivered"


def test_a_receipt_cannot_touch_another_clinics_log(client, test_clinic, db_session, monkeypatch):
    from models import Clinic
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    _connected_row(db_session, test_clinic)
    other = Clinic(name="Other Clinic", address="x", phone="1", email="o@x.com", specialization="dental")
    db_session.add(other)
    db_session.commit()
    foreign = _log(db_session, other.id, "sent")

    r = _receipt(client, foreign.id, "message.read")
    assert r.status_code == 200
    db_session.refresh(foreign)
    assert foreign.status == "sent"


def test_receipts_never_touch_msg91_logs(client, test_clinic, db_session, monkeypatch):
    monkeypatch.setattr(wareach, "WEBHOOK_SECRET", SECRET)
    _connected_row(db_session, test_clinic)
    log = _log(db_session, test_clinic.id, "sent", provider="msg91")
    _receipt(client, log.id, "message.read")
    db_session.refresh(log)
    assert log.status == "sent"


# ── Routing in notify_event ───────────────────────────────────────────────────

def _pref(db_session, clinic_id, event_type="appointment_booked"):
    from models import NotificationPreference
    db_session.add(NotificationPreference(clinic_id=clinic_id, event_type=event_type,
                                          channels=["whatsapp"], is_enabled=True))
    db_session.commit()


def _wallet(db_session, clinic_id, balance):
    from models import NotificationWallet
    from core import wallet_service
    w = wallet_service.get_or_create_wallet(db_session, clinic_id)
    w.balance = balance
    db_session.commit()
    return w


@pytest.fixture
def captured_notify(monkeypatch):
    sent = []

    def _notify(event_type, **kwargs):
        sent.append({"event_type": event_type, **kwargs})

    monkeypatch.setattr("core.notification_dispatch.notify", _notify)
    monkeypatch.setattr("core.nexus_notify.notify", _notify)
    monkeypatch.setattr("core.posthog_client.track_event", lambda *a, **k: None)
    return sent


APPT_DATA = {"patient_name": "Asha", "clinic_name": "Test Clinic", "appointment_date": "25 Sep 2026",
             "appointment_time": "10:30 AM", "clinic_phone": "1234567890"}


def test_connected_clinic_sends_from_its_own_number_for_free(db_session, test_clinic, configured, captured_notify):
    from core.notification_dispatch import notify_event
    from models import NotificationLog
    _pref(db_session, test_clinic.id)
    _wallet(db_session, test_clinic.id, 5.0)
    _connected_row(db_session, test_clinic)

    notify_event("appointment_booked", db_session, test_clinic.id, to_phone="9876543210", template_data=dict(APPT_DATA))

    assert len(captured_notify) == 1
    call = captured_notify[0]
    assert call["provider"] == "wareach"
    assert call["wareach_api_key"] == "wr_live_key"
    assert call["allow_fallback"] is True
    log = db_session.query(NotificationLog).filter(NotificationLog.id == call["log_id"]).first()
    assert log.provider == "wareach"
    assert log.cost == 0.0
    assert _wallet(db_session, test_clinic.id, 5.0).balance == 5.0


def test_empty_wallet_still_sends_from_own_number_but_without_a_fallback(db_session, test_clinic, configured, captured_notify):
    from core.notification_dispatch import notify_event
    _pref(db_session, test_clinic.id)
    _wallet(db_session, test_clinic.id, 0.0)
    _connected_row(db_session, test_clinic)

    notify_event("appointment_booked", db_session, test_clinic.id, to_phone="9876543210", template_data=dict(APPT_DATA))

    assert captured_notify[0]["provider"] == "wareach"
    assert captured_notify[0]["allow_fallback"] is False


def test_clinic_without_a_connected_number_hits_the_unchanged_msg91_path(db_session, test_clinic, configured, captured_notify):
    from core.notification_dispatch import notify_event
    _pref(db_session, test_clinic.id)
    _wallet(db_session, test_clinic.id, 5.0)

    notify_event("appointment_booked", db_session, test_clinic.id, to_phone="9876543210", template_data=dict(APPT_DATA))

    assert len(captured_notify) == 1
    call = captured_notify[0]
    assert "provider" not in call and "wareach_api_key" not in call and "allow_fallback" not in call
    assert call["channel"] == "whatsapp"


def test_connected_row_is_ignored_when_wareach_is_not_configured(db_session, test_clinic, monkeypatch, captured_notify):
    from core.notification_dispatch import notify_event
    monkeypatch.setattr(wareach_service, "WAREACH_URL", "")
    monkeypatch.setattr(wareach_service, "WAREACH_MOCK", False)
    _pref(db_session, test_clinic.id)
    _wallet(db_session, test_clinic.id, 5.0)
    _connected_row(db_session, test_clinic)

    notify_event("appointment_booked", db_session, test_clinic.id, to_phone="9876543210", template_data=dict(APPT_DATA))
    assert "provider" not in captured_notify[0]


def test_unreadable_key_routes_to_msg91(db_session, test_clinic, configured, captured_notify):
    from core.notification_dispatch import notify_event
    _pref(db_session, test_clinic.id)
    _wallet(db_session, test_clinic.id, 5.0)
    row = _connected_row(db_session, test_clinic)
    row.api_key_enc = "not-a-fernet-token"
    db_session.commit()

    notify_event("appointment_booked", db_session, test_clinic.id, to_phone="9876543210", template_data=dict(APPT_DATA))
    assert "provider" not in captured_notify[0]


# ── Nexus callback: fallback billing and taking the number offline ───────────

@pytest.fixture
def internal_auth(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "internal-test-key")
    return {"X-Internal-Auth": "internal-test-key"}


def test_msg91_fallback_is_charged_once_and_takes_the_number_offline(client, db_session, test_clinic, configured, internal_auth):
    from core import wallet_service
    _connected_row(db_session, test_clinic)
    _wallet(db_session, test_clinic.id, 5.0)
    log = _log(db_session, test_clinic.id, "queued")
    body = {"status": "sent", "provider_message_id": "msg91-req", "error_message": "sent via MSG91 because: WA Reach 409",
            "provider": "msg91", "fallback": True, "wareach_offline": True}

    for _ in range(2):  # a repeated callback must not charge twice
        r = client.patch(f"/api/v1/notification-admin/logs/{log.id}", json=body, headers=internal_auth)
        assert r.status_code == 200

    db_session.expire_all()
    db_session.refresh(log)
    cost = wallet_service.get_cost("whatsapp", "invoice_notification")
    assert log.provider == "msg91"
    assert log.cost == cost
    assert log.status == "sent"
    assert round(wallet_service.get_or_create_wallet(db_session, test_clinic.id).balance, 4) == round(5.0 - cost, 4)
    assert _row(db_session, test_clinic.id).status == "disconnected"


def test_own_number_success_is_free_and_keeps_the_connection(client, db_session, test_clinic, configured, internal_auth):
    _connected_row(db_session, test_clinic)
    _wallet(db_session, test_clinic.id, 5.0)
    log = _log(db_session, test_clinic.id, "sent")
    r = client.patch(f"/api/v1/notification-admin/logs/{log.id}", headers=internal_auth, json={
        "status": "sent", "provider_message_id": "WAMID1", "provider": "wareach",
        "fallback": False, "wareach_offline": False,
    })
    assert r.status_code == 200
    db_session.expire_all()
    db_session.refresh(log)
    assert (log.provider, log.cost, log.provider_message_id) == ("wareach", 0.0, "WAMID1")
    assert _row(db_session, test_clinic.id).status == "connected"


def test_rejected_key_is_dropped_so_the_workspace_is_rekeyed(client, db_session, test_clinic, configured, internal_auth):
    _connected_row(db_session, test_clinic)
    log = _log(db_session, test_clinic.id, "queued")
    client.patch(f"/api/v1/notification-admin/logs/{log.id}", headers=internal_auth, json={
        "status": "failed", "error_message": "WA Reach 401: Invalid API key", "provider": "wareach",
        "fallback": False, "wareach_offline": True, "wareach_key_rejected": True,
    })
    row = _row(db_session, test_clinic.id)
    assert row.status == "disconnected"
    assert row.api_key_enc is None
    assert row.session_id == "ws-live", "the workspace itself is kept"


def test_callback_never_walks_back_a_receipt(client, db_session, test_clinic, configured, internal_auth):
    _connected_row(db_session, test_clinic)
    log = _log(db_session, test_clinic.id, "delivered")
    client.patch(f"/api/v1/notification-admin/logs/{log.id}", headers=internal_auth,
                 json={"status": "sent", "provider": "wareach"})
    db_session.expire_all()
    db_session.refresh(log)
    assert log.status == "delivered"


def test_msg91_callback_behaviour_is_unchanged(client, db_session, test_clinic, internal_auth):
    log = _log(db_session, test_clinic.id, "sent", provider="msg91")
    client.patch(f"/api/v1/notification-admin/logs/{log.id}", headers=internal_auth,
                 json={"status": "failed", "error_message": "MSG91 API error"})
    db_session.expire_all()
    db_session.refresh(log)
    assert (log.status, log.error_message, log.provider) == ("failed", "MSG91 API error", "msg91")


# ── Signing helpers ───────────────────────────────────────────────────────────

def test_signature_matches_wareachs_format():
    # WA Reach: 'sha256=' + HMAC_SHA256(secret, `${timestamp}.${body}`).hex
    import hashlib
    import hmac as _hmac
    body = b'{"event":"session.connected"}'
    expected = "sha256=" + _hmac.new(b"s3cret", b"1700000000." + body, hashlib.sha256).hexdigest()
    assert wareach_service.sign("s3cret", "1700000000", body) == expected
    assert wareach_service.verify_signature("s3cret", "1700000000", body, expected, now=1700000100)
    assert not wareach_service.verify_signature("s3cret", "1700000000", body, expected, now=1700000000 + 301)
    assert not wareach_service.verify_signature("", "1700000000", body, expected, now=1700000000)
    assert not wareach_service.verify_signature("s3cret", "not-a-number", body, expected, now=1700000000)


# ── Consent link: the one patient send that used to bypass the guard ─────────

class _Resp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


@pytest.fixture
def fake_nexus_consent(monkeypatch, test_clinic):
    calls = {"get": [], "post": []}
    token_data = {"clinicId": test_clinic.id, "phone": "9876543210", "patientName": "Asha", "templateName": "Root canal"}

    async def _get(self, url, **kwargs):
        calls["get"].append(url)
        if url.endswith("/validate/good-token"):
            return _Resp(200, {"valid": True, "data": token_data})
        return _Resp(404, {"detail": "Link expired or invalid."})

    async def _post(self, url, json=None, **kwargs):
        calls["post"].append({"url": url, "json": json})
        return _Resp(200, {"success": True, "token": "good-token"})

    monkeypatch.setattr("httpx.AsyncClient.get", _get)
    monkeypatch.setattr("httpx.AsyncClient.post", _post)
    return calls, token_data


LINK = "https://app.molarplus.com/consent/sign/good-token"


def test_consent_link_goes_from_the_connected_number(client, auth_headers, db_session, test_clinic, configured,
                                                     fake_nexus_consent, captured_notify):
    calls, _ = fake_nexus_consent
    _connected_row(db_session, test_clinic)
    r = client.post("/api/v1/consents/links/good-token/send-whatsapp", headers=auth_headers, json={"consentLink": LINK})
    assert r.status_code == 200
    assert r.json()["provider"] == "wareach"
    assert calls["post"] == [], "the MSG91 consent send must not be called"
    sent = captured_notify[0]
    assert sent["event_type"] == "consent_form"
    assert sent["provider"] == "wareach"
    assert sent["template_data"]["consent_link"] == LINK
    assert sent["to_phone"].endswith("9876543210")


def test_consent_link_without_a_connected_number_is_the_old_msg91_call(client, auth_headers, configured, fake_nexus_consent, captured_notify):
    calls, _ = fake_nexus_consent
    r = client.post("/api/v1/consents/links/good-token/send-whatsapp", headers=auth_headers, json={"consentLink": LINK})
    assert r.status_code == 200
    assert calls["post"] == [{"url": calls["post"][0]["url"], "json": {"consentLink": LINK}}]
    assert calls["post"][0]["url"].endswith("/api/v1/consent/send-whatsapp/good-token")
    assert captured_notify == []


def test_consent_link_of_another_clinic_is_refused(client, auth_headers, test_clinic, configured, fake_nexus_consent, captured_notify):
    calls, token_data = fake_nexus_consent
    token_data["clinicId"] = test_clinic.id + 999
    r = client.post("/api/v1/consents/links/good-token/send-whatsapp", headers=auth_headers, json={"consentLink": LINK})
    assert r.status_code == 404
    assert calls["post"] == [] and captured_notify == []


def test_consent_link_must_be_this_tokens_link(client, auth_headers, configured, fake_nexus_consent):
    r = client.post("/api/v1/consents/links/good-token/send-whatsapp", headers=auth_headers,
                    json={"consentLink": "https://evil.example.com/phish"})
    assert r.status_code == 400


def test_expired_consent_token_is_404(client, auth_headers, configured, fake_nexus_consent):
    r = client.post("/api/v1/consents/links/old-token/send-whatsapp", headers=auth_headers,
                    json={"consentLink": "https://app.molarplus.com/consent/sign/old-token"})
    assert r.status_code == 404


# ── The clinic DTO tells the apps to stop opening WhatsApp manually ──────────

def test_auth_me_reports_the_own_number_connection(client, auth_headers, db_session, test_clinic, configured):
    me = client.get("/api/v1/auth/me", headers=auth_headers).json()
    clinic = me.get("clinic") or (me.get("user") or {}).get("clinic") or {}
    assert clinic.get("own_whatsapp_connected") is False

    _connected_row(db_session, test_clinic)
    me = client.get("/api/v1/auth/me", headers=auth_headers).json()
    clinic = me.get("clinic") or (me.get("user") or {}).get("clinic") or {}
    assert clinic.get("own_whatsapp_connected") is True
