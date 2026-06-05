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


async def appointment_reminder_scan_job() -> None:
    """Every 15 minutes: send reminders for appointments ~24 hours away."""
    from database import SessionLocal
    from models import Appointment, Clinic, NotificationLog

    db = SessionLocal()
    try:
        now = _ist_now()
        window_lo = now + dt.timedelta(hours=23, minutes=45)
        window_hi = now + dt.timedelta(hours=24, minutes=15)

        appts = (
            db.query(Appointment, Clinic)
            .join(Clinic, Clinic.id == Appointment.clinic_id)
            .filter(Appointment.appointment_date >= window_lo)
            .filter(Appointment.appointment_date < window_hi)
            .filter(~Appointment.status.in_(["cancelled", "rejected", "no_show", "completed"]))
            .all()
        )

        sent = 0
        for appt, clinic in appts:
            recipients = [r for r in (appt.patient_phone, appt.patient_email) if r]
            if not recipients:
                continue

            already_sent = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "appointment_reminder",
                    NotificationLog.recipient.in_(recipients),
                    NotificationLog.created_at >= now - dt.timedelta(hours=6),
                )
                .first()
            )
            if already_sent:
                continue

            try:
                notify_event(
                    "appointment_reminder",
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
                logger.info("appointment_reminder skipped clinic=%s: low balance", clinic.id)
            except Exception as exc:
                logger.warning("appointment_reminder error clinic=%s: %s", clinic.id, exc)

        logger.info("appointment_reminder_scan: sent=%d scanned=%d", sent, len(appts))
    except Exception as exc:
        logger.error("appointment_reminder_scan fatal: %s", exc)
    finally:
        db.close()


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
    """Daily at 20:00 IST: send today's stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
    Sends WhatsApp + email (if owner has not unsubscribed from email reports).
    """
    from database import SessionLocal
    from sqlalchemy import func, or_
    from models import Appointment, Clinic, Invoice, User, NotificationLog

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

        sent_wa = 0
        sent_email = 0
        for clinic in clinics:
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
            if not already_sent_wa:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, clinic.phone or "",
                        "daily_summary", template_data,
                    ):
                        sent_wa += 1
                except Exception as exc:
                    logger.warning("daily_summary WA error clinic=%s: %s", clinic.id, exc)

            # ── Email ──
            if owner.email and not getattr(owner, "email_report_unsubscribed", False):
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

        logger.info("daily_summary_broadcast: wa=%d email=%d clinics=%d", sent_wa, sent_email, len(clinics))
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
