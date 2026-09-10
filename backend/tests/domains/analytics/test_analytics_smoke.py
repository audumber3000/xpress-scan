"""Auth-boundary smoke tests for the analytics domain (previously zero coverage)."""
import pytest


@pytest.mark.parametrize("path", [
    "/api/v1/dashboard/metrics",
    "/api/v1/dashboard/patient-stats",
    "/api/v1/dashboard/revenue",
    "/api/v1/dashboard/today",
    "/api/v1/dashboard/kpi-detail",
    "/api/v1/dashboard/reports/history",
])
def test_dashboard_endpoint_requires_auth(client, path):
    r = client.get(path)
    assert r.status_code in (401, 403, 422), f"GET {path} returned {r.status_code} — should require auth"


def test_generate_report_requires_auth(client):
    r = client.post("/api/v1/dashboard/reports/generate", json={})
    assert r.status_code in (401, 403, 422)
