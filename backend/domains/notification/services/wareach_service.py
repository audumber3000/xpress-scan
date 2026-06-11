"""
WA Reach client + helpers (own-number WhatsApp via whatsapp-web.js).

Kept fully separate from the MSG91 path. This module only handles WA Reach
*session management* (connect / QR / status / disconnect) and api-key crypto;
the actual message send lives in the nexus service alongside MSG91.

WA Reach is deployed on Hetzner; its backend API (Part C) is defined by the
endpoints called below. Until it exists, set WAREACH_MOCK=1 to demo the connect
UI with a placeholder QR.
"""
import os
import base64
import hashlib
import logging

import httpx
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

WAREACH_URL = os.getenv("WAREACH_URL", "http://116.203.142.56:3000").rstrip("/")
WAREACH_MOCK = os.getenv("WAREACH_MOCK", "") in ("1", "true", "True")
PRO_PLANS = ("professional", "professional_annual", "enterprise")

# 1×1 transparent PNG — placeholder QR for mock mode so the UI renders.
_MOCK_QR = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


# ── API-key encryption ────────────────────────────────────────────────────────
def _fernet() -> Fernet:
    """Fernet keyed off WAREACH_ENCRYPTION_KEY, falling back to JWT_SECRET so the
    feature works without extra env setup (override in prod for key separation)."""
    secret = os.getenv("WAREACH_ENCRYPTION_KEY") or os.getenv("JWT_SECRET", "your-secret-key")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_key(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_key(enc: str) -> str:
    if not enc:
        return ""
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except Exception as e:
        logger.warning(f"WA Reach api-key decrypt failed: {e}")
        return ""


def is_pro(clinic) -> bool:
    return bool(clinic and getattr(clinic, "subscription_plan", "free") in PRO_PLANS)


def get_active_integration(db, clinic_id: int):
    """Return the clinic's WhatsAppIntegration row only if it should route via
    WA Reach right now (Pro plan + status='connected'), else None.

    This is the single guard the dispatcher uses — when it returns None (the
    case for every clinic that hasn't connected), the existing MSG91 path runs
    unchanged.
    """
    from models import WhatsAppIntegration, Clinic
    row = (
        db.query(WhatsAppIntegration)
        .filter(WhatsAppIntegration.clinic_id == clinic_id,
                WhatsAppIntegration.status == "connected")
        .first()
    )
    if not row:
        return None
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    return row if is_pro(clinic) else None


# ── WA Reach session-management API ─────────────────────────────────────────────
def create_session(clinic_id: int) -> dict:
    """Create a WA Reach session for this clinic. WA Reach mints the api_key.
    Returns {session_id, api_key, qr, status}."""
    if WAREACH_MOCK:
        return {"session_id": f"mock-{clinic_id}", "api_key": "mock-key", "qr": _MOCK_QR, "status": "connecting"}
    with httpx.Client(timeout=20.0) as client:
        resp = client.post(f"{WAREACH_URL}/api/sessions", json={"clinic_id": clinic_id})
        resp.raise_for_status()
        return resp.json()


def get_qr(session_id: str) -> dict:
    """Fetch a fresh QR while pairing. Returns {qr, status}."""
    if WAREACH_MOCK:
        return {"qr": _MOCK_QR, "status": "connecting"}
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(f"{WAREACH_URL}/api/sessions/{session_id}/qr")
        resp.raise_for_status()
        return resp.json()


def get_status(session_id: str) -> dict:
    """Returns {status, phone_number}."""
    if WAREACH_MOCK:
        return {"status": "connected", "phone_number": "919999999999"}
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(f"{WAREACH_URL}/api/sessions/{session_id}/status")
        resp.raise_for_status()
        return resp.json()


def delete_session(session_id: str) -> None:
    if WAREACH_MOCK:
        return
    with httpx.Client(timeout=15.0) as client:
        client.delete(f"{WAREACH_URL}/api/sessions/{session_id}")
