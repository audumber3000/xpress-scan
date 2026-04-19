"""
Preference-aware notification dispatcher.
Looks up the clinic's NotificationPreference for the given event_type
and fires nexus_notify for every enabled channel.

Wallet balance is checked before the first send and deducted per channel.
Raises InsufficientWalletBalance (from wallet_service) when funds are low —
callers should catch this and return HTTP 402 to the frontend.
"""
import re
import logging
import datetime
from sqlalchemy.orm import Session
from core.nexus_notify import notify
from core import wallet_service
from core.wallet_service import InsufficientWalletBalance  # re-export for callers

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
    Check NotificationPreference for the clinic, verify wallet balance,
    and fire nexus_notify for every enabled channel.

    Raises InsufficientWalletBalance if the clinic cannot afford even one channel.
    All other errors are caught and logged so they never break the calling request.
    """
    from models import NotificationPreference, NotificationLog

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

    # ── Pre-flight wallet check ───────────────────────────────────────────────
    # Calculate total cost for all channels about to fire and verify balance
    # once up front so we either send everything or nothing.
    total_cost = sum(
        wallet_service.get_cost(ch, event_type)
        for ch in channels
        if (ch in ("whatsapp", "sms") and phone) or (ch == "email" and to_email)
    )

    if total_cost > 0:
        wlt = wallet_service.get_or_create_wallet(db, clinic_id)
        if wlt.balance < total_cost:
            raise InsufficientWalletBalance(needed=total_cost, available=wlt.balance)

    # ── Send per channel ──────────────────────────────────────────────────────
    for channel in channels:
        try:
            recipient = phone if channel in ("whatsapp", "sms") else to_email
            if not recipient:
                logger.debug(f"notify_event [{event_type}] {channel}: no recipient, skip")
                continue

            # Log queued entry before firing
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

            # Deduct from wallet before firing
            cost = wallet_service.check_and_deduct(
                db=db,
                clinic_id=clinic_id,
                channel=channel,
                event_type=event_type,
                description=f"{event_type} via {channel}",
            )

            # Fire notification
            if channel == "whatsapp":
                notify(event_type, channel="whatsapp", to_phone=phone, template_data=data, log_id=log_entry.id)
            elif channel == "email":
                notify(event_type, channel="email", to_email=to_email, to_name=to_name, template_data=data, log_id=log_entry.id)
            elif channel == "sms":
                notify(event_type, channel="sms", to_phone=phone, template_data=data, log_id=log_entry.id)

            # Update log cost
            log_entry.cost = cost
            log_entry.status = "sent"
            db.commit()

        except InsufficientWalletBalance:
            raise  # let the caller handle this
        except Exception as exc:
            logger.warning(f"notify_event [{event_type}] {channel} error: {exc}")


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
