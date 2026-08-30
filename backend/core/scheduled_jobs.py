"""
APScheduler job callables. Each opens a fresh DB session and closes it.

All timestamps use India Standard Time (IST, UTC+5:30) because:
  - Appointment.appointment_date is stored as naive IST (see appointments.py)
  - Clinic owners and patients operate in IST
  - The APScheduler itself is configured with timezone='Asia/Kolkata'
"""
import logging
import datetime as dt

from core.notification_dispatch import (
    notify_event,
    fmt_appt_time,
    InsufficientWalletBalance,
)
from core.nexus_notify import notify
from core.phone import normalize_phone
from domains.scheduling.appointment_status import OPEN_STATUSES

logger = logging.getLogger(__name__)

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


def _ist_now() -> dt.datetime:
    """Return current time in IST as a naive datetime (matches how data is stored)."""
    return dt.datetime.now(IST).replace(tzinfo=None)


async def run_platform_automation_job() -> None:
    """Hourly: run trial nudges and lab-due-tomorrow reminders.

    Daily/weekly/monthly summaries have their own dedicated cron jobs below.
    """
    from database import SessionLocal
    from domains.notification.services.platform_notification_service import (
        run_platform_notification_automation,
    )

    db = SessionLocal()
    try:
        summary = run_platform_notification_automation(db)
        logger.info("platform_automation hourly: %s", summary)
    except Exception as exc:
        logger.error("platform_automation error: %s", exc)
    finally:
        db.close()


# ── Appointment reminders ────────────────────────────────────────────────────
#
# A patient gets reminded twice, and the two are deliberately different jobs
# rather than one job with a list of offsets.
#
#   appointment_reminder      ~24 hours out. The one that lets somebody
#                             rearrange their day, or call to reschedule.
#   appointment_reminder_2h   ~2 hours out. The one that stops a no-show from
#                             somebody who meant to come and lost the day.
#
# Each tier is its own event_type all the way through: its own NotificationLog
# rows, its own row in Notifications → Preferences, its own wallet spend. That
# matters more than it looks. Sharing one event_type would mean a clinic that
# wants the day-before nudge but not the two-hour one has no way to say so, and
# the dedup guard below could not tell the two apart, so the second reminder
# would look like a duplicate of the first and be dropped.
#
# Both map to the same approved WhatsApp template (mp_appointment_reminder) in
# nexus-service, so the second tier needed no new Meta template registration.

REMINDER_TIERS = {
    # event_type: (lead time, half-width of the catch window, dedup lookback)
    #
    # The window is half-width either side of the lead time, and must be at
    # least half the cron interval or an appointment can fall between two scans
    # and be missed entirely. The scan runs every 15 minutes, so 15 minutes
    # either side gives a 30-minute net with a 15-minute overlap: every
    # appointment is seen at least once, most are seen twice, and the dedup
    # lookback is what stops the second sighting from sending again.
    "appointment_reminder":    (dt.timedelta(hours=24), dt.timedelta(minutes=15), dt.timedelta(hours=6)),
    "appointment_reminder_2h": (dt.timedelta(hours=2),  dt.timedelta(minutes=15), dt.timedelta(hours=2)),
}


def _scan_appointment_reminders(event_type: str) -> None:
    """Send one tier of appointment reminder. Shared body, tier picked by name."""
    from database import SessionLocal
    from models import Appointment, Clinic, NotificationLog

    lead, half_width, dedup_window = REMINDER_TIERS[event_type]

    db = SessionLocal()
    try:
        now = _ist_now()
        window_lo = now + lead - half_width
        window_hi = now + lead + half_width

        appts = (
            db.query(Appointment, Clinic)
            .join(Clinic, Clinic.id == Appointment.clinic_id)
            .filter(Appointment.appointment_date >= window_lo)
            .filter(Appointment.appointment_date < window_hi)
            # Positive list, not a list of exclusions. An excluding filter
            # silently starts reminding people again the moment a new terminal
            # status is added and nobody remembers to add it here.
            .filter(Appointment.status.in_(OPEN_STATUSES))
            .all()
        )

        sent = 0
        for appt, clinic in appts:
            recipients = [r for r in (appt.patient_phone, appt.patient_email) if r]
            if not recipients:
                continue

            # Scoped to this tier's own event_type, so the 24-hour reminder
            # cannot suppress the 2-hour one (and vice versa). Without the
            # event_type filter the two tiers would silently collapse into one.
            already_sent = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == event_type,
                    NotificationLog.recipient.in_(recipients),
                    NotificationLog.created_at >= now - dedup_window,
                )
                .first()
            )
            if already_sent:
                continue

            try:
                notify_event(
                    event_type,
                    db=db,
                    clinic_id=clinic.id,
                    to_phone=appt.patient_phone or "",
                    to_email=appt.patient_email or "",
                    to_name=appt.patient_name,
                    template_data={
                        "patient_name": appt.patient_name,
                        "clinic_name": clinic.name,
                        "appointment_date": appt.appointment_date.strftime("%d %b %Y"),
                        "appointment_time": fmt_appt_time(appt.start_time),
                        "clinic_phone": clinic.phone or "",
                    },
                )
                sent += 1
            except InsufficientWalletBalance:
                logger.info("%s skipped clinic=%s: low balance", event_type, clinic.id)
            except Exception as exc:
                logger.warning("%s error clinic=%s: %s", event_type, clinic.id, exc)

        logger.info("%s_scan: sent=%d scanned=%d", event_type, sent, len(appts))
    except Exception as exc:
        logger.error("%s_scan fatal: %s", event_type, exc)
    finally:
        db.close()


async def appointment_reminder_scan_job() -> None:
    """Every 15 minutes: remind about appointments roughly 24 hours away."""
    _scan_appointment_reminders("appointment_reminder")


async def appointment_reminder_2h_scan_job() -> None:
    """Every 15 minutes: the last nudge, roughly 2 hours before the slot."""
    _scan_appointment_reminders("appointment_reminder_2h")


def _send_system_whatsapp(db, clinic_id: int, to_phone: str, event_type: str, template_data: dict) -> bool:
    """Send a platform-driven WhatsApp notification, bypassing prefs and wallet.

    Daily/weekly/monthly summaries are system notifications — they are part of
    the platform service and are not billed against the clinic's wallet.
    Writes a NotificationLog row so the support tool / UI can surface them.
    """
    from models import NotificationLog, Clinic
    clinic_country = db.query(Clinic.country).filter(Clinic.id == clinic_id).scalar()
    phone = normalize_phone(to_phone, clinic_country)
    if not phone:
        return False
    log_entry = NotificationLog(
        clinic_id=clinic_id,
        channel="whatsapp",
        recipient=phone,
        event_type=event_type,
        template_name=event_type,
        status="queued",
        cost=0.0,
        created_at=dt.datetime.utcnow(),
        updated_at=dt.datetime.utcnow(),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    notify(event_type, channel="whatsapp", to_phone=phone,
           template_data=template_data, log_id=log_entry.id)
    log_entry.status = "sent"
    db.commit()
    return True


def _build_unsubscribe_url(user_id: int) -> str:
    """Build an HMAC-signed unsubscribe URL for email report opt-out."""
    import hmac
    import hashlib
    import os
    import urllib.parse

    secret = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "fallback-secret"))
    token = hmac.new(secret.encode(), str(user_id).encode(), hashlib.sha256).hexdigest()
    base = os.getenv("MAIN_BACKEND_URL", "http://localhost:8000")
    return f"{base}/api/v1/notification-admin/email-reports/unsubscribe?user_id={user_id}&token={token}"


def _email_wrapper(title: str, body_html: str, unsubscribe_url: str) -> str:
    """Wrap email body in a branded MolarPlus HTML template with unsubscribe footer."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{ margin:0; padding:0; background:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1f2937; }}
  .wrapper {{ max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); }}
  .header {{ background:linear-gradient(135deg,#10B981 0%,#059669 100%); padding:32px 24px; text-align:center; }}
  .header h1 {{ color:#ffffff; font-size:22px; margin:0 0 4px; font-weight:700; }}
  .header p {{ color:rgba(255,255,255,0.85); font-size:13px; margin:0; }}
  .body {{ padding:28px 24px; }}
  .stat-row {{ display:flex; gap:12px; margin-bottom:16px; }}
  .stat-card {{ flex:1; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; text-align:center; }}
  .stat-card .label {{ font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:6px; }}
  .stat-card .value {{ font-size:26px; font-weight:700; color:#111827; }}
  .stat-card .change {{ font-size:12px; margin-top:4px; }}
  .up {{ color:#059669; }}
  .down {{ color:#dc2626; }}
  .neutral {{ color:#6b7280; }}
  .section-title {{ font-size:14px; font-weight:600; color:#374151; margin:20px 0 10px; border-bottom:2px solid #10B981; padding-bottom:4px; display:inline-block; }}
  .insight {{ background:#ecfdf5; border-left:4px solid #10B981; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:14px; color:#065f46; }}
  .footer {{ background:#f9fafb; padding:20px 24px; text-align:center; border-top:1px solid #e5e7eb; }}
  .footer p {{ font-size:12px; color:#9ca3af; margin:4px 0; }}
  .footer a {{ color:#10B981; text-decoration:none; }}
  .unsub {{ margin-top:12px; padding-top:12px; border-top:1px solid #e5e7eb; }}
  .unsub a {{ color:#9ca3af; font-size:11px; text-decoration:underline; }}
  @media (max-width:480px) {{
    .stat-row {{ flex-direction:column; }}
    .body {{ padding:20px 16px; }}
  }}
</style>
</head>
<body>
<div style="padding:20px 0;">
<div class="wrapper">
  <div class="header">
    <h1>🦷 MolarPlus</h1>
    <p>{title}</p>
  </div>
  <div class="body">
    {body_html}
  </div>
  <div class="footer">
    <p>Sent by <strong>MolarPlus</strong> — Your Clinic Management Partner</p>
    <p>notification@molarplus.com</p>
    <div class="unsub">
      <a href="{unsubscribe_url}">Unsubscribe from report emails</a>
    </div>
  </div>
</div>
</div>
</body>
</html>"""


def _change_class(change_str: str) -> str:
    """Return CSS class based on change indicator."""
    if "▲" in change_str:
        return "up"
    elif "▼" in change_str:
        return "down"
    return "neutral"


def _build_daily_email_html(data: dict, unsubscribe_url: str) -> str:
    """Build the daily summary email HTML."""
    body = f"""\
<p style="font-size:15px;color:#374151;">Hi <strong>{data.get('doctor_name', 'Doctor')}</strong>, here's your clinic summary for <strong>{data.get('date', 'today')}</strong>.</p>

<div class="stat-row">
  <div class="stat-card">
    <div class="label">Patients</div>
    <div class="value">{data.get('total_patients', 0)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Appointments</div>
    <div class="value">{data.get('total_appointments', 0)}</div>
  </div>
</div>

<div class="stat-row">
  <div class="stat-card">
    <div class="label">Total Revenue</div>
    <div class="value">₹{data.get('total_revenue', 0):,.0f}</div>
  </div>
  <div class="stat-card">
    <div class="label">Cash</div>
    <div class="value">₹{data.get('cash_revenue', 0):,.0f}</div>
  </div>
  <div class="stat-card">
    <div class="label">Online</div>
    <div class="value">₹{data.get('online_revenue', 0):,.0f}</div>
  </div>
</div>

<div class="insight">💡 Keep up the great work! Review your dashboard for detailed insights.</div>
"""
    return _email_wrapper(f"Daily Report — {data.get('clinic_name', 'Your Clinic')}", body, unsubscribe_url)


def _build_weekly_email_html(data: dict, unsubscribe_url: str) -> str:
    """Build the weekly summary email HTML."""
    body = f"""\
<p style="font-size:15px;color:#374151;">Here's your weekly performance for the week of <strong>{data.get('week_date', '')}</strong>.</p>

<div class="stat-row">
  <div class="stat-card">
    <div class="label">Appointments</div>
    <div class="value">{data.get('appointments', 0)}</div>
    <div class="change {_change_class(data.get('appt_change', ''))}">{data.get('appt_change', '—')}</div>
  </div>
  <div class="stat-card">
    <div class="label">New Patients</div>
    <div class="value">{data.get('new_patients', 0)}</div>
    <div class="change {_change_class(data.get('patients_change', ''))}">{data.get('patients_change', '—')}</div>
  </div>
</div>

<div class="stat-row">
  <div class="stat-card">
    <div class="label">Revenue</div>
    <div class="value">₹{data.get('revenue', '0')}</div>
    <div class="change {_change_class(data.get('revenue_change', ''))}">{data.get('revenue_change', '—')}</div>
  </div>
  <div class="stat-card">
    <div class="label">No-Shows</div>
    <div class="value">{data.get('noshows', 0)}</div>
  </div>
</div>

<div class="insight">💡 {data.get('insight', 'Check your dashboard for more details.')}</div>
"""
    return _email_wrapper("Weekly Performance Report", body, unsubscribe_url)


def _build_monthly_email_html(data: dict, unsubscribe_url: str) -> str:
    """Build the monthly summary email HTML."""
    body = f"""\
<p style="font-size:15px;color:#374151;">Here's your monthly summary for <strong>{data.get('month', '')}</strong>.</p>

<div class="section-title">📊 Patient Overview</div>
<div class="stat-row">
  <div class="stat-card">
    <div class="label">Total Patients</div>
    <div class="value">{data.get('total_patients', 0)}</div>
  </div>
  <div class="stat-card">
    <div class="label">New Patients</div>
    <div class="value">{data.get('new_patients', 0)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Returning</div>
    <div class="value">{data.get('returning_patients', 0)}</div>
  </div>
</div>

<div class="section-title">💰 Revenue</div>
<div class="stat-row">
  <div class="stat-card">
    <div class="label">Total Revenue</div>
    <div class="value">₹{data.get('total_revenue', '0')}</div>
    <div class="change {_change_class(data.get('change', ''))}">{data.get('change', '—')} vs last month</div>
  </div>
  <div class="stat-card">
    <div class="label">Avg / Patient</div>
    <div class="value">₹{data.get('avg_revenue', '0')}</div>
  </div>
</div>

<div class="section-title">🦷 Top Treatments</div>
<div class="insight">{data.get('top_treatments', '—')}</div>

<div class="section-title">⚠️ No-Shows</div>
<div class="stat-row">
  <div class="stat-card">
    <div class="label">No-Shows</div>
    <div class="value">{data.get('noshows', 0)}</div>
    <div class="change neutral">{data.get('noshows_pct', 0)}% of appointments</div>
  </div>
</div>
"""
    return _email_wrapper(f"Monthly Summary — {data.get('month', '')}", body, unsubscribe_url)


def _send_system_email(
    db, clinic_id: int, to_email: str, owner_name: str, user_id: int,
    event_type: str, subject: str, html_content: str,
) -> bool:
    """Send a platform-driven email notification, bypassing prefs and wallet.

    Mirrors _send_system_whatsapp but for the email channel.
    Writes a NotificationLog row and fires via nexus_notify.
    """
    from models import NotificationLog

    if not to_email or not to_email.strip():
        return False

    log_entry = NotificationLog(
        clinic_id=clinic_id,
        channel="email",
        recipient=to_email,
        event_type=event_type,
        template_name=event_type,
        status="queued",
        cost=0.0,
        created_at=dt.datetime.utcnow(),
        updated_at=dt.datetime.utcnow(),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    notify(
        event_type,
        channel="email",
        to_email=to_email,
        to_name=owner_name,
        template_data={"subject": subject, "html_content": html_content},
        log_id=log_entry.id,
    )
    log_entry.status = "sent"
    db.commit()
    return True


async def daily_summary_broadcast_job() -> None:
    """Daily at 20:00 IST: send today's stats to clinic owners who asked for it.

    OPT-IN. This is the one system broadcast that reads
    notification_preferences, because it is the one that costs us a WhatsApp
    message per clinic per day whether or not anybody reads it. A clinic with no
    `daily_summary` row, or one switched off, is skipped entirely; the row is
    seeded disabled for new clinics and toggled in Control Center ->
    Notifications -> Preferences.

    Still bypasses the wallet: an owner who opted in is not charged for it.
    Email additionally respects the per-owner report unsubscribe.
    """
    from database import SessionLocal
    from sqlalchemy import func, or_
    from models import (
        Appointment, Clinic, Invoice, User, NotificationLog, NotificationPreference,
    )

    db = SessionLocal()
    try:
        now = _ist_now()
        today = now.date()
        today_start = dt.datetime.combine(today, dt.time.min)
        today_end = today_start + dt.timedelta(days=1)

        clinics = (
            db.query(Clinic)
            .filter(or_(Clinic.status.is_(None), ~Clinic.status.in_(["suspended", "cancelled"])))
            .all()
        )

        # One query for every opted-in clinic rather than one per clinic inside
        # the loop. Maps clinic_id -> the channels it wants this on.
        opted_in = {
            pref.clinic_id: (pref.channels or ["whatsapp"])
            for pref in (
                db.query(NotificationPreference)
                .filter(
                    NotificationPreference.event_type == "daily_summary",
                    NotificationPreference.is_enabled == True,  # noqa: E712
                )
                .all()
            )
        }
        if not opted_in:
            logger.info("daily_summary_broadcast: nobody opted in, nothing sent")
            return

        sent_wa = 0
        sent_email = 0
        for clinic in clinics:
            channels = opted_in.get(clinic.id)
            if not channels:
                continue

            owner = (
                db.query(User)
                .filter(
                    User.clinic_id == clinic.id,
                    User.role == "clinic_owner",
                    User.is_active == True,
                )
                .first()
            )
            if not owner:
                continue

            # Dedup check — per channel
            already_sent_wa = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "daily_summary",
                    NotificationLog.channel == "whatsapp",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )

            total_appts = (
                db.query(func.count(Appointment.id))
                .filter(
                    Appointment.clinic_id == clinic.id,
                    Appointment.appointment_date >= today_start,
                    Appointment.appointment_date < today_end,
                )
                .scalar()
                or 0
            )
            total_patients = (
                db.query(func.count(func.distinct(Appointment.patient_id)))
                .filter(
                    Appointment.clinic_id == clinic.id,
                    Appointment.appointment_date >= today_start,
                    Appointment.appointment_date < today_end,
                )
                .scalar()
                or 0
            )
            invoices = (
                db.query(Invoice)
                .filter(
                    Invoice.clinic_id == clinic.id,
                    Invoice.created_at >= today_start,
                    Invoice.created_at < today_end,
                )
                .all()
            )
            total_revenue = sum((inv.paid_amount or 0.0) for inv in invoices)
            cash_revenue = sum(
                (inv.paid_amount or 0.0)
                for inv in invoices
                if (inv.payment_mode or "").strip().lower() == "cash"
            )
            online_revenue = max(total_revenue - cash_revenue, 0.0)

            template_data = {
                "doctor_name": owner.name or "Doctor",
                "clinic_name": clinic.name,
                "date": today.strftime("%d %b %Y"),
                "total_patients": int(total_patients),
                "total_appointments": int(total_appts),
                "total_revenue": round(float(total_revenue), 2),
                "cash_revenue": round(float(cash_revenue), 2),
                "online_revenue": round(float(online_revenue), 2),
            }

            # ── WhatsApp ──
            if "whatsapp" in channels and not already_sent_wa:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, clinic.phone or "",
                        "daily_summary", template_data,
                    ):
                        sent_wa += 1
                except Exception as exc:
                    logger.warning("daily_summary WA error clinic=%s: %s", clinic.id, exc)

            # ── Email ──
            if (
                "email" in channels
                and owner.email
                and not getattr(owner, "email_report_unsubscribed", False)
            ):
                already_sent_email = (
                    db.query(NotificationLog.id)
                    .filter(
                        NotificationLog.clinic_id == clinic.id,
                        NotificationLog.event_type == "daily_summary",
                        NotificationLog.channel == "email",
                        NotificationLog.created_at >= today_start,
                    )
                    .first()
                )
                if not already_sent_email:
                    try:
                        unsub_url = _build_unsubscribe_url(owner.id)
                        html = _build_daily_email_html(template_data, unsub_url)
                        if _send_system_email(
                            db, clinic.id, owner.email, owner.name or "Doctor",
                            owner.id, "daily_summary",
                            f"📊 Your Daily Report — {clinic.name}", html,
                        ):
                            sent_email += 1
                    except Exception as exc:
                        logger.warning("daily_summary email error clinic=%s: %s", clinic.id, exc)

        logger.info(
            "daily_summary_broadcast: wa=%d email=%d opted_in=%d of %d clinics",
            sent_wa, sent_email, len(opted_in), len(clinics),
        )
    except Exception as exc:
        logger.error("daily_summary_broadcast fatal: %s", exc)
    finally:
        db.close()


async def weekly_summary_broadcast_job() -> None:
    """Sunday 20:00 IST: send last 7 days stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
    Sends WhatsApp + email (if owner has not unsubscribed from email reports).
    """
    from database import SessionLocal
    from sqlalchemy import or_
    from models import Clinic, User, NotificationLog
    from domains.notification.services.report_stats_service import get_weekly_stats

    db = SessionLocal()
    try:
        now = _ist_now()
        today = now.date()
        today_start = dt.datetime.combine(today, dt.time.min)

        clinics = (
            db.query(Clinic)
            .filter(or_(Clinic.status.is_(None), ~Clinic.status.in_(["suspended", "cancelled"])))
            .all()
        )

        sent_wa = 0
        sent_email = 0
        for clinic in clinics:
            # ── WhatsApp ──
            already_sent_wa = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "molarplus_weekly_report_mk",
                    NotificationLog.channel == "whatsapp",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            template_data = get_weekly_stats(db, clinic.id, today)

            if not already_sent_wa:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, clinic.phone or "",
                        "molarplus_weekly_report_mk",
                        template_data,
                    ):
                        sent_wa += 1
                except Exception as exc:
                    logger.warning("weekly_summary WA error clinic=%s: %s", clinic.id, exc)

            # ── Email ──
            owner = (
                db.query(User)
                .filter(User.clinic_id == clinic.id, User.role == "clinic_owner", User.is_active == True)
                .first()
            )
            if owner and owner.email and not getattr(owner, "email_report_unsubscribed", False):
                already_sent_email = (
                    db.query(NotificationLog.id)
                    .filter(
                        NotificationLog.clinic_id == clinic.id,
                        NotificationLog.event_type == "molarplus_weekly_report_mk",
                        NotificationLog.channel == "email",
                        NotificationLog.created_at >= today_start,
                    )
                    .first()
                )
                if not already_sent_email:
                    try:
                        unsub_url = _build_unsubscribe_url(owner.id)
                        html = _build_weekly_email_html(template_data, unsub_url)
                        if _send_system_email(
                            db, clinic.id, owner.email, owner.name or "Doctor",
                            owner.id, "molarplus_weekly_report_mk",
                            f"📈 Weekly Performance — {clinic.name}", html,
                        ):
                            sent_email += 1
                    except Exception as exc:
                        logger.warning("weekly_summary email error clinic=%s: %s", clinic.id, exc)

        logger.info("weekly_summary_broadcast: wa=%d email=%d clinics=%d", sent_wa, sent_email, len(clinics))
    except Exception as exc:
        logger.error("weekly_summary_broadcast fatal: %s", exc)
    finally:
        db.close()


async def monthly_summary_broadcast_job() -> None:
    """Last day of month, 20:00 IST: send last 30 days stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
    Also triggers the review report.
    Sends WhatsApp + email (if owner has not unsubscribed from email reports).
    """
    from database import SessionLocal
    from sqlalchemy import or_
    from models import Clinic, User, NotificationLog
    from domains.notification.services.report_stats_service import (
        get_monthly_stats, get_review_stats,
    )

    db = SessionLocal()
    try:
        now = _ist_now()
        today = now.date()
        today_start = dt.datetime.combine(today, dt.time.min)

        clinics = (
            db.query(Clinic)
            .filter(or_(Clinic.status.is_(None), ~Clinic.status.in_(["suspended", "cancelled"])))
            .all()
        )

        sent_monthly_wa = 0
        sent_monthly_email = 0
        sent_review = 0
        for clinic in clinics:
            phone = clinic.phone or ""

            # ── Monthly WhatsApp ──
            already_monthly_wa = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "molarplus_monthly_report_mk",
                    NotificationLog.channel == "whatsapp",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            monthly_data = get_monthly_stats(db, clinic.id, today)

            if not already_monthly_wa:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, phone,
                        "molarplus_monthly_report_mk",
                        monthly_data,
                    ):
                        sent_monthly_wa += 1
                except Exception as exc:
                    logger.warning("monthly_summary WA error clinic=%s: %s", clinic.id, exc)

            # ── Monthly Email ──
            owner = (
                db.query(User)
                .filter(User.clinic_id == clinic.id, User.role == "clinic_owner", User.is_active == True)
                .first()
            )
            if owner and owner.email and not getattr(owner, "email_report_unsubscribed", False):
                already_monthly_email = (
                    db.query(NotificationLog.id)
                    .filter(
                        NotificationLog.clinic_id == clinic.id,
                        NotificationLog.event_type == "molarplus_monthly_report_mk",
                        NotificationLog.channel == "email",
                        NotificationLog.created_at >= today_start,
                    )
                    .first()
                )
                if not already_monthly_email:
                    try:
                        unsub_url = _build_unsubscribe_url(owner.id)
                        html = _build_monthly_email_html(monthly_data, unsub_url)
                        if _send_system_email(
                            db, clinic.id, owner.email, owner.name or "Doctor",
                            owner.id, "molarplus_monthly_report_mk",
                            f"📋 Monthly Summary — {clinic.name}", html,
                        ):
                            sent_monthly_email += 1
                    except Exception as exc:
                        logger.warning("monthly_summary email error clinic=%s: %s", clinic.id, exc)

            # ── Review Report (WhatsApp only — stays as-is) ──
            already_review = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "molarplus_review_report_mk",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            if not already_review:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, phone,
                        "molarplus_review_report_mk",
                        get_review_stats(db, clinic.id, today),
                    ):
                        sent_review += 1
                except Exception as exc:
                    logger.warning("review_report error clinic=%s: %s", clinic.id, exc)

        logger.info("monthly_summary_broadcast: wa=%d email=%d review=%d clinics=%d",
                    sent_monthly_wa, sent_monthly_email, sent_review, len(clinics))
    except Exception as exc:
        logger.error("monthly_summary_broadcast fatal: %s", exc)
    finally:
        db.close()


# ── Daily motivation push notifications ──────────────────────────────────────

MORNING_MESSAGES = [
    "🌅 Good morning! A great day starts with a great smile. Let's make today count!",
    "☀️ Rise and shine! Every patient you see today is a life you're improving.",
    "🦷 New day, new opportunities. Let's deliver excellence today!",
    "💪 Good morning, team! Stay focused, stay positive, and crush it today.",
    "🌟 Another day to make a difference. You've got this!",
    "🎯 Good morning! Small efforts every day lead to big results.",
    "🚀 Let's start strong today. Your patients are counting on you!",
]

EVENING_MESSAGES = [
    "🌙 Great work today! Rest well, you've earned it.",
    "✨ Another successful day! Thank you for your dedication.",
    "🎉 Day done! You've made patients smile today — that's priceless.",
    "🙌 Well done, team! Tomorrow is a fresh start. Recharge tonight!",
    "💫 Fantastic day! Your hard work doesn't go unnoticed.",
    "🌛 Time to unwind. You gave your best today, and that's all that matters.",
    "👏 Clinic closed for the day. You've all been amazing!",
]


async def morning_motivation_push_job() -> None:
    """Send a motivational push notification to all clinics at start of day."""
    import random
    from database import SessionLocal
    from models import Clinic
    from domains.notification.services.push_service import push_service

    db = SessionLocal()
    try:
        clinics = db.query(Clinic).filter(Clinic.status == 'active').all()
        msg = random.choice(MORNING_MESSAGES)
        sent = 0
        for clinic in clinics:
            result = push_service.send_to_clinic(db, clinic.id, "Good Morning! 🌞", msg, {"type": "motivation_morning"})
            sent += result.get("sent", 0)
        logger.info("morning_motivation_push: sent=%d clinics=%d", sent, len(clinics))
    except Exception as exc:
        logger.error("morning_motivation_push error: %s", exc)
    finally:
        db.close()


async def evening_motivation_push_job() -> None:
    """Send a motivational push notification to all clinics at end of day."""
    import random
    from database import SessionLocal
    from models import Clinic
    from domains.notification.services.push_service import push_service

    db = SessionLocal()
    try:
        clinics = db.query(Clinic).filter(Clinic.status == 'active').all()
        msg = random.choice(EVENING_MESSAGES)
        sent = 0
        for clinic in clinics:
            result = push_service.send_to_clinic(db, clinic.id, "Great Day! 🌙", msg, {"type": "motivation_evening"})
            sent += result.get("sent", 0)
        logger.info("evening_motivation_push: sent=%d clinics=%d", sent, len(clinics))
    except Exception as exc:
        logger.error("evening_motivation_push error: %s", exc)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# In-app notification centre jobs
#
# These run HOURLY and pick their clinics by each clinic's OWN local hour, not
# by the scheduler's. The scheduler is pinned to Asia/Kolkata, so a fixed 8am
# cron would reach a Beirut clinic at half past five in the morning and a
# Toronto one in the middle of the night. `clinic_now()` reads the timezone the
# clinic actually set, which is the same clock its day boundaries already use.
# ─────────────────────────────────────────────────────────────────────────────

MORNING_DIGEST_HOUR = 8    # clinic-local
DAY_CLOSE_HOUR = 20        # clinic-local
DUES_REVIEW_HOUR = 11      # clinic-local
DUES_OVERDUE_DAYS = 14
WALLET_CHECK_HOUR = 9      # clinic-local
PLAN_LIMIT_HOUR = 12       # clinic-local


def _clinics_at_local_hour(db, hour: int):
    """Active clinics whose own local clock is currently in `hour`."""
    from core.clinic_time import clinic_now
    from models import Clinic

    due = []
    for clinic in db.query(Clinic).filter(Clinic.status == "active").all():
        try:
            if clinic_now(clinic).hour == hour:
                due.append(clinic)
        except Exception:
            # A clinic with a broken timezone string should not stop the rest.
            logger.warning("could not read local time for clinic %s", clinic.id)
    return due


async def clinic_morning_digest_job() -> None:
    """Today at a glance, once per clinic, at 8am their time.

    A digest rather than one notification per appointment: the point is to be
    told what the day looks like, not to be pinged twelve times before it
    starts.
    """
    from database import SessionLocal
    from sqlalchemy import func
    from models import Appointment
    from core.clinic_time import clinic_today
    from domains.notification.services.notification_center_service import (
        notify, FRONT_DESK, SEVERITY_INFO,
    )

    db = SessionLocal()
    try:
        for clinic in _clinics_at_local_hour(db, MORNING_DIGEST_HOUR):
            today = clinic_today(clinic)
            rows = (
                db.query(Appointment)
                .filter(
                    Appointment.clinic_id == clinic.id,
                    func.date(Appointment.appointment_date) == today,
                    Appointment.status.in_(list(OPEN_STATUSES)),
                )
                .order_by(Appointment.start_time.asc())
                .all()
            )
            # Nothing booked is not worth a notification. An empty day announces
            # itself by being empty.
            if not rows:
                continue

            first = rows[0].start_time
            notify(
                db,
                clinic_id=clinic.id,
                event_type="morning_digest",
                severity=SEVERITY_INFO,
                audience=FRONT_DESK,
                title=f"{len(rows)} appointment{'s' if len(rows) != 1 else ''} today",
                body=f"First one is at {first}." if first else None,
                link="/appointments",
                entity_type="digest",
                entity_id=int(today.strftime("%Y%m%d")),
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("clinic_morning_digest error: %s", exc)
    finally:
        db.close()


async def clinic_day_close_job() -> None:
    """Billed vs collected for the day, at 8pm clinic-local."""
    from database import SessionLocal
    from sqlalchemy import func
    from models import Invoice
    from core.clinic_time import clinic_today, clinic_day_bounds_utc
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_INFO,
    )

    db = SessionLocal()
    try:
        for clinic in _clinics_at_local_hour(db, DAY_CLOSE_HOUR):
            today = clinic_today(clinic)
            start_utc, end_utc = clinic_day_bounds_utc(clinic, today, today)
            billed, collected = (
                db.query(
                    func.coalesce(func.sum(Invoice.total), 0),
                    func.coalesce(func.sum(Invoice.paid_amount), 0),
                )
                .filter(
                    Invoice.clinic_id == clinic.id,
                    Invoice.created_at >= start_utc,
                    Invoice.created_at < end_utc,
                )
                .one()
            )
            if not billed and not collected:
                continue

            symbol = clinic.currency_symbol or ""
            outstanding = float(billed or 0) - float(collected or 0)
            body = f"Collected {symbol}{float(collected or 0):,.2f} of {symbol}{float(billed or 0):,.2f} billed."
            if outstanding > 0:
                body += f" {symbol}{outstanding:,.2f} still due."

            notify(
                db,
                clinic_id=clinic.id,
                event_type="day_closed",
                severity=SEVERITY_INFO,
                audience=OWNER,
                title="Today's takings",
                body=body,
                link="/reports/daily-register",
                entity_type="digest",
                entity_id=int(today.strftime("%Y%m%d")),
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("clinic_day_close error: %s", exc)
    finally:
        db.close()


async def dues_ageing_job() -> None:
    """Bills still unpaid after DUES_OVERDUE_DAYS, summarised once per clinic.

    One line with a total, not one per patient. A clinic with forty ageing bills
    needs to know the number, and then to go and look at the list.
    """
    from database import SessionLocal
    from sqlalchemy import func
    from models import Invoice
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_ACTION,
    )

    db = SessionLocal()
    try:
        cutoff = dt.datetime.utcnow() - dt.timedelta(days=DUES_OVERDUE_DAYS)
        for clinic in _clinics_at_local_hour(db, DUES_REVIEW_HOUR):
            count, outstanding = (
                db.query(
                    func.count(Invoice.id),
                    func.coalesce(func.sum(Invoice.due_amount), 0),
                )
                .filter(
                    Invoice.clinic_id == clinic.id,
                    Invoice.created_at < cutoff,
                    Invoice.due_amount > 0,
                    Invoice.status.notin_(["paid_verified", "cancelled"]),
                )
                .one()
            )
            if not count or float(outstanding or 0) <= 0:
                continue

            symbol = clinic.currency_symbol or ""
            notify(
                db,
                clinic_id=clinic.id,
                event_type="dues_ageing",
                severity=SEVERITY_ACTION,
                audience=OWNER,
                title=f"{symbol}{float(outstanding):,.2f} outstanding over {DUES_OVERDUE_DAYS} days",
                body=f"Across {count} bill{'s' if count != 1 else ''}.",
                link="/billing",
                entity_type="digest",
                # One per clinic per day, so a daily re-run updates rather than
                # stacks. Reading it and letting the next day's land is the
                # intended rhythm.
                entity_id=int(dt.datetime.utcnow().strftime("%Y%m%d")),
                collapse_minutes=60 * 24,
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("dues_ageing error: %s", exc)
    finally:
        db.close()


async def wallet_low_balance_job() -> None:
    """A wallet about to run dry, said in the app while there is still time.

    Deliberately in-app only. The wallet pays for WhatsApp and email, so a
    clinic that is nearly out of credit is exactly the clinic we cannot reach on
    those channels: the warning would be the send that fails. The notification
    centre costs nothing and pushes to the phone of anyone who has the mobile
    app, which is the one channel an empty wallet cannot switch off.

    Once per clinic per day, at their own 9am, on the same hourly sweep the
    other centre jobs use.
    """
    from database import SessionLocal
    from core.wallet_service import LOW_BALANCE_THRESHOLD, MIN_TOPUP, get_or_create_wallet
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_ACTION,
    )

    db = SessionLocal()
    try:
        for clinic in _clinics_at_local_hour(db, WALLET_CHECK_HOUR):
            wallet = get_or_create_wallet(db, clinic.id)
            balance = float(wallet.balance or 0.0)
            if balance >= LOW_BALANCE_THRESHOLD:
                continue

            symbol = clinic.currency_symbol or ""
            empty = balance <= 0
            notify(
                db,
                clinic_id=clinic.id,
                event_type="wallet_low_balance",
                severity=SEVERITY_ACTION,
                audience=OWNER,
                title=(
                    "Notification balance has run out"
                    if empty
                    else f"Notification balance is low: {symbol}{balance:.2f} left"
                ),
                body=(
                    f"Reminders, invoices and review requests stop going out until you top up. "
                    f"You can add as little as {symbol}{MIN_TOPUP:.0f}."
                    if empty
                    else f"Top up from {symbol}{MIN_TOPUP:.0f} to keep reminders and invoices going out."
                ),
                link="/admin/notifications",
                entity_type="wallet",
                # One per clinic per day. The date keeps yesterday's warning from
                # swallowing today's, so a wallet left empty keeps saying so
                # rather than going quiet after the first morning.
                entity_id=int(dt.datetime.utcnow().strftime("%Y%m%d")),
                collapse_minutes=60 * 24,
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("wallet_low_balance error: %s", exc)
    finally:
        db.close()


async def plan_limit_nudge_job() -> None:
    """A clinic pressing against its plan's limits, said once a month.

    Deliberately not a warning. The pricing page promises that going over a
    limit "doesn't break or delete anything", and nothing in the product
    enforces one, so this is an offer rather than an alarm and its wording has
    to match that or it becomes a lie the clinic can check.

    `entity_id` is the month, so `collapse_minutes` folds every repeat into one
    row and a clinic hears about a given limit once per month however many times
    the hourly sweep sees it. Next month is genuinely new information and gets
    its own line.
    """
    from database import SessionLocal
    from core import plan_usage, plans
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_INFO,
    )

    db = SessionLocal()
    try:
        for clinic in _clinics_at_local_hour(db, PLAN_LIMIT_HOUR):
            try:
                usage = plan_usage.compute(db, clinic)
            except Exception:
                logger.exception("plan usage failed for clinic %s", clinic.id)
                continue

            pressure = plan_usage.pressured(usage)
            if not pressure:
                continue

            # The one it is closest to, not all of them. A list of four bars is
            # a dashboard; one sentence is something somebody acts on.
            worst = pressure[0]
            metric = worst["key"]
            when = " this month" if metric in plan_usage.MONTHLY else ""
            # Already past the limit reads differently from approaching it.
            # "You have used 2 of your 1 branches" is not a sentence.
            over = worst["used"] >= worst["limit"]

            # What the next plan up would actually do about THIS limit. Said in
            # numbers, because "upgrade for more" is not a reason.
            current_rank = plans.rank(usage["plan_name"])
            better = next(
                (
                    key for key, plan in sorted(plans.PLANS.items(), key=lambda kv: kv[1]["rank"])
                    if plan["rank"] > current_rank
                    and (plan["limits"].get(metric) is None
                         or plan["limits"].get(metric, 0) > worst["limit"])
                ),
                None,
            )
            if not better:
                continue   # already on the best plan for this; nothing to offer

            better_limit = plans.PLANS[better]["limits"].get(metric)
            raises_to = "no limit" if better_limit is None else f"{better_limit:,}"

            title = (
                f"{plans.label(usage['plan_name'])} covers "
                f"{worst['limit']:,} {plan_usage.noun(metric, worst['limit'])}{when} "
                f"and you have {worst['used']:,}"
                if over else
                f"You have used {worst['used']:,} of your {worst['limit']:,} "
                f"{plan_usage.noun(metric, worst['limit'])}{when}"
            )

            notify(
                db,
                clinic_id=clinic.id,
                event_type="plan_limit_headroom",
                severity=SEVERITY_INFO,
                audience=OWNER,
                title=title,
                body=(
                    f"Nothing has stopped working. {plans.PLANS[better]['label']} "
                    f"raises this to {raises_to}."
                ),
                link="/admin/subscription",
                entity_type="plan_limit",
                entity_id=int(dt.datetime.utcnow().strftime("%Y%m")),
                collapse_minutes=60 * 24 * 31,
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("plan_limit_nudge error: %s", exc)
    finally:
        db.close()


async def trial_lifecycle_job() -> None:
    """Trial ending in three days, and trial ended.

    Runs hourly but each notification collapses on a per-day entity id, so a
    clinic is told once per stage however often this runs.
    """
    from database import SessionLocal
    from models import Subscription, User
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_ACTION,
    )

    db = SessionLocal()
    try:
        now = dt.datetime.utcnow()
        trials = (
            db.query(Subscription)
            .filter(Subscription.is_trial == True, Subscription.status == "active")  # noqa: E712
            .all()
        )
        for sub in trials:
            if not sub.current_end:
                continue
            clinic_id = sub.clinic_id
            if not clinic_id and sub.user_id:
                owner = db.query(User).filter(User.id == sub.user_id).first()
                clinic_id = getattr(owner, "clinic_id", None)
            if not clinic_id:
                continue

            remaining = (sub.current_end - now).total_seconds() / 86400
            stamp = int(now.strftime("%Y%m%d"))

            if remaining <= 0:
                notify(
                    db, clinic_id=clinic_id, event_type="trial_ended",
                    severity=SEVERITY_ACTION, audience=OWNER,
                    title="Your Pro trial has ended",
                    body=(
                        "You are back on Plus. Nothing has been deleted and your "
                        "clinic keeps working; Pro adds branches and more staff."
                    ),
                    link="/admin/subscription",
                    entity_type="subscription", entity_id=sub.id,
                    collapse_minutes=60 * 24,
                )
                db.commit()
            elif remaining <= 3:
                days = max(1, int(remaining) + 1)
                notify(
                    db, clinic_id=clinic_id, event_type="trial_ending",
                    severity=SEVERITY_ACTION, audience=OWNER,
                    title=f"Trial ends in {days} day{'s' if days != 1 else ''}",
                    body=f"Ends on {sub.current_end.strftime('%d %b')}.",
                    link="/admin/subscription",
                    entity_type="subscription", entity_id=sub.id,
                    collapse_minutes=60 * 24,
                )
                db.commit()
            del stamp
    except Exception as exc:
        db.rollback()
        logger.error("trial_lifecycle error: %s", exc)
    finally:
        db.close()


ACCOUNT_NUDGE_HOUR = 10  # clinic-local


async def account_verification_job() -> None:
    """Nudge a clinic whose security contact is still unverified.

    Sent ONCE per clinic, ever. Deliberately not a collapse window: collapsing
    only folds unread rows, so once somebody read the nudge the next run would
    write a fresh one and the app would nag weekly about a box they chose not
    to tick. Checking for any existing row of this type, read or not, is what
    makes it a reminder rather than a pester.
    """
    from database import SessionLocal
    from models import Notification
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_ACTION,
    )

    db = SessionLocal()
    try:
        for clinic in _clinics_at_local_hour(db, ACCOUNT_NUDGE_HOUR):
            if clinic.security_phone_verified and clinic.security_email_verified:
                continue

            already = (
                db.query(Notification.id)
                .filter(
                    Notification.clinic_id == clinic.id,
                    Notification.event_type == "account_unverified",
                )
                .first()
            )
            if already:
                continue

            missing = []
            if not clinic.security_phone_verified:
                missing.append("phone")
            if not clinic.security_email_verified:
                missing.append("email")

            notify(
                db,
                clinic_id=clinic.id,
                event_type="account_unverified",
                severity=SEVERITY_ACTION,
                audience=OWNER,
                title="Finish verifying your account",
                body=f"Your recovery {' and '.join(missing)} "
                     f"{'is' if len(missing) == 1 else 'are'} not verified yet. "
                     "Without it there is no way back into the account if you are locked out.",
                link="/admin/security",
                entity_type="clinic",
                entity_id=clinic.id,
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("account_verification error: %s", exc)
    finally:
        db.close()
