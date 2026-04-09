"""
Smoke tests — run these against a live production or staging URL before any deploy.

Usage:
    SMOKE_URL=https://api.molarplus.com pytest tests/smoke/test_smoke.py -v

These tests make real HTTP requests and require no local DB or env setup.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("SMOKE_URL", "http://localhost:8000").rstrip("/")
TIMEOUT = 10


@pytest.fixture(scope="session")
def base():
    return BASE_URL


# ── 1. Health ─────────────────────────────────────────────────────────────────

def test_backend_health(base):
    r = requests.get(f"{base}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


# ── 2. Auth endpoints reachable ───────────────────────────────────────────────

def test_login_endpoint_reachable(base):
    r = requests.post(f"{base}/api/v1/auth/login", json={}, timeout=TIMEOUT)
    assert r.status_code in (400, 422), \
        f"Expected validation error, got {r.status_code}"


def test_oauth_endpoint_reachable(base):
    r = requests.post(f"{base}/api/v1/auth/oauth", json={}, timeout=TIMEOUT)
    assert r.status_code in (400, 401, 422), \
        f"Expected auth error, got {r.status_code}"


# ── 3. Protected endpoints require auth ───────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/api/v1/patients",
    "/api/v1/clinics/me",
    "/api/v1/appointments",
    "/api/v1/invoices",
])
def test_protected_endpoint_requires_auth(base, path):
    r = requests.get(f"{base}{path}", timeout=TIMEOUT)
    assert r.status_code in (401, 403), \
        f"{path} returned {r.status_code} — should require authentication"


# ── 4. Nexus service reachable via Nginx routing ──────────────────────────────

def test_nexus_notifications_status(base):
    r = requests.get(f"{base}/api/v1/notifications/status", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "whatsapp" in data or "email" in data, \
        f"Unexpected notifications/status response: {data}"


def test_nexus_reports_endpoint_reachable(base):
    r = requests.post(f"{base}/api/v1/reports/generate", json={}, timeout=TIMEOUT)
    assert r.status_code in (401, 403, 422), \
        f"Nexus /reports/generate returned unexpected status {r.status_code}"


# ── 5. CORS headers present ───────────────────────────────────────────────────

def test_cors_headers(base):
    r = requests.options(
        f"{base}/health",
        headers={"Origin": "https://app.molarplus.com"},
        timeout=TIMEOUT,
    )
    assert "access-control-allow-origin" in r.headers or r.status_code == 200, \
        "CORS headers missing"


# ── 6. HTTPS redirect (only when testing against production) ──────────────────

def test_https_redirect():
    if not BASE_URL.startswith("https"):
        pytest.skip("Only runs against HTTPS URLs")
    r = requests.get(
        BASE_URL.replace("https://", "http://") + "/health",
        allow_redirects=False,
        timeout=TIMEOUT,
    )
    assert r.status_code in (301, 302, 308), \
        f"Expected HTTP→HTTPS redirect, got {r.status_code}"
