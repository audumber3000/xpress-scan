"""
Tests for NotificationService — MSG91 WhatsApp, R2 media URLs, SMS.

The regression tests in TestResolveR2Url and TestSendWhatsappDocumentHeader
guard against the exact production bug this suite was written for: the
WhatsApp document header for invoice/prescription/receipt sends was built
from a hardcoded, guessed r2.dev domain (PUBLIC_R2_URL, never actually
configured anywhere) that belonged to a different bucket than prod's. MSG91
couldn't fetch a real PDF from it and reported the header as
"Format mismatch, expected DOCUMENT, received UNKNOWN". See the fix in
app/services/infrastructure/notification_service.py (_resolve_r2_url).
"""
import pytest

# asyncio_mode = auto (nexus-service/pytest.ini) runs async defs as tests
# automatically — no per-test @pytest.mark.asyncio needed.

# The exact hardcoded domain the bug used to fall back to. If this string
# ever shows up in a resolved URL again, the bug is back.
OLD_GUESSED_DOMAIN = "pub-dffc1ddb83334a5d876764f248e780d7.r2.dev"


class TestResolveR2Url:
    def test_uses_configured_public_domain_when_set(self, service, monkeypatch):
        monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example-clinic.com")
        result = service._resolve_r2_url("clinics/1/whatsapp/abc/Invoice_123.pdf")
        assert result == "https://cdn.example-clinic.com/clinics/1/whatsapp/abc/Invoice_123.pdf"

    def test_strips_leading_slash_from_key(self, service, monkeypatch):
        monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example-clinic.com/")
        result = service._resolve_r2_url("/clinics/1/x.pdf")
        assert result == "https://cdn.example-clinic.com/clinics/1/x.pdf"

    def test_falls_back_to_presigned_url_when_no_public_domain(
        self, service, r2_env, mock_boto3_client
    ):
        result = service._resolve_r2_url("clinics/1/whatsapp/abc/Invoice_123.pdf")

        assert result == mock_boto3_client.generate_presigned_url.return_value
        mock_boto3_client.generate_presigned_url.assert_called_once()
        _, kwargs = mock_boto3_client.generate_presigned_url.call_args
        assert kwargs["Params"]["Bucket"] == "test-bucket"
        assert kwargs["Params"]["Key"] == "clinics/1/whatsapp/abc/Invoice_123.pdf"

    def test_never_falls_back_to_a_guessed_domain(self, service, monkeypatch):
        """The actual regression: no R2_PUBLIC_URL and no R2 credentials at
        all used to still produce a URL — just one pointing at the wrong
        bucket. It must now degrade to returning the raw key rather than
        inventing a domain nobody configured."""
        monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
        monkeypatch.delenv("R2_ACCESS_KEY_ID", raising=False)
        monkeypatch.delenv("R2_SECRET_ACCESS_KEY", raising=False)
        monkeypatch.delenv("R2_ENDPOINT_URL", raising=False)
        monkeypatch.delenv("R2_BUCKET_NAME", raising=False)

        result = service._resolve_r2_url("clinics/1/whatsapp/abc/Invoice_123.pdf")

        assert OLD_GUESSED_DOMAIN not in result
        assert "r2.dev" not in result

    def test_presigned_url_never_contains_the_guessed_domain(
        self, service, r2_env, mock_boto3_client
    ):
        result = service._resolve_r2_url("clinics/1/x.pdf")
        assert OLD_GUESSED_DOMAIN not in result


class TestUploadMediaToMeta:
    async def test_returns_error_when_r2_not_configured(self, service, monkeypatch):
        for var in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL", "R2_BUCKET_NAME"):
            monkeypatch.delenv(var, raising=False)

        result = await service.upload_media_to_meta(b"%PDF-1.4 fake", "Invoice_1.pdf")

        assert result["success"] is False
        assert "not configured" in result["error"]

    async def test_uploads_and_returns_a_fetchable_url(
        self, service, r2_env, mock_boto3_client
    ):
        result = await service.upload_media_to_meta(
            b"%PDF-1.4 fake pdf bytes", "Invoice_2024-001.pdf",
            clinic_id="7", patient_id="42",
        )

        assert result["success"] is True
        assert result["media_id"] == mock_boto3_client.generate_presigned_url.return_value
        assert OLD_GUESSED_DOMAIN not in result["media_id"]

        # Uploaded to a clinic/patient-scoped path with the PDF content type
        mock_boto3_client.put_object.assert_called_once()
        _, kwargs = mock_boto3_client.put_object.call_args
        assert kwargs["Bucket"] == "test-bucket"
        assert kwargs["Key"].startswith("clinics/7/patients/42/whatsapp/")
        assert kwargs["Key"].endswith("Invoice_2024-001.pdf")
        assert kwargs["ContentType"] == "application/pdf"

    async def test_upload_failure_is_reported_not_raised(
        self, service, r2_env, mock_boto3_client
    ):
        mock_boto3_client.put_object.side_effect = RuntimeError("R2 bucket unreachable")

        result = await service.upload_media_to_meta(b"data", "x.pdf")

        assert result["success"] is False
        assert "R2 bucket unreachable" in result["error"]


class TestSendWhatsappDocumentHeader:
    """The exact path invoice/prescription/receipt sends go through."""

    async def test_full_link_passes_through_unchanged(self, service, mock_httpx_post):
        components = [
            {
                "type": "header",
                "parameters": [{
                    "type": "document",
                    "document": {"link": "https://cdn.example.com/Invoice_123.pdf", "filename": "Invoice_123.pdf"},
                }],
            },
        ]

        result = await service.send_whatsapp("919876543210", "mp_invoice_sent", components=components)

        assert result["success"] is True
        sent = mock_httpx_post.calls[0]["json"]
        header = sent["payload"]["template"]["to_and_components"][0]["components"]["header_1"]
        assert header["type"] == "document"
        assert header["value"] == "https://cdn.example.com/Invoice_123.pdf"
        assert header["filename"] == "Invoice_123.pdf"

    async def test_relative_r2_key_is_resolved_to_a_fetchable_url(
        self, service, mock_httpx_post, r2_env, mock_boto3_client
    ):
        """This is the regression case: something upstream passed a bucket key
        (or an 'id') instead of a full link. The header value MSG91 actually
        receives must be a working URL, never a guessed domain."""
        components = [
            {
                "type": "header",
                "parameters": [{
                    "type": "document",
                    "document": {"id": "clinics/1/whatsapp/abc/Invoice_1.pdf", "filename": "Invoice_1.pdf"},
                }],
            },
        ]

        result = await service.send_whatsapp("919876543210", "mp_invoice_sent", components=components)

        assert result["success"] is True
        sent = mock_httpx_post.calls[0]["json"]
        header = sent["payload"]["template"]["to_and_components"][0]["components"]["header_1"]
        assert header["value"] == mock_boto3_client.generate_presigned_url.return_value
        assert OLD_GUESSED_DOMAIN not in header["value"]

    async def test_missing_auth_key_short_circuits_without_a_network_call(
        self, service, mock_httpx_post, monkeypatch
    ):
        monkeypatch.setattr(service, "msg91_auth_key", "")

        result = await service.send_whatsapp("919876543210", "mp_invoice_sent")

        assert result["success"] is False
        assert mock_httpx_post.calls == []


class TestSendWhatsappComponentTranslation:
    """Meta-shaped components -> MSG91-shaped components, for the other header/body/button kinds."""

    async def test_text_header(self, service, mock_httpx_post):
        components = [{"type": "header", "parameters": [{"type": "text", "text": "Sunrise Dental"}]}]

        await service.send_whatsapp("919876543210", "mp_appointment_booked", components=components)

        header = mock_httpx_post.calls[0]["json"]["payload"]["template"]["to_and_components"][0]["components"]["header_1"]
        assert header == {"type": "text", "value": "Sunrise Dental"}

    async def test_multiple_body_params_are_indexed_in_order(self, service, mock_httpx_post):
        components = [{
            "type": "body",
            "parameters": [
                {"type": "text", "text": "Priya"},
                {"type": "text", "text": "Sunrise Dental"},
                {"type": "text", "text": "INV-042"},
            ],
        }]

        await service.send_whatsapp("919876543210", "mp_invoice_sent", components=components)

        comps = mock_httpx_post.calls[0]["json"]["payload"]["template"]["to_and_components"][0]["components"]
        assert comps["body_1"] == {"type": "text", "value": "Priya"}
        assert comps["body_2"] == {"type": "text", "value": "Sunrise Dental"}
        assert comps["body_3"] == {"type": "text", "value": "INV-042"}

    async def test_otp_button_carries_the_code(self, service, mock_httpx_post):
        components = [{
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "coupon_code", "coupon_code": "482913"}],
        }]

        await service.send_whatsapp("919876543210", "mp_otp", components=components)

        comps = mock_httpx_post.calls[0]["json"]["payload"]["template"]["to_and_components"][0]["components"]
        assert comps["button_1"] == {"subtype": "url", "type": "text", "value": "482913"}

    async def test_namespace_included_only_when_configured(self, service, mock_httpx_post, monkeypatch):
        monkeypatch.setattr(service, "msg91_wa_namespace", "")
        await service.send_whatsapp("919876543210", "mp_invoice_sent")
        template = mock_httpx_post.calls[0]["json"]["payload"]["template"]
        assert "namespace" not in template

        monkeypatch.setattr(service, "msg91_wa_namespace", "abc-namespace-123")
        await service.send_whatsapp("919876543210", "mp_invoice_sent")
        template = mock_httpx_post.calls[1]["json"]["payload"]["template"]
        assert template["namespace"] == "abc-namespace-123"

    async def test_msg91_error_response_is_reported_as_failure(self, service, mock_httpx_post):
        mock_httpx_post.queue.append(
            ({"hasError": True, "message": "header: Format mismatch, expected DOCUMENT, received UNKNOWN"}, 200)
        )

        result = await service.send_whatsapp("919876543210", "mp_invoice_sent")

        assert result["success"] is False
