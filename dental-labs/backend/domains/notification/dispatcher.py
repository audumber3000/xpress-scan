"""
notify_lab_event — the single entry point for sending a lab notification.

Designed to run inside a FastAPI BackgroundTask: it opens its OWN DB session
(never reuses the request's, which is closed by the time this runs), resolves
the lab/client/case by id, decides channels from the lab's notification_settings,
sends via NotificationService, and writes a NotificationLog row per channel.

Config-gated and non-throwing: a missing provider key or template just yields a
`failed` log — it never crashes the background task.
"""
import json
import logging
from typing import Optional

from database import SessionLocal
from core.phone import normalize_phone
from models import Lab, Client, NotificationLog
from models.case import Case
from .service import notification_service
from .templates_wa import build_whatsapp
from .templates_email import build_email

logger = logging.getLogger(__name__)

VALID_EVENTS = {"case_received", "case_dispatched", "case_delivered", "statement_ready"}


def _truncate(value, limit: int = 1000) -> str:
    s = value if isinstance(value, str) else json.dumps(value, default=str)
    return s[:limit]


async def notify_lab_event(
    event_type: str,
    lab_id: int,
    client_id: int,
    case_id: Optional[int] = None,
    extra: Optional[dict] = None,
    channels_override: Optional[list] = None,
):
    """Send a notification for `event_type` to the case's client across enabled channels."""
    if event_type not in VALID_EVENTS:
        logger.warning(f"notify_lab_event: unknown event '{event_type}'")
        return

    extra = extra or {}
    db = SessionLocal()
    try:
        lab = db.query(Lab).filter(Lab.id == lab_id).first()
        client = db.query(Client).filter(Client.id == client_id).first()
        if not lab or not client:
            logger.warning(f"notify_lab_event [{event_type}]: lab/client not found")
            return

        # Which channels for this event? Explicit override > lab settings.
        if channels_override is not None:
            channels = channels_override
        else:
            settings = lab.notification_settings or {}
            channels = settings.get(event_type, [])
        if not channels:
            return

        # Build the template kwargs shared by both channels.
        kwargs = {
            "client_name": client.name,
            "lab_name": lab.name,
            "lab_phone": lab.phone or "",
            **extra,
        }
        if case_id:
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                kwargs["case_number"] = case.case_number
                kwargs["patient_name"] = case.patient_name or ""

        phone = normalize_phone(client.phone, lab.country) if client.phone else ""

        for channel in channels:
            recipient = phone if channel == "whatsapp" else (client.email or "")
            log = NotificationLog(
                lab_id=lab_id,
                case_id=case_id,
                event_type=event_type,
                channel=channel,
                recipient=recipient or "",
                status="queued",
            )
            db.add(log)
            db.commit()
            db.refresh(log)

            try:
                if not recipient:
                    log.status = "failed"
                    log.error = f"client has no {'phone' if channel == 'whatsapp' else 'email'}"
                    db.commit()
                    continue

                if channel == "whatsapp":
                    wa = build_whatsapp(event_type, **kwargs)
                    log.template_name = wa["template_name"]
                    result = await notification_service.send_whatsapp(
                        mobile_number=recipient,
                        template_name=wa["template_name"],
                        components=wa["components"],
                    )
                elif channel == "email":
                    em = build_email(event_type, **kwargs)
                    result = await notification_service.send_email(
                        to_email=recipient,
                        to_name=client.name,
                        subject=em["subject"],
                        html_content=em["html"],
                        attachments=extra.get("attachments"),
                    )
                else:
                    result = {"success": False, "error": f"unsupported channel '{channel}'"}

                log.status = "sent" if result.get("success") else "failed"
                if not result.get("success"):
                    log.error = result.get("error", "unknown error")
                log.provider_response = _truncate(result.get("data") or result)
                db.commit()

            except Exception as exc:  # noqa: BLE001 — must never break the background task
                logger.warning(f"notify_lab_event [{event_type}/{channel}] error: {exc}")
                log.status = "failed"
                log.error = str(exc)
                db.commit()
    finally:
        db.close()
