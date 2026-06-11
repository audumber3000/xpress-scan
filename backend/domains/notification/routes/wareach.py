"""
WA Reach integration routes — connect a clinic's own WhatsApp number (Pro only).

Separate from the MSG91 flow: these endpoints only manage the per-clinic WA
Reach session/connection. Sending is unchanged and lives in dispatch/nexus.
"""
import os
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import SessionLocal
from models import Clinic, User, WhatsAppIntegration, NotificationLog
from core.auth_utils import get_current_user
from domains.notification.services import wareach_service

logger = logging.getLogger(__name__)
router = APIRouter()

WEBHOOK_SECRET = os.getenv("WAREACH_WEBHOOK_SECRET", "")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_pro_clinic(current_user: User, db: Session) -> Clinic:
    """Resolve the current user's clinic and ensure it's on a Pro plan."""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with your account")
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if not wareach_service.is_pro(clinic):
        # 402 Payment Required — frontend shows the upgrade prompt.
        raise HTTPException(status_code=402, detail="WA Reach is a Pro feature. Upgrade to connect your own WhatsApp number.")
    return clinic


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
    """Current WA Reach connection state for this clinic. Available to any
    logged-in user (so the UI can show 'connected'); connecting requires Pro."""
    if not current_user.clinic_id:
        return {"status": "disconnected", "phone_number": None, "connected": False, "is_pro": False}
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    row = _get_or_create_row(db, current_user.clinic_id)
    return {**_serialize(row), "is_pro": wareach_service.is_pro(clinic)}


@router.post("/connect")
def connect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create (or restart) a WA Reach session and return a QR to scan."""
    _require_pro_clinic(current_user, db)
    row = _get_or_create_row(db, current_user.clinic_id)
    try:
        result = wareach_service.create_session(current_user.clinic_id)
    except Exception as e:
        logger.warning(f"WA Reach connect failed for clinic {current_user.clinic_id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't reach the WhatsApp service. Please try again shortly.")

    row.session_id = result.get("session_id")
    if result.get("api_key"):
        row.api_key_enc = wareach_service.encrypt_key(result["api_key"])
    row.status = result.get("status") or "connecting"
    row.last_status_at = datetime.utcnow()
    db.commit()
    return {"status": row.status, "qr": result.get("qr")}


@router.get("/qr")
def refresh_qr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a fresh QR while pairing (QRs rotate ~20s)."""
    _require_pro_clinic(current_user, db)
    row = _get_or_create_row(db, current_user.clinic_id)
    if not row.session_id:
        raise HTTPException(status_code=400, detail="No active session. Click Connect first.")
    try:
        result = wareach_service.get_qr(row.session_id)
    except Exception as e:
        logger.warning(f"WA Reach qr fetch failed for clinic {current_user.clinic_id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't refresh the QR code. Please try again.")
    if result.get("status"):
        row.status = result["status"]
        row.last_status_at = datetime.utcnow()
        db.commit()
    return {"status": row.status, "qr": result.get("qr")}


@router.post("/disconnect")
def disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unlink the clinic's WhatsApp number. Session is torn down on WA Reach."""
    _require_pro_clinic(current_user, db)
    row = _get_or_create_row(db, current_user.clinic_id)
    if row.session_id:
        try:
            wareach_service.delete_session(row.session_id)
        except Exception as e:
            logger.warning(f"WA Reach disconnect (remote) failed for clinic {current_user.clinic_id}: {e}")
    row.status = "disconnected"
    row.phone_number = None
    row.last_status_at = datetime.utcnow()
    db.commit()
    return {"status": "disconnected"}


class WebhookBody(BaseModel):
    session_id: str | None = None
    clinic_id: int | None = None
    event: str | None = None          # 'connected' | 'qr' | 'disconnected' | 'failed' | 'message_status'
    status: str | None = None
    phone_number: str | None = None
    log_id: int | None = None
    message_status: str | None = None  # 'sent' | 'delivered' | 'read' | 'failed'
    error: str | None = None


@router.post("/webhook")
def webhook(body: WebhookBody, request: Request, db: Session = Depends(get_db)):
    """Signed callback from WA Reach for session status + delivery receipts.
    Called server-to-server (no user auth) — verified by shared secret header."""
    if WEBHOOK_SECRET:
        if request.headers.get("X-WAReach-Secret") != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Locate the clinic's integration row by session_id or clinic_id.
    row = None
    if body.session_id:
        row = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.session_id == body.session_id).first()
    if not row and body.clinic_id:
        row = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.clinic_id == body.clinic_id).first()

    # Session status change
    new_status = body.status or (body.event if body.event in ("connected", "disconnected", "failed", "connecting") else None)
    if row and new_status:
        row.status = new_status
        if body.phone_number:
            row.phone_number = body.phone_number
        if new_status != "connected":
            # keep phone on connect; clear on disconnect/fail handled by UI alert
            pass
        row.last_status_at = datetime.utcnow()
        db.commit()

    # Delivery receipt → update the originating NotificationLog. Receipts can
    # arrive out of order / more than once, so only advance the status (never
    # downgrade read→delivered etc.); this also makes the handler idempotent.
    if body.log_id and body.message_status:
        rank = {"queued": 0, "sent": 1, "failed": 1, "delivered": 2, "read": 3}
        log = db.query(NotificationLog).filter(NotificationLog.id == body.log_id).first()
        if log and rank.get(body.message_status, 0) >= rank.get(log.status, 0):
            log.status = body.message_status
            if body.error:
                log.error_message = body.error
            log.updated_at = datetime.utcnow()
            db.commit()

    return {"ok": True}
