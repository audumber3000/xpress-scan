"""
Preference-aware notification dispatcher.
Looks up the clinic's NotificationPreference for the given event_type
and fires nexus_notify for every enabled channel.

Wallet balance is checked before the first send and deducted per channel.
A shortfall raises InsufficientWalletBalance only when the caller passes
`required=True`; otherwise the send is skipped and logged. See notify_event.
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


# Events whose templates print an amount, and whose builders therefore accept a
# `currency` kwarg. Kept as an explicit list rather than sent to everything:
# template_data is splatted straight into the builder, and most WhatsApp and
# email builders take fixed keyword arguments, so an unexpected key is a
# TypeError that kills the send.
_MONEY_EVENTS = {"invoice_notification", "receipt_notification", "daily_summary"}


def notify_event(
    event_type: str,
    db: Session,
    clinic_id: int,
    to_phone: str = "",
    to_email: str = "",
    to_name: str = "",
    template_data: dict = None,
    required: bool = False,
):
    """
    Check NotificationPreference for the clinic, verify wallet balance,
    and fire nexus_notify for every enabled channel.

    `required` says whether the message is the point of the caller's request.

    Most sends are a side effect of something else — booking an appointment,
    finalising an invoice — and there an empty wallet must not break the thing
    the clinic actually asked for, so the shortfall is logged and swallowed.
    It used to escape into the route's blanket `except Exception`, which rolled
    back and answered 500 after the commit had already landed: the appointment
    existed, the front desk saw a crash, and booked it a second time.

    When the send IS the request (the Send on WhatsApp buttons), pass
    `required=True` and the shortfall propagates as InsufficientWalletBalance,
    which main.py turns into the 402 the frontend explains. Those routes need an
    `except InsufficientWalletBalance: raise` ahead of their blanket handler,
    for the same reason they already re-raise HTTPException.

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
        # Logged, not just skipped. A send that never happened used to leave no
        # trace at all: the row was written after this gate, so Notification
        # Logs showed nothing and a clinic asking "why didn't the patient get
        # it" had nothing to look at. The commonest cause is exactly this —
        # no preference row, or the event switched off.
        try:
            db.add(NotificationLog(
                clinic_id=clinic_id,
                channel="-",
                recipient=(to_phone or to_email or ""),
                event_type=event_type,
                template_name=event_type,
                status="skipped",
                error_message=("event is switched off for this clinic"
                               if pref else "no preference row for this event"),
                cost=0.0,
                provider="none",
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow(),
            ))
            db.commit()
        except Exception:
            # Never let bookkeeping break the caller's request.
            db.rollback()
        logger.debug(f"notify_event [{event_type}]: disabled or no preference found")
        return

    channels = pref.channels or []
    data = template_data or {}
    # Country-code the recipient using the clinic's country (defaults to IN).
    clinic_row = (
        db.query(Clinic.country, Clinic.currency_symbol)
        .filter(Clinic.id == clinic_id)
        .first()
    )
    clinic_country = clinic_row[0] if clinic_row else None
    phone = normalize_phone(to_phone, clinic_country) if to_phone else ""

    # The clinic's currency, for the handful of templates that print an amount.
    # Deliberately NOT injected into `data` for every event: template_data is
    # splatted straight into the builder, and 30 of the 33 WhatsApp and email
    # builders take fixed keyword arguments with no **kwargs, so an extra key
    # raises TypeError and kills the send. Only the money builders take it, and
    # only their call sites pass it.
    clinic_currency = (clinic_row[1] if clinic_row else None) or "₹"
    if event_type in _MONEY_EVENTS:
        data.setdefault("currency", clinic_currency)

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
            shortfall = InsufficientWalletBalance(needed=total_cost, available=wlt.balance)
            if required:
                raise shortfall
            # A side-effect send. The clinic learns about the empty wallet from
            # wallet_low_balance_job, not by having this request fail.
            logger.info(
                "notify_event [%s] clinic=%s skipped: %s", event_type, clinic_id, shortfall
            )
            return

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

        except InsufficientWalletBalance as exc:
            # The pre-flight already proved the balance covers every channel, so
            # this only fires when a concurrent debit lands mid-loop. Same rule.
            if required:
                raise
            logger.info(
                "notify_event [%s] %s clinic=%s skipped: %s",
                event_type, channel, clinic_id, exc,
            )
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
