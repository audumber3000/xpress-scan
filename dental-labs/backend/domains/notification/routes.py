"""
Notification routes.

Real, self-contained notifications (WhatsApp via MSG91, email via ZeptoMail).
The actual sending happens in dispatcher.notify_lab_event, scheduled as a
background task from the case/billing routes. These endpoints are for
visibility (log, channel status) and a config sanity-check (test send).
"""
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from core.auth import get_current_user, require_lab_owner
from models import LabUser, NotificationLog
from .service import notification_service

router = APIRouter()


@router.get("/log")
def get_notification_log(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    user: LabUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persistent notification log, scoped to the caller's lab."""
    if not user.lab_id:
        return {"notifications": [], "total": 0}

    base = db.query(NotificationLog).filter(NotificationLog.lab_id == user.lab_id)
    total = base.count()
    rows = (
        base.order_by(NotificationLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "notifications": [
            {
                "id": r.id,
                "case_id": r.case_id,
                "event_type": r.event_type,
                "channel": r.channel,
                "recipient": r.recipient,
                "template_name": r.template_name,
                "status": r.status,
                "error": r.error,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/channel-status")
def channel_status(user: LabUser = Depends(get_current_user)):
    """Which channels are configured (provider keys present)."""
    return notification_service.get_channel_status()


class TestSendRequest(BaseModel):
    channel: str  # whatsapp | email
    to_phone: str | None = None
    to_email: str | None = None


@router.post("/test")
async def test_send(
    body: TestSendRequest,
    user: LabUser = Depends(require_lab_owner),
    db: Session = Depends(get_db),
):
    """Owner-only: send a sanity-check message to verify provider config."""
    if body.channel == "whatsapp":
        if not notification_service.whatsapp_configured():
            return {"success": False, "error": "WhatsApp not configured"}
        from .templates_wa import build_whatsapp
        wa = build_whatsapp(
            "case_received",
            client_name="Test", lab_name="MolarPlus Labs",
            case_number="TEST-0001", patient_name="Test Patient", lab_phone="",
        )
        return await notification_service.send_whatsapp(
            mobile_number=(body.to_phone or "").lstrip("+"),
            template_name=wa["template_name"],
            components=wa["components"],
        )
    elif body.channel == "email":
        if not notification_service.email_configured():
            return {"success": False, "error": "Email not configured"}
        from .templates_email import build_email
        em = build_email(
            "case_received",
            client_name="Test", lab_name="MolarPlus Labs",
            case_number="TEST-0001", patient_name="Test Patient", lab_phone="",
        )
        return await notification_service.send_email(
            to_email=body.to_email or "",
            to_name="Test",
            subject=em["subject"],
            html_content=em["html"],
        )
    return {"success": False, "error": f"unsupported channel '{body.channel}'"}
