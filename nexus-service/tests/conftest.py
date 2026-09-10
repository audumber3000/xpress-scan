"""
Shared fixtures for nexus-service tests.

Every outbound integration (MSG91, Meta, ZeptoMail, R2/S3) is mocked here —
these tests must never make a real network call. That's the whole point:
this service's job is translating our data into the exact shape three
different third parties expect, and that translation is exactly what broke
in production once already (see test_notification_service.py's regression
tests for the WhatsApp invoice document header bug).
"""
import os

# Set before any app module import, same pattern as backend/tests/conftest.py —
# NotificationService.__init__ reads these via os.getenv at construction time.
os.environ.setdefault("MSG91_AUTH_KEY", "test-msg91-auth-key")
os.environ.setdefault("MSG91_WHATSAPP_INTEGRATED_NUMBER", "919999999999")
os.environ.setdefault("META_ACCESS_TOKEN", "test-meta-token")
os.environ.setdefault("META_PHONE_NUMBER_ID", "test-phone-id")
os.environ.setdefault("ZEPTO_MAIL_TOKEN", "test-zepto-token")
# Deliberately NOT set: R2_PUBLIC_URL. Tests that care about the
# public-domain vs. presigned-URL branch set or delete it explicitly.

import pytest


@pytest.fixture
def service():
    from app.services.infrastructure.notification_service import NotificationService
    return NotificationService()


@pytest.fixture
def r2_env(monkeypatch):
    """Valid R2 credentials, public domain unset (forces the presigned-URL path)."""
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://test-account.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)


@pytest.fixture
def mock_boto3_client(monkeypatch):
    """Patch boto3.client so no test ever touches real R2/S3.

    Returns the Mock client instance so a test can assert on calls made to it
    (put_object, generate_presigned_url) or override its return values.
    """
    from unittest.mock import Mock
    fake_client = Mock()
    fake_client.generate_presigned_url = Mock(
        return_value="https://test-account.r2.cloudflarestorage.com/test-bucket/some/key.pdf?X-Amz-Signature=abc123"
    )
    monkeypatch.setattr("boto3.client", Mock(return_value=fake_client))
    return fake_client


class _MockedPosts:
    """Queues up responses for the mocked httpx.AsyncClient.post and records calls.

    `queue.append((json_payload, http_status))` to control what the next post
    gets back, in order. With nothing queued it defaults to a 200 with a
    MSG91-shaped success body. `.calls` records what was actually sent.
    """

    def __init__(self):
        self.queue = []
        self.calls = []

    def append(self, item):
        self.queue.append(item)


@pytest.fixture
def mock_httpx_post(monkeypatch):
    """Patch httpx.AsyncClient.post so no test ever calls MSG91/Meta/Zepto for real."""
    mocked = _MockedPosts()

    class _FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    async def _fake_post(self, url, json=None, headers=None, **kwargs):
        mocked.calls.append({"url": url, "json": json, "headers": headers})
        if mocked.queue:
            payload, status = mocked.queue.pop(0)
        else:
            payload, status = {"hasError": False, "requestId": "test-request-id"}, 200
        return _FakeResponse(status, payload)

    monkeypatch.setattr("httpx.AsyncClient.post", _fake_post)
    return mocked
