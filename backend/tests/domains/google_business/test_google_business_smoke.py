"""Auth-boundary smoke tests for the google_business domain (previously zero coverage)."""
import pytest


@pytest.mark.parametrize("path", [
    "/api/v1/google-business/status",
    "/api/v1/google-business/accounts",
    "/api/v1/google-business/locations",
    "/api/v1/google-business/reviews",
    "/api/v1/google-places/status",
    "/api/v1/google-places/reviews",
    "/api/v1/google-places/competitors",
])
def test_google_endpoint_requires_auth(client, path):
    r = client.get(path)
    assert r.status_code in (401, 403), f"GET {path} returned {r.status_code} — should require auth"


def test_google_places_link_requires_auth(client):
    r = client.post("/api/v1/google-places/link", json={})
    assert r.status_code in (401, 403, 422)
