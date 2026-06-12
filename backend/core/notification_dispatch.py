"""
Preference-aware notification dispatcher.
Looks up the clinic's NotificationPreference for the given event_type
and fires nexus_notify for every enabled channel.

Wallet balance is checked before the first send and deducted per channel.
Raises InsufficientWalletBalance (from wallet_service) when funds are low —
callers should catch this and return HTTP 402 to the frontend.
"""
import logging
import datetime
from sqlalchemy.orm import Session
from core.nexus_notify import notify
from core.phone import normalize_phone
from core import wallet_service
from core.wallet_service import InsufficientWalletBalance  # re-export for callers
from core.posthog_client import track_event, EVENTS

logger = logging.getLogger(__name__)


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
    from models import NotificationPreference, NotificationLog, Clinic

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
    # Country-code the recipient using the clinic's country (defaults to IN).
    clinic_country = db.query(Clinic.country).filter(Clinic.id == clinic_id).scalar()
    phone = normalize_phone(to_phone, clinic_country) if to_phone else ""

    # ── WA Reach (own-number WhatsApp) ────────────────────────────────────────
    # Default-off guard: None unless this clinic is Pro AND has connected its own
    # number. When set, WhatsApp goes via their number for free (no wallet) — all
    # other channels and clinics are untouched.
    from domains.notification.services import wareach_service
    wareach = wareach_service.get_active_integration(db, clinic_id)

    # ── Pre-flight wallet check ───────────────────────────────────────────────
    # Calculate total cost for all channels about to fire and verify balance
    # once up front so we either send everything or nothing. WhatsApp is excluded
    # when WA Reach is active (those sends are free).
    total_cost = sum(
        wallet_service.get_cost(ch, event_type)
        for ch in channels
        if (ch == "whatsapp" and phone and not wareach)
        or (ch == "sms" and phone)
        or (ch == "email" and to_email)
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

            # Route WhatsApp via the clinic's own number when WA Reach is active.
            use_wareach = channel == "whatsapp" and wareach is not None

            # Log queued entry before firing
            log_entry = NotificationLog(
                clinic_id=clinic_id,
                channel=channel,
                recipient=recipient,
                event_type=event_type,
                template_name=event_type,
                status="queued",
                cost=0.0,
                provider="wareach" if use_wareach else "msg91",
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow(),
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)

            # WA Reach sends are free — skip the wallet deduction entirely.
            if use_wareach:
                cost = 0.0
            else:
                cost = wallet_service.check_and_deduct(
                    db=db,
                    clinic_id=clinic_id,
                    channel=channel,
                    event_type=event_type,
                    description=f"{event_type} via {channel}",
                )

            # Fire notification
            if channel == "whatsapp":
                if use_wareach:
                    notify(
                        event_type, channel="whatsapp", to_phone=phone, template_data=data, log_id=log_entry.id,
                        provider="wareach", wareach_session_id=wareach.session_id,
                        wareach_api_key=wareach_service.decrypt_key(wareach.api_key_enc),
                    )
                else:
                    notify(event_type, channel="whatsapp", to_phone=phone, template_data=data, log_id=log_entry.id)
            elif channel == "email":
                notify(event_type, channel="email", to_email=to_email, to_name=to_name, template_data=data, log_id=log_entry.id)
            elif channel == "sms":
                notify(event_type, channel="sms", to_phone=phone, template_data=data, log_id=log_entry.id)

            # Update log cost
            log_entry.cost = cost
            log_entry.status = "sent"
            db.commit()

            if channel == "whatsapp":
                track_event(
                    f"clinic_{clinic_id}",
                    EVENTS.WHATSAPP_MESSAGE_SENT,
                    {"provider": "wareach" if use_wareach else "msg91",
                     "event_type": event_type, "paid": not use_wareach},
                    clinic_id=clinic_id,
                )

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
