"""Auth-boundary smoke tests for the gmail domain (previously zero coverage)."""
import pytest


@pytest.mark.parametrize("path", [
    "/api/v1/gmail/status",
    "/api/v1/gmail/auth-url",
    "/api/v1/gmail/messages",
])
def test_gmail_endpoint_requires_auth(client, path):
    r = client.get(path)
    assert r.status_code in (401, 403), f"GET {path} returned {r.status_code} — should require auth"


def test_gmail_send_requires_auth(client):
    r = client.post("/api/v1/gmail/send", json={})
    assert r.status_code in (401, 403, 422)
