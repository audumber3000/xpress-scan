"""
WA Reach: a clinic's own WhatsApp number (own-number WhatsApp).

Kept fully separate from the MSG91 path. A clinic that has not connected its
number never reaches anything in here except `get_active_integration`, which
returns None for it, and the MSG91 flow runs exactly as before.

─── How it fits together ────────────────────────────────────────────────────────

  MolarPlus backend ──(partner key)──► WA Reach /api/partner/v1
      provision a workspace per clinic, connect (QR), status, disconnect
  nexus ─────────────(clinic key)───► WA Reach /api/v1/messages
      the actual send, with MSG91 as the fallback (nexus notification_service)
  WA Reach ──(HMAC-signed webhook)──► /api/v1/integrations/wareach/webhook
      session.connected / session.disconnected, message.delivered/read/failed

WA Reach runs on Evolution API on the OVH box. Both keys are pinned by WA Reach
to this server's address, because that box speaks plain HTTP.

The old contract (POST /api/sessions {clinic_id}, unauthenticated) was removed
from WA Reach as a security fix and is gone from here too.

Env:
  WAREACH_URL             e.g. http://51.79.146.28:3000   (nexus needs it too)
  WAREACH_PARTNER_KEY     same value as MOLARPLUS_PARTNER_KEY on WA Reach
  WAREACH_WEBHOOK_SECRET  same value on both sides; verifies webhooks
  WAREACH_ENCRYPTION_KEY  encrypts stored workspace keys (falls back to JWT secret)
  WAREACH_MOCK=1          local demo of the connect screen, no WA Reach needed
"""
import base64
import datetime
import hashlib
import hmac
import logging
import os
import time

import httpx
from cryptography.fernet import Fernet

from core.app_secret import get_jwt_secret

logger = logging.getLogger(__name__)

WAREACH_URL = (os.getenv("WAREACH_URL") or "").rstrip("/")
WAREACH_PARTNER_KEY = os.getenv("WAREACH_PARTNER_KEY") or ""
WAREACH_MOCK = os.getenv("WAREACH_MOCK", "") in ("1", "true", "True")
# Which plans may send from the clinic's own number is `core.plans`'
# has_own_whatsapp_number() (Pro and above), not a tuple kept here.
#
# Worth saying plainly: this gate is NOT enforced anywhere today. The tuple that
# used to sit on this line was declared and never read by anything, so WA Reach
# has always been open to any plan that got as far as configuring it. Left as a
# note rather than quietly wired up, because switching it on is a commercial
# decision about existing users, not a tidy-up.

# How long a cached connection status is trusted before the status endpoint asks
# WA Reach again. Webhooks are the primary signal; this heals a missed one.
STATUS_TTL_SECONDS = 60
# Webhooks older than this are refused, so a captured delivery cannot be replayed.
WEBHOOK_TOLERANCE_SECONDS = 300

# 1×1 transparent PNG — placeholder QR for mock mode so the UI renders.
_MOCK_QR = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

_REMOTE_STATUSES = ("connected", "connecting", "disconnected")

# The core.addons key that pays for sending from the clinic's own number.
OWN_NUMBER_ADDON = "own_whatsapp"


class WAReachError(Exception):
    """WA Reach could not do what was asked. `status_code` is 0 when unreachable."""

    def __init__(self, status_code: int, detail: str = ""):
        super().__init__(f"WA Reach {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class WorkspaceGone(WAReachError):
    """WA Reach does not know this workspace (404). Provision a new one."""


def is_configured() -> bool:
    return WAREACH_MOCK or bool(WAREACH_URL and WAREACH_PARTNER_KEY)


# ── API-key encryption ────────────────────────────────────────────────────────
def _fernet() -> Fernet:
    """Fernet keyed off WAREACH_ENCRYPTION_KEY, falling back to JWT_SECRET so the
    feature works without extra env setup (override in prod for key separation)."""
    secret = os.getenv("WAREACH_ENCRYPTION_KEY") or get_jwt_secret()
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
    # WA Reach is now free for every clinic — multi-branch is the only premium
    # capability. Kept as a function (rather than removing call sites) so the
    # WhatsApp routing/serialisation code is untouched. `clinic` must still exist.
    return bool(clinic)


# ── Routing guard ─────────────────────────────────────────────────────────────
def get_active_integration(db, clinic_id: int):
    """Return the clinic's WhatsAppIntegration row only if WhatsApp should go out
    from its own number right now, else None.

    This is the single guard the dispatcher uses. When it returns None (the case
    for every clinic that hasn't connected), the existing MSG91 path runs
    unchanged. It also returns None when WA Reach isn't configured on this
    server, or when the stored workspace key can't be read, so a bad deploy
    degrades to MSG91 instead of to failed sends.
    """
    from models import WhatsAppIntegration, Clinic
    if not is_configured():
        return None
    row = (
        db.query(WhatsAppIntegration)
        .filter(WhatsAppIntegration.clinic_id == clinic_id,
                WhatsAppIntegration.status == "connected")
        .first()
    )
    if not row:
        return None
    if not decrypt_key(row.api_key_enc):
        # Rotating JWT_SECRET without WAREACH_ENCRYPTION_KEY does this. Stop
        # routing here; the next status check re-keys the workspace.
        logger.error("WA Reach key for clinic %s is unreadable; routing to MSG91", clinic_id)
        return None
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not is_pro(clinic):
        return None
    # Own-number sending is an add-on on Plus and included from Pro. A clinic
    # whose add-on or plan has run out keeps its phone linked, and its messages
    # simply go out from the MolarPlus number again until it renews.
    from core import addons
    if not addons.entitled(db, clinic, OWN_NUMBER_ADDON):
        return None
    return row


def is_connected(db, clinic_id: int) -> bool:
    """For the clinic DTO: is this clinic sending from its own number right now."""
    try:
        return get_active_integration(db, clinic_id) is not None
    except Exception:
        return False


# ── WA Reach partner API ──────────────────────────────────────────────────────
def _request(method: str, path: str, json: dict | None = None, timeout: float = 20.0) -> dict:
    headers = {"Authorization": f"Bearer {WAREACH_PARTNER_KEY}"}
    try:
        with httpx.Client(timeout=httpx.Timeout(timeout, connect=5.0)) as client:
            resp = client.request(method, f"{WAREACH_URL}/api/partner/v1{path}", json=json, headers=headers)
    except httpx.HTTPError as e:
        raise WAReachError(0, type(e).__name__) from e
    try:
        data = resp.json()
    except Exception:
        data = {}
    detail = data.get("error", "") if isinstance(data, dict) else ""
    # Only WA Reach's own "no such workspace" answer means the workspace is gone.
    # A 404 for the route itself (WA Reach not upgraded yet, or rolled back) must
    # never read that way: callers forget the workspace on WorkspaceGone, and the
    # reconcile job would do that to every clinic at once.
    if resp.status_code == 404 and detail == "Workspace not found":
        raise WorkspaceGone(404, detail)
    if resp.status_code >= 400:
        detail = data.get("error", "") if isinstance(data, dict) else ""
        raise WAReachError(resp.status_code, detail)
    return data if isinstance(data, dict) else {}


def provision(clinic) -> dict:
    """Create the clinic's workspace, or re-key the existing one. Idempotent per
    clinic. Returns {workspace_id, api_key, status, qr, phone_number}; the key
    is only ever returned here, so store it."""
    if WAREACH_MOCK:
        return {"workspace_id": f"mock-{clinic.id}", "api_key": "mock-key", "status": "disconnected", "qr": ""}
    body = {"external_id": str(clinic.id), "name": clinic.name or f"Clinic {clinic.id}"}
    tz = getattr(clinic, "timezone", None)
    if tz:
        body["timezone"] = tz
    return _request("POST", "/workspaces", json=body)


def connect(workspace_id: str) -> dict:
    """Start pairing. Returns {status, qr, phone_number}; qr is a PNG data URL."""
    if WAREACH_MOCK:
        return {"status": "connecting", "qr": _MOCK_QR, "phone_number": None}
    return _request("POST", f"/workspaces/{workspace_id}/connect")


def fetch_status(workspace_id: str) -> dict:
    """Returns {status, qr, phone_number}."""
    if WAREACH_MOCK:
        return {"status": "connecting", "qr": _MOCK_QR, "phone_number": None}
    return _request("GET", f"/workspaces/{workspace_id}/status", timeout=15.0)


def disconnect(workspace_id: str) -> dict:
    if WAREACH_MOCK:
        return {"status": "disconnected"}
    return _request("POST", f"/workspaces/{workspace_id}/disconnect", timeout=30.0)


# ── Local state ───────────────────────────────────────────────────────────────
def store_workspace(row, workspace: dict) -> None:
    row.session_id = workspace.get("workspace_id") or row.session_id
    if workspace.get("api_key"):
        row.api_key_enc = encrypt_key(workspace["api_key"])


def forget_workspace(row) -> None:
    """WA Reach no longer has it: the next connect provisions a fresh one."""
    row.session_id = None
    row.api_key_enc = None
    row.status = "disconnected"
    row.phone_number = None
    row.last_status_at = datetime.datetime.utcnow()


def apply_remote_status(row, remote: dict) -> None:
    status = remote.get("status")
    if status in _REMOTE_STATUSES:
        row.status = status
    if status == "connected" and remote.get("phone_number"):
        row.phone_number = remote["phone_number"]
    row.last_status_at = datetime.datetime.utcnow()


def ensure_workspace(db, clinic, row) -> None:
    """Make sure the row holds a workspace id and a readable key, provisioning
    (which also re-keys) when either is missing."""
    if row.session_id and decrypt_key(row.api_key_enc):
        return
    store_workspace(row, provision(clinic))
    db.commit()


def status_is_stale(row, now: datetime.datetime | None = None) -> bool:
    if not row.last_status_at:
        return True
    now = now or datetime.datetime.utcnow()
    return (now - row.last_status_at).total_seconds() > STATUS_TTL_SECONDS


def refresh_from_remote(db, clinic, row) -> dict:
    """Pull the live status from WA Reach into the row. Heals a missed webhook,
    and re-keys a connected workspace whose stored key can no longer be used."""
    try:
        remote = fetch_status(row.session_id)
    except WorkspaceGone:
        forget_workspace(row)
        db.commit()
        return {"status": "disconnected", "qr": ""}
    apply_remote_status(row, remote)
    if row.status == "connected" and not decrypt_key(row.api_key_enc):
        try:
            store_workspace(row, provision(clinic))
        except WAReachError as e:
            logger.warning("WA Reach re-key failed for clinic %s: %s", clinic.id, e)
    db.commit()
    return remote


RECONCILE_AFTER_SECONDS = 300


def reconcile_connections(db, limit: int = 500) -> dict:
    """Bring every clinic's stored connection in line with WA Reach.

    Webhooks are the primary signal and the status endpoint heals a row when
    somebody opens the panel. This covers the rest: a clinic whose number was
    taken offline by a failed send and whose 'connected' webhook never made it
    (WA Reach retries for a few hours, a MolarPlus outage can outlast that)
    would otherwise keep paying for MSG91 until a person looked. Rows that
    changed in the last few minutes are left alone; a webhook just did that.
    """
    from models import WhatsAppIntegration, Clinic
    if not is_configured() or WAREACH_MOCK:
        return {"checked": 0, "changed": 0}
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=RECONCILE_AFTER_SECONDS)
    rows = (
        db.query(WhatsAppIntegration)
        .filter(WhatsAppIntegration.session_id.isnot(None))
        .filter((WhatsAppIntegration.last_status_at.is_(None)) | (WhatsAppIntegration.last_status_at < cutoff))
        .order_by(WhatsAppIntegration.last_status_at.asc().nullsfirst())
        .limit(limit)
        .all()
    )
    checked = changed = 0
    for row in rows:
        clinic = db.query(Clinic).filter(Clinic.id == row.clinic_id).first()
        if not clinic:
            continue
        before = row.status
        try:
            refresh_from_remote(db, clinic, row)
        except WAReachError as e:
            # Raised before anything on the row changed, so there is nothing to undo.
            if e.status_code in (0, 401, 403, 404) or e.status_code >= 500:
                # Unreachable, refusing our partner key or address, or not
                # speaking the partner API: every other row fails the same way,
                # and sends are already falling back to MSG91.
                logger.warning("WA Reach reconcile stopped: %s", e)
                break
            continue
        checked += 1
        if row.status != before:
            changed += 1
            logger.info("WA Reach reconcile: clinic %s %s -> %s", row.clinic_id, before, row.status)
    return {"checked": checked, "changed": changed}


def mark_offline(db, clinic_id: int, reason: str = "", drop_key: bool = False) -> None:
    """Stop routing this clinic's WhatsApp to its own number until WA Reach says
    it is connected again (session.connected webhook, or the next status check)."""
    from models import WhatsAppIntegration
    row = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.clinic_id == clinic_id).first()
    if not row:
        return
    changed = False
    if row.status == "connected":
        row.status = "disconnected"
        row.last_status_at = datetime.datetime.utcnow()
        changed = True
    if drop_key and row.api_key_enc:
        row.api_key_enc = None
        changed = True
    if changed:
        db.commit()
        logger.warning("WA Reach: clinic %s marked offline (%s)", clinic_id, reason or "send failed")


# ── Sending ───────────────────────────────────────────────────────────────────
def send_event(db, clinic_id: int, event_type: str, phone: str, data: dict, integration):
    """Send one WhatsApp from the clinic's own number, via nexus.

    Writes the NotificationLog row (provider 'wareach', free), then hands off to
    nexus, which sends through WA Reach and patches the real outcome back onto
    the row. If the own number definitely could not send, nexus falls back to
    MSG91, and only when the wallet can pay for it: `allow_fallback` is read
    here, and the charge is taken when nexus reports the fallback
    (apply_send_outcome), never up front. A clinic sending from its own number
    with an empty wallet still sends for free.
    """
    from models import NotificationLog
    from core import wallet_service
    from core.nexus_notify import notify
    from core.posthog_client import track_event, EVENTS

    now = datetime.datetime.utcnow()
    log_entry = NotificationLog(
        clinic_id=clinic_id,
        channel="whatsapp",
        recipient=phone,
        event_type=event_type,
        template_name=event_type,
        status="queued",
        cost=0.0,
        provider="wareach",
        created_at=now,
        updated_at=now,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    try:
        wallet = wallet_service.get_or_create_wallet(db, clinic_id)
        allow_fallback = wallet.balance >= wallet_service.get_cost("whatsapp", event_type)
    except Exception:
        allow_fallback = False

    notify(
        event_type, channel="whatsapp", to_phone=phone, template_data=data, log_id=log_entry.id,
        provider="wareach", wareach_api_key=decrypt_key(integration.api_key_enc),
        allow_fallback=allow_fallback,
    )

    # Nexus patches the verdict onto the row itself. In a sync context (a
    # scheduled job, where notify() blocks) it may already have, including a
    # fallback charge, so only close a row nothing else has touched, and never
    # write the cost back: that would erase what the fallback charged.
    db.refresh(log_entry)
    if log_entry.status == "queued":
        log_entry.status = "sent"
    db.commit()

    track_event(
        f"clinic_{clinic_id}",
        EVENTS.WHATSAPP_MESSAGE_SENT,
        {"provider": "wareach", "event_type": event_type, "paid": False},
        clinic_id=clinic_id,
    )
    return log_entry


_RECEIPT_RANK = {"queued": 0, "sent": 1, "failed": 1, "delivered": 2, "read": 3}


def apply_send_outcome(
    db, log, *, status: str, provider_message_id: str | None, error_message: str | None,
    provider: str | None, fallback: bool, wareach_offline: bool, wareach_key_rejected: bool = False,
) -> None:
    """Nexus's report on an own-number send (PATCH /notification-admin/logs/{id}).

    Three things beyond recording the status:
      * an MSG91 fallback is charged here, once. The row stops being a
        'wareach' row as it is charged, so a repeated callback can't charge again
      * a number that went offline stops receiving sends until it is back
      * a delivered/read receipt that already landed is never walked back
    """
    from core import wallet_service
    from core.wallet_service import InsufficientWalletBalance

    if fallback and provider == "msg91" and log.provider == "wareach":
        log.provider = "msg91"
        if status == "sent":
            try:
                log.cost = wallet_service.check_and_deduct(
                    db=db, clinic_id=log.clinic_id, channel="whatsapp", event_type=log.event_type,
                    description=f"{log.event_type} via whatsapp (own number unavailable)",
                )
            except InsufficientWalletBalance:
                # nexus only falls back when the balance covered it moments ago;
                # a concurrent debit can still win. The message is out either way.
                log.cost = 0.0

    if log.status not in ("delivered", "read"):
        log.status = status
    if provider_message_id:
        log.provider_message_id = provider_message_id
    if error_message:
        log.error_message = error_message
    log.updated_at = datetime.datetime.utcnow()
    db.commit()

    if wareach_offline:
        mark_offline(db, log.clinic_id, reason=error_message or "", drop_key=wareach_key_rejected)


# ── Webhooks from WA Reach ────────────────────────────────────────────────────
def sign(secret: str, timestamp: str, body: bytes) -> str:
    mac = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def verify_signature(secret: str, timestamp: str, body: bytes, signature: str, now: float | None = None) -> bool:
    """`X-WAReach-Signature: sha256=HMAC(secret, "<timestamp>.<raw body>")`.
    The timestamp is inside the signed material and must be fresh, so a captured
    delivery cannot be replayed later."""
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    now = time.time() if now is None else now
    if abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS:
        return False
    return hmac.compare_digest(sign(secret, timestamp, body), signature)


def handle_webhook(db, payload: dict) -> dict:
    """Apply one verified WA Reach event. Unknown workspaces and events are
    acknowledged and ignored, so WA Reach never retries something we will
    never accept."""
    from models import WhatsAppIntegration, NotificationLog

    event = str(payload.get("event") or "")
    org_id = str(payload.get("org_id") or "")
    data = payload.get("data") or {}
    if not org_id:
        return {"ignored": "no workspace"}
    row = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.session_id == org_id).first()
    if not row:
        return {"ignored": "unknown workspace"}

    if event == "session.connected":
        row.status = "connected"
        if data.get("phone_number"):
            row.phone_number = data["phone_number"]
        row.last_status_at = datetime.datetime.utcnow()
        db.commit()
        return {"applied": event}

    if event == "session.disconnected":
        row.status = "disconnected"
        row.last_status_at = datetime.datetime.utcnow()
        db.commit()
        return {"applied": event}

    if event in ("message.delivered", "message.read", "message.failed"):
        new_status = event.split(".", 1)[1]
        ref = str(data.get("reference") or "")
        if not ref.isdigit():
            return {"ignored": "no reference"}
        # Scoped to the workspace's own clinic: a reference is just a log id,
        # and a receipt must never be able to move another clinic's row.
        log = (
            db.query(NotificationLog)
            .filter(NotificationLog.id == int(ref),
                    NotificationLog.clinic_id == row.clinic_id,
                    NotificationLog.provider == "wareach")
            .first()
        )
        if not log:
            return {"ignored": "unknown message"}
        current = log.status or "queued"
        # Receipts arrive out of order and more than once: only ever move forward,
        # and a failure only counts before the message was delivered.
        advances = (
            current in ("queued", "sent") if new_status == "failed"
            else _RECEIPT_RANK.get(new_status, 0) > _RECEIPT_RANK.get(current, 0)
        )
        if advances:
            log.status = new_status
            log.updated_at = datetime.datetime.utcnow()
            db.commit()
            return {"applied": event}
        return {"ignored": "stale receipt"}

    if event == "contact.opted_out":
        logger.info("WA Reach: a patient of clinic %s opted out on the clinic's number", row.clinic_id)
        return {"applied": event}

    return {"ignored": f"event {event or '(none)'}"}
