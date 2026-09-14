"""
Own-number WhatsApp (WA Reach) sends and the MSG91 safety net.

The one decision that matters here is whether MSG91 may step in when the
clinic's own number did not send. Wrong one way, a patient silently misses a
message. Wrong the other way, they get it twice, or a patient who replied STOP
to the clinic hears from us anyway. Every branch of that decision is pinned.
"""
import httpx
import pytest

from app.services.infrastructure.notification_service import (
    WAREACH_FALLBACK_RESULTS,
    attachment_filename,
    classify_wareach_exception,
    classify_wareach_response,
)

APPT = dict(
    patient_name="Asha", clinic_name="Smile Dental",
    appointment_date="25 Sep 2026", appointment_time="10:30 AM", clinic_phone="+91 90000 00000",
)


@pytest.fixture
def wareach_env(monkeypatch):
    monkeypatch.setenv("WAREACH_URL", "http://wareach.test:3000/")


class TestClassification:
    @pytest.mark.parametrize("status,body,expected", [
        (201, {"success": True}, "sent"),
        (200, {}, "sent"),
        (409, {"error": "WhatsApp is not connected for this account"}, "offline"),
        (401, {"error": "Invalid API key"}, "offline"),
        (403, {"error": "This key cannot be used from this address"}, "offline"),
        (403, {"error": "This contact has opted out of messages"}, "opted_out"),
        (404, {"error": "Not found"}, "offline"),
        (503, {}, "offline"),
        (429, {"error": "Too many messages waiting"}, "busy"),
        (502, {"error": "WhatsApp rejected the message"}, "rejected"),
        (400, {"error": "A \"to\" number is required"}, "invalid"),
        (500, {"error": "Internal error"}, "unknown"),
        (504, None, "unknown"),
    ])
    def test_response_table(self, status, body, expected):
        assert classify_wareach_response(status, body) == expected

    def test_only_definite_non_sends_fall_back(self):
        assert WAREACH_FALLBACK_RESULTS == {"offline", "busy", "rejected"}
        assert "unknown" not in WAREACH_FALLBACK_RESULTS, "a timeout may have delivered"
        assert "opted_out" not in WAREACH_FALLBACK_RESULTS, "STOP must be honoured on every channel"

    def test_connection_failures_are_offline(self):
        req = httpx.Request("POST", "http://x")
        assert classify_wareach_exception(httpx.ConnectError("refused", request=req)) == "offline"
        assert classify_wareach_exception(httpx.ConnectTimeout("slow", request=req)) == "offline"

    def test_read_timeout_is_unknown(self):
        req = httpx.Request("POST", "http://x")
        assert classify_wareach_exception(httpx.ReadTimeout("slow", request=req)) == "unknown"
        assert classify_wareach_exception(httpx.RemoteProtocolError("dropped", request=req)) == "unknown"


class TestAttachmentFilename:
    def test_named_documents(self):
        assert attachment_filename("invoice_notification", {"invoice_number": "INV/2026 001"}, "u") == "Invoice_INV-2026-001.pdf"
        assert attachment_filename("receipt_notification", {"receipt_number": "R-9"}, "u") == "Receipt_R-9.pdf"
        assert attachment_filename("prescription_notification", {}, "u") == "Prescription.pdf"

    def test_falls_back_to_url_name_or_generic(self):
        assert attachment_filename("other", {}, "https://cdn/x/Plan_12.pdf?sig=abc") == "Plan_12.pdf"
        assert attachment_filename("other", {}, "https://cdn/x/") == "document.pdf"


class TestSendViaWareach:
    async def test_posts_to_messages_api_with_the_workspace_key(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"success": True, "message_id": "WAMID1"}, 201))
        result = await service.send_via_wareach(
            api_key="wr_test", to_phone="919800000001", text="hello",
            media_url="https://cdn/inv.pdf", filename="Invoice_1.pdf", mimetype="application/pdf",
            reference="77",
        )
        assert result["success"] is True
        assert result["wareach_result"] == "sent"
        call = mock_httpx_post.calls[0]
        assert call["url"] == "http://wareach.test:3000/api/v1/messages"
        assert call["headers"] == {"Authorization": "Bearer wr_test"}
        assert call["json"] == {
            "to": "919800000001", "text": "hello",
            "media_url": "https://cdn/inv.pdf", "filename": "Invoice_1.pdf",
            "mimetype": "application/pdf", "reference": "77",
        }

    async def test_unconfigured_url_is_offline_without_a_request(self, service, mock_httpx_post, monkeypatch):
        monkeypatch.delenv("WAREACH_URL", raising=False)
        result = await service.send_via_wareach(api_key="wr_test", to_phone="91", text="x")
        assert result["wareach_result"] == "offline"
        assert mock_httpx_post.calls == []


class TestDispatchOwnNumber:
    async def _dispatch(self, service, **overrides):
        kwargs = dict(
            event_type="appointment_booked", channel="whatsapp", to_phone="919800000001",
            provider="wareach", wareach_api_key="wr_test", log_id=55, allow_fallback=True,
        )
        kwargs.update(overrides)
        return await service.dispatch_event(**kwargs, **APPT)

    async def test_success_never_touches_msg91(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"success": True, "message_id": "WAMID1"}, 201))
        result = await self._dispatch(service)
        assert result["success"] is True
        assert result["provider"] == "wareach"
        assert len(mock_httpx_post.calls) == 1
        assert mock_httpx_post.calls[0]["json"]["reference"] == "55"
        assert "Smile Dental" in mock_httpx_post.calls[0]["json"]["text"]

    async def test_offline_falls_back_to_msg91_template(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"error": "WhatsApp is not connected for this account"}, 409))
        mock_httpx_post.append(({"hasError": False, "requestId": "msg91-req"}, 200))
        result = await self._dispatch(service)
        assert result["success"] is True
        assert result["provider"] == "msg91"
        assert result["fallback"] is True
        assert result["wareach_offline"] is True
        assert "409" in result["wareach_error"]
        assert "msg91.com" in mock_httpx_post.calls[1]["url"]

    async def test_revoked_key_is_reported_so_the_backend_can_rekey(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"error": "Invalid API key"}, 401))
        mock_httpx_post.append(({"hasError": False, "requestId": "msg91-req"}, 200))
        result = await self._dispatch(service)
        assert result["fallback"] is True
        assert result["wareach_offline"] is True
        assert result["wareach_key_rejected"] is True

    async def test_rejected_falls_back_but_number_is_not_offline(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"error": "WhatsApp rejected the message"}, 502))
        mock_httpx_post.append(({"hasError": False, "requestId": "msg91-req"}, 200))
        result = await self._dispatch(service)
        assert result["fallback"] is True
        assert result["wareach_offline"] is False

    async def test_no_fallback_when_the_wallet_cannot_pay(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"error": "not connected"}, 409))
        result = await self._dispatch(service, allow_fallback=False)
        assert result["success"] is False
        assert result["provider"] == "wareach"
        assert result["wareach_offline"] is True
        assert len(mock_httpx_post.calls) == 1

    async def test_opted_out_patient_is_never_messaged_another_way(self, service, mock_httpx_post, wareach_env):
        mock_httpx_post.append(({"error": "This contact has opted out of messages"}, 403))
        result = await self._dispatch(service)
        assert result["success"] is False
        assert result["wareach_result"] == "opted_out"
        assert len(mock_httpx_post.calls) == 1

    async def test_timeout_does_not_risk_a_duplicate(self, service, monkeypatch, wareach_env):
        calls = []

        async def _timeout(self, url, json=None, headers=None, **kwargs):
            calls.append(url)
            raise httpx.ReadTimeout("slow", request=httpx.Request("POST", url))

        monkeypatch.setattr("httpx.AsyncClient.post", _timeout)
        result = await self._dispatch(service)
        assert result["success"] is False
        assert result["wareach_result"] == "unknown"
        assert calls == ["http://wareach.test:3000/api/v1/messages"], "MSG91 must not be tried"

    async def test_bare_r2_key_is_resolved_to_a_fetchable_url(self, service, mock_httpx_post, wareach_env, monkeypatch):
        monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example-clinic.com")
        mock_httpx_post.append(({"success": True, "message_id": "WAMID2"}, 201))
        await service.dispatch_event(
            event_type="invoice_notification", channel="whatsapp", to_phone="919800000001",
            provider="wareach", wareach_api_key="wr_test", log_id=9, allow_fallback=False,
            patient_name="Asha", clinic_name="Smile Dental", invoice_number="INV-7",
            total_amount=850.0, clinic_phone="", media_id="clinics/1/whatsapp/abc/Invoice_INV-7.pdf",
        )
        sent = mock_httpx_post.calls[0]["json"]
        assert sent["media_url"] == "https://cdn.example-clinic.com/clinics/1/whatsapp/abc/Invoice_INV-7.pdf"
        assert sent["filename"] == "Invoice_INV-7.pdf"
        assert sent["mimetype"] == "application/pdf"
        assert "attached" in sent["text"]

    async def test_msg91_path_is_unchanged_without_the_provider(self, service, mock_httpx_post):
        result = await service.dispatch_event(
            event_type="appointment_booked", channel="whatsapp", to_phone="919800000001", **APPT,
        )
        assert result["success"] is True
        assert "provider" not in result
        assert "msg91.com" in mock_httpx_post.calls[0]["url"]


class TestSendEventCallback:
    async def test_own_number_callback_reports_the_fallback(self, monkeypatch):
        from app.api.v1.endpoints import notifications as ep

        async def _dispatch(**kwargs):
            assert kwargs["allow_fallback"] is True
            return {"success": True, "provider": "msg91", "fallback": True, "wareach_offline": True,
                    "wareach_error": "WA Reach 409: not connected", "data": {"requestId": "r1"}}

        patched = []

        async def _patch(self, url, json=None, headers=None, **kwargs):
            patched.append(json)

        monkeypatch.setattr(ep.notification_service, "dispatch_event", _dispatch)
        monkeypatch.setattr("httpx.AsyncClient.patch", _patch)
        await ep.send_event(ep.SendEventRequest(
            event_type="appointment_booked", channel="whatsapp", to_phone="91", provider="wareach",
            wareach_api_key="wr", log_id=5, callback_url="http://backend/logs/5", allow_fallback=True,
        ))
        assert patched[0]["status"] == "sent"
        assert patched[0]["provider"] == "msg91"
        assert patched[0]["fallback"] is True
        assert patched[0]["wareach_offline"] is True
        assert patched[0]["wareach_key_rejected"] is False
        assert patched[0]["provider_message_id"] == "r1"
        assert "409" in patched[0]["error_message"]

    async def test_msg91_callback_shape_is_unchanged(self, monkeypatch):
        from app.api.v1.endpoints import notifications as ep

        async def _dispatch(**kwargs):
            return {"success": True, "data": {"requestId": "r2"}}

        patched = []

        async def _patch(self, url, json=None, headers=None, **kwargs):
            patched.append(json)

        monkeypatch.setattr(ep.notification_service, "dispatch_event", _dispatch)
        monkeypatch.setattr("httpx.AsyncClient.patch", _patch)
        await ep.send_event(ep.SendEventRequest(
            event_type="appointment_booked", channel="whatsapp", to_phone="91",
            log_id=6, callback_url="http://backend/logs/6",
        ))
        assert patched[0] == {"status": "sent", "provider_message_id": "r2", "error_message": None}
