"""
Cross-service smoke tests for the ephemeral CI staging stack.

Unlike test_smoke.py (built for a real, Nginx-fronted prod/staging URL where
/api/v1/notifications/* is routed straight to nexus), this file talks to
backend and nexus on their own separate ports directly — the way the CI
job's `docker compose` stack exposes them, with no reverse proxy in front.

These exist because of a real incident: nexus-service built a WhatsApp
document URL from an env var that was never actually wired through
docker-compose, and nothing caught it — not because the bug was subtle, but
because nothing ever actually booted the real containers with the real
compose file and checked that env vars survived the trip. Unit tests (which
mock every external call) structurally cannot catch that class of bug. This
file's whole job is to.

Usage:
    SMOKE_URL=http://localhost:8000 NEXUS_SMOKE_URL=http://localhost:8001 \
        pytest tests/smoke/test_ephemeral_stack_smoke.py -v
"""

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("SMOKE_URL", "http://localhost:8000").rstrip("/")
NEXUS_URL = os.environ.get("NEXUS_SMOKE_URL", "http://localhost:8001").rstrip("/")
TIMEOUT = 10


@pytest.fixture(scope="session")
def base():
    return BASE_URL


@pytest.fixture(scope="session")
def nexus_base():
    return NEXUS_URL


# ── Each service is actually up ────────────────────────────────────────────

def test_backend_health(base):
    r = requests.get(f"{base}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_nexus_health(nexus_base):
    r = requests.get(f"{nexus_base}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


# ── Nexus's own env vars actually reached its container ───────────────────
#
# This is the direct regression check: CI sets a dummy MSG91_AUTH_KEY in the
# nexus service's environment. If docker-compose ever again fails to pass an
# env var through (the exact shape of the original bug, just for a different
# variable), NotificationService.__init__ reads an empty string and this
# flips to False.

def test_nexus_notification_channels_are_configured(nexus_base):
    r = requests.get(f"{nexus_base}/api/v1/notifications/status", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["whatsapp"]["configured"] is True, (
        "nexus reports WhatsApp as unconfigured — MSG91_AUTH_KEY did not "
        "reach the nexus container. Check its `environment:` block in the "
        "compose file used for this job."
    )
    assert data["email"]["configured"] is True, (
        "nexus reports email as unconfigured — ZEPTO_MAIL_TOKEN did not "
        "reach the nexus container."
    )


# ── Backend can actually reach nexus over the real docker network ─────────
#
# Registers a throwaway user (public signup, no fixtures/seed data needed)
# and calls backend's own proxy route, which internally calls
# NEXUS_SERVICES_URL — the same call path invoice/prescription sends go
# through in prod. A wrong host, wrong port, or a network the two
# containers can't actually talk over would show up here as a request
# that never reaches nexus at all, distinct from nexus itself being
# unconfigured (checked above).

@pytest.fixture(scope="session")
def auth_token(base):
    email = f"smoke-{uuid.uuid4().hex[:10]}@ci-staging.test"
    resp = requests.post(
        f"{base}/api/v1/auth/register",
        json={
            "email": email,
            "password": "CiStagingSmoke123!",
            "first_name": "CI",
            "last_name": "Staging",
            "role": "clinic_owner",
        },
        timeout=TIMEOUT,
    )
    assert resp.status_code == 201, f"Signup failed during smoke setup: {resp.status_code} {resp.text}"
    return resp.json()["token"]


def test_backend_reaches_nexus_through_the_docker_network(base, auth_token):
    r = requests.get(
        f"{base}/api/v1/notification-admin/channel-status",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200
    data = r.json()
    # This route swallows connection failures into a false "not configured"
    # 200 rather than surfacing an error status (see notification_admin.py),
    # so the meaningful assertion is on the value, not just reachability.
    assert data["whatsapp"]["configured"] is True, (
        "backend's own view of nexus (via NEXUS_SERVICES_URL, over the "
        "docker network) says WhatsApp is unconfigured, even though nexus "
        "reports itself as configured directly — backend cannot actually "
        "reach nexus. Check NEXUS_SERVICES_URL and the compose network."
    )
