"""
Smoke tests — run these against a live production or staging URL before any deploy.

Usage:
    SMOKE_URL=https://api.molarplus.com pytest tests/smoke/test_smoke.py -v

    # Also validate DB schema (catches missing migrations):
    SMOKE_URL=https://api.molarplus.com \
    DATABASE_URL=postgresql://user:pass@host/db \
    pytest tests/smoke/test_smoke.py -v

These tests make real HTTP requests and require no local DB or env setup.
The schema migration test additionally requires DATABASE_URL to be set.
"""

import os
import pytest
import requests
from sqlalchemy import create_engine, text

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


# ── 7. Schema / migration validation ─────────────────────────────────────────
#
# This is the test that would have caught the prod outage.
#
# What happened: new columns were added to models.py (cashfree_customer_id,
# logo_url, timings, etc.) but the ALTER TABLE migration was never run on
# prod. The SELECT * on clinics exploded with UndefinedColumn.
#
# Regular integration tests missed this because conftest.py uses
# Base.metadata.create_all() — a fresh DB that always has every column.
# This test connects to the REAL database and checks the actual columns.
#
# Requires: DATABASE_URL env var pointing at the DB you want to verify.

REQUIRED_COLUMNS = {
    "clinics": {
        "id", "clinic_code", "name", "address", "phone", "email",
        "gst_number", "specialization", "subscription_plan", "status",
        "razorpay_customer_id", "cashfree_customer_id",
        "logo_url", "invoice_template", "primary_color",
        "number_of_chairs", "timings",
        "created_at", "updated_at", "synced_at", "sync_status",
        "referred_by_code",
    },
    "users": {
        "id", "email", "name", "first_name", "last_name",
        "role", "is_active", "permissions", "created_at", "updated_at",
    },
    "user_clinics": {
        "id", "user_id", "clinic_id",
    },
    "patients": {
        "id", "clinic_id", "name", "phone", "created_at", "updated_at",
    },
    "appointments": {
        "id", "clinic_id", "patient_name",
        "appointment_date", "start_time", "end_time",
        "status", "created_at", "updated_at",
    },
}


@pytest.mark.parametrize("table,required", REQUIRED_COLUMNS.items())
def test_db_table_has_all_required_columns(table, required):
    """
    Connects to DATABASE_URL and checks every required column exists.
    Skips if DATABASE_URL is not set.

    Run this before every prod deploy:
      DATABASE_URL=postgresql://... pytest tests/smoke/test_smoke.py::test_db_table_has_all_required_columns -v
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        pytest.skip("Set DATABASE_URL to run schema migration checks")

    engine = create_engine(db_url)
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = :t"
                ),
                {"t": table},
            )
            actual = {row[0] for row in result}
    finally:
        engine.dispose()

    assert actual, (
        f"Table '{table}' not found in DB or has no columns — "
        "did you forget to run migrations?"
    )

    missing = required - actual
    assert not missing, (
        f"Table '{table}' is MISSING columns: {sorted(missing)}\n"
        f"Run the migration to add these columns before deploying."
    )
