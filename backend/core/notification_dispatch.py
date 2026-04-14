"""
Preference-aware notification dispatcher.
Looks up the clinic's NotificationPreference for the given event_type
and fires nexus_notify for every enabled channel. Safe to call from
any route — never raises.
"""
import re
import logging
import datetime
from sqlalchemy.orm import Session
from core.nexus_notify import notify

logger = logging.getLogger(__name__)


def _clean_phone(phone: str) -> str:
    """Strip non-digits and ensure 91 country prefix for Indian numbers."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def notify_event(
    event_type: str,
    db: Session,
    clinic_id: int,
    to_phone: str = "",
    to_email: str = "",
    to_name: str = "",
    template_data: dict = None,
):
    """
    Check NotificationPreference for the clinic and fire nexus_notify
    for every enabled channel (whatsapp / email / sms).

    Parameters
    ----------
    event_type    : e.g. "appointment_booked", "invoice_notification" …
    db            : active SQLAlchemy session
    clinic_id     : the clinic whose preferences to respect
    to_phone      : patient/recipient phone (raw, will be cleaned)
    to_email      : patient/recipient email
    to_name       : display name for email greeting
    template_data : dict of template variables (see whatsapp_templates.py)
    """
    try:
        from models import NotificationPreference  # local import avoids circular deps

        pref = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.clinic_id == clinic_id,
                NotificationPreference.event_type == event_type,
            )
            .first()
        )

        if not pref or not pref.is_enabled:
            logger.debug(f"notify_event [{event_type}]: disabled or no preference found")
            return

        channels = pref.channels or []
        data = template_data or {}
        phone = _clean_phone(to_phone) if to_phone else ""

        from models import NotificationLog  # avoid circular import

        for channel in channels:
            recipient = phone if channel in ("whatsapp", "sms") else to_email
            if not recipient:
                logger.debug(f"notify_event [{event_type}] {channel}: no recipient, skip")
                continue

            # Write a 'queued' log entry before firing so every send is recorded
            log_entry = NotificationLog(
                clinic_id=clinic_id,
                channel=channel,
                recipient=recipient,
                event_type=event_type,
                template_name=event_type,
                status="queued",
                cost=0.0,
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow(),
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            log_id = log_entry.id

            if channel == "whatsapp":
                notify(event_type, channel="whatsapp", to_phone=phone, template_data=data, log_id=log_id)
            elif channel == "email":
                notify(
                    event_type,
                    channel="email",
                    to_email=to_email,
                    to_name=to_name,
                    template_data=data,
                    log_id=log_id,
                )
            elif channel == "sms":
                notify(event_type, channel="sms", to_phone=phone, template_data=data, log_id=log_id)

    except Exception as exc:
        logger.warning(f"notify_event [{event_type}] dispatch error: {exc}")


def fmt_appt_time(time_str: str) -> str:
    """Convert 'HH:MM' → '10:30 AM' for template variables."""
    try:
        h, m = time_str.split(":")
        h_int = int(h)
        ampm = "AM" if h_int < 12 else "PM"
        h_disp = h_int if 0 < h_int <= 12 else (12 if h_int == 0 else h_int - 12)
        return f"{h_disp}:{m} {ampm}"
    except Exception:
        return time_str
