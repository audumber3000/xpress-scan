"""Auth-boundary smoke tests for the support domain (previously zero coverage)."""
import pytest


@pytest.mark.parametrize("method,path", [
    ("post", "/api/v1/support-tickets"),
    ("get", "/api/v1/support-tickets"),
    ("get", "/api/v1/support-tickets/1"),
    ("post", "/api/v1/support-tickets/1/messages"),
    ("get", "/api/v1/feature-requests"),
    ("post", "/api/v1/feature-requests"),
    ("put", "/api/v1/feature-requests/1"),
    ("delete", "/api/v1/feature-requests/1"),
    ("post", "/api/v1/feature-requests/1/vote"),
])
def test_support_endpoint_requires_auth(client, method, path):
    kwargs = {"json": {}} if method in ("post", "put") else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403, 422), f"{method.upper()} {path} returned {r.status_code} — should require auth"
