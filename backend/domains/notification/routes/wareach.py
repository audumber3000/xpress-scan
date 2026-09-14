"""
WA Reach integration routes: connect a clinic's own WhatsApp number.

Separate from the MSG91 flow: these endpoints only manage the clinic's WA Reach
workspace and its connection. Sending lives in the dispatcher and nexus.

The response shapes of /status, /connect, /qr and /disconnect are what the web
app and the shipped mobile app read, so they stay as they were.
"""
import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models import Clinic, User, WhatsAppIntegration
from core.auth_utils import get_current_user
from domains.notification.services import wareach_service
from domains.notification.services.wareach_service import WAReachError, WorkspaceGone

logger = logging.getLogger(__name__)
router = APIRouter()

WEBHOOK_SECRET = os.getenv("WAREACH_WEBHOOK_SECRET", "")

_UNAVAILABLE = "Connecting your own WhatsApp number isn't available right now. Please try again later."
_UNREACHABLE = "Couldn't reach the WhatsApp service. Please try again shortly."


def _require_pro_clinic(current_user: User, db: Session) -> Clinic:
    """Resolve the current user's clinic and ensure it may use WA Reach."""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with your account")
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if not wareach_service.is_pro(clinic):
        # 402 Payment Required — frontend shows the upgrade prompt.
        raise HTTPException(status_code=402, detail="WA Reach is a Pro feature. Upgrade to connect your own WhatsApp number.")
    return clinic


def _require_configured() -> None:
    if not wareach_service.is_configured():
        raise HTTPException(status_code=503, detail=_UNAVAILABLE)


def _get_or_create_row(db: Session, clinic_id: int) -> WhatsAppIntegration:
    row = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.clinic_id == clinic_id).first()
    if not row:
        row = WhatsAppIntegration(clinic_id=clinic_id, provider="wareach", status="disconnected")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _serialize(row: WhatsAppIntegration) -> dict:
    return {
        "status": row.status,
        "phone_number": row.phone_number,
        "last_status_at": row.last_status_at.isoformat() if row.last_status_at else None,
        "connected": row.status == "connected",
    }


@router.get("/status")
def get_integration_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current connection state for this clinic. Available to any logged-in user
    (so the UI can show 'connected'). A status older than a minute is refreshed
    from WA Reach, which heals a missed webhook."""
    if not current_user.clinic_id:
        return {"status": "disconnected", "phone_number": None, "connected": False, "is_pro": False, "available": False}
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    row = _get_or_create_row(db, current_user.clinic_id)
    if clinic and row.session_id and wareach_service.is_configured() and wareach_service.status_is_stale(row):
        try:
            wareach_service.refresh_from_remote(db, clinic, row)
        except WAReachError as e:
            # The cached status is still the best answer we have.
            logger.info(f"WA Reach status refresh failed for clinic {clinic.id}: {e}")
    return {
        **_serialize(row),
        "is_pro": wareach_service.is_pro(clinic),
        "available": wareach_service.is_configured(),
        **_entitlement(db, clinic),
    }


def _entitlement(db: Session, clinic) -> dict:
    """Whether this clinic may send from its own number, and why: its plan, or
    the add-on (bought, or a free grace period) and until when."""
    from core import addons
    if clinic is None:
        return {"entitled": False, "included_by_plan": False, "addon_until": None, "addon_source": None}
    key = wareach_service.OWN_NUMBER_ADDON
    included = addons.included_by_plan(db, clinic, key)
    row = None if included else addons.active_row(db, clinic.id, key)
    return {
        "entitled": included or row is not None,
        "included_by_plan": included,
        "addon_until": row.current_end.isoformat() if row is not None and row.current_end else None,
        "addon_source": row.source if row is not None else None,
    }


@router.post("/connect")
def connect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create the clinic's workspace if it has none, then start pairing and
    return the QR to scan."""
    clinic = _require_pro_clinic(current_user, db)
    _require_configured()
    if not _entitlement(db, clinic)["entitled"]:
        # 402, the same status the old Pro gate used, so both apps already know
        # to show an upgrade path rather than an error.
        raise HTTPException(
            status_code=402,
            detail="Sending from your own number is an add-on on the Plus plan. "
                   "Add it from Subscription, Add-on Features, or move to Pro where it is included.",
        )
    row = _get_or_create_row(db, clinic.id)
    try:
        wareach_service.ensure_workspace(db, clinic, row)
        try:
            remote = wareach_service.connect(row.session_id)
        except WorkspaceGone:
            # Deleted on WA Reach's side: start over with a fresh workspace.
            wareach_service.forget_workspace(row)
            wareach_service.ensure_workspace(db, clinic, row)
            remote = wareach_service.connect(row.session_id)
    except WAReachError as e:
        logger.warning(f"WA Reach connect failed for clinic {clinic.id}: {e}")
        db.rollback()
        raise HTTPException(status_code=502, detail=_UNREACHABLE)

    wareach_service.apply_remote_status(row, remote)
    db.commit()
    return {"status": row.status, "qr": remote.get("qr") or ""}


@router.get("/qr")
def refresh_qr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current QR while pairing (WhatsApp rotates it every ~20s), and whether
    the phone has connected yet."""
    clinic = _require_pro_clinic(current_user, db)
    _require_configured()
    row = _get_or_create_row(db, clinic.id)
    if not row.session_id:
        raise HTTPException(status_code=400, detail="No active session. Click Connect first.")
    try:
        remote = wareach_service.refresh_from_remote(db, clinic, row)
    except WAReachError as e:
        logger.warning(f"WA Reach qr fetch failed for clinic {clinic.id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't refresh the QR code. Please try again.")
    return {"status": row.status, "qr": remote.get("qr") or ""}


@router.post("/disconnect")
def disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unlink the clinic's WhatsApp number, or cancel pairing.

    If WA Reach can't be reached this fails rather than pretending: the phone
    would still be linked there, and the next 'connected' event would quietly
    start sending from it again after the clinic asked us to stop."""
    clinic = _require_pro_clinic(current_user, db)
    row = _get_or_create_row(db, clinic.id)
    if row.session_id and wareach_service.is_configured():
        try:
            wareach_service.disconnect(row.session_id)
        except WorkspaceGone:
            pass  # nothing left to unlink
        except WAReachError as e:
            logger.warning(f"WA Reach disconnect failed for clinic {clinic.id}: {e}")
            raise HTTPException(status_code=502, detail="Couldn't unlink your number right now. Please try again in a minute.")
    row.status = "disconnected"
    row.phone_number = None
    row.last_status_at = datetime.utcnow()
    db.commit()
    return {"status": "disconnected"}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    """Signed events from WA Reach: the number connecting or dropping, and
    messages being delivered, read or failing. Server-to-server, no user auth.

    Verified as `X-WAReach-Signature: sha256=HMAC(secret, "<X-WAReach-Timestamp>.<raw body>")`
    over the exact bytes received, and refused when stale. Fails closed when
    WAREACH_WEBHOOK_SECRET isn't set, rather than accepting anything.
    """
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    raw = await request.body()
    if not wareach_service.verify_signature(
        WEBHOOK_SECRET,
        request.headers.get("X-WAReach-Timestamp", ""),
        raw,
        request.headers.get("X-WAReach-Signature", ""),
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        payload = json.loads(raw or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    result = wareach_service.handle_webhook(db, payload)
    return {"ok": True, **result}
