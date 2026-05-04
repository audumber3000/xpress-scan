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


def _clean_phone(phone: str) -> str:
    import re
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def _send_system_whatsapp(db, clinic_id: int, to_phone: str, event_type: str, template_data: dict) -> bool:
    """Send a platform-driven WhatsApp notification, bypassing prefs and wallet.

    Daily/weekly/monthly summaries are system notifications — they are part of
    the platform service and are not billed against the clinic's wallet.
    Writes a NotificationLog row so the support tool / UI can surface them.
    """
    from models import NotificationLog
    phone = _clean_phone(to_phone)
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


async def daily_summary_broadcast_job() -> None:
    """Daily at 20:00 IST: send today's stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
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

        sent = 0
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

            already_sent = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "daily_summary",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            if already_sent:
                continue

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

            try:
                if _send_system_whatsapp(
                    db, clinic.id, clinic.phone or "",
                    "daily_summary",
                    {
                        "doctor_name": owner.name or "Doctor",
                        "clinic_name": clinic.name,
                        "date": today.strftime("%d %b %Y"),
                        "total_patients": int(total_patients),
                        "total_appointments": int(total_appts),
                        "total_revenue": round(float(total_revenue), 2),
                        "cash_revenue": round(float(cash_revenue), 2),
                        "online_revenue": round(float(online_revenue), 2),
                    },
                ):
                    sent += 1
            except Exception as exc:
                logger.warning("daily_summary error clinic=%s: %s", clinic.id, exc)

        logger.info("daily_summary_broadcast: sent=%d clinics=%d", sent, len(clinics))
    except Exception as exc:
        logger.error("daily_summary_broadcast fatal: %s", exc)
    finally:
        db.close()


async def weekly_summary_broadcast_job() -> None:
    """Sunday 20:00 IST: send last 7 days stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
    """
    from database import SessionLocal
    from sqlalchemy import or_
    from models import Clinic, NotificationLog
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

        sent = 0
        for clinic in clinics:
            already_sent = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "molarplus_weekly_report_mk",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            if already_sent:
                continue
            try:
                template_data = get_weekly_stats(db, clinic.id, today)
                if _send_system_whatsapp(
                    db, clinic.id, clinic.phone or "",
                    "molarplus_weekly_report_mk",
                    template_data,
                ):
                    sent += 1
            except Exception as exc:
                logger.warning("weekly_summary error clinic=%s: %s", clinic.id, exc)

        logger.info("weekly_summary_broadcast: sent=%d clinics=%d", sent, len(clinics))
    except Exception as exc:
        logger.error("weekly_summary_broadcast fatal: %s", exc)
    finally:
        db.close()


async def monthly_summary_broadcast_job() -> None:
    """Last day of month, 20:00 IST: send last 30 days stats to each clinic owner.

    System notification — bypasses notification_preferences and wallet balance.
    Also triggers the review report.
    """
    from database import SessionLocal
    from sqlalchemy import or_
    from models import Clinic, NotificationLog
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

        sent_monthly = 0
        sent_review = 0
        for clinic in clinics:
            phone = clinic.phone or ""
            already_monthly = (
                db.query(NotificationLog.id)
                .filter(
                    NotificationLog.clinic_id == clinic.id,
                    NotificationLog.event_type == "molarplus_monthly_report_mk",
                    NotificationLog.created_at >= today_start,
                )
                .first()
            )
            if not already_monthly:
                try:
                    if _send_system_whatsapp(
                        db, clinic.id, phone,
                        "molarplus_monthly_report_mk",
                        get_monthly_stats(db, clinic.id, today),
                    ):
                        sent_monthly += 1
                except Exception as exc:
                    logger.warning("monthly_summary error clinic=%s: %s", clinic.id, exc)

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

        logger.info("monthly_summary_broadcast: monthly_sent=%d review_sent=%d clinics=%d",
                    sent_monthly, sent_review, len(clinics))
    except Exception as exc:
        logger.error("monthly_summary_broadcast fatal: %s", exc)
    finally:
        db.close()
