"""Auth-boundary smoke tests for the search domain (previously zero coverage)."""

def test_global_search_requires_auth(client):
    r = client.get("/api/v1/search?q=test")
    assert r.status_code in (401, 403, 422), f"returned {r.status_code} — should require auth"
