"""Auth-boundary smoke tests for the activity domain (previously zero coverage)."""
import pytest


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/activity-log"),
    ("post", "/api/v1/activity-log"),
    ("delete", "/api/v1/activity-log"),
])
def test_activity_log_requires_auth(client, method, path):
    r = getattr(client, method)(path)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code} — should require auth"
