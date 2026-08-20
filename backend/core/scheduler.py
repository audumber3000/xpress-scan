"""
Persistent background scheduler (APScheduler + SQLAlchemyJobStore).

Jobs are stored in the `apscheduler_jobs` table so they survive restarts.
Recurring cron jobs are re-registered at startup with replace_existing=True
so schedule changes in code take effect on redeploy.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

from database import engine

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(
            jobstores={
                "default": SQLAlchemyJobStore(engine=engine, tablename="apscheduler_jobs"),
            },
            executors={"default": AsyncIOExecutor()},
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 300,
            },
            timezone="Asia/Kolkata",
        )
    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if sched.running:
        return
    sched.start()
    _register_jobs(sched)
    logger.info("APScheduler started with jobs: %s", [j.id for j in sched.get_jobs()])


def shutdown_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def _register_jobs(sched: AsyncIOScheduler) -> None:
    from core.scheduled_jobs import (
        run_platform_automation_job,
        appointment_reminder_scan_job,
        daily_summary_broadcast_job,
        weekly_summary_broadcast_job,
        monthly_summary_broadcast_job,
        morning_motivation_push_job,
        evening_motivation_push_job,
        clinic_morning_digest_job,
        clinic_day_close_job,
        dues_ageing_job,
        trial_lifecycle_job,
        account_verification_job,
    )

    sched.add_job(
        run_platform_automation_job,
        trigger="cron",
        minute=0,
        id="platform_automation_hourly",
        replace_existing=True,
    )

    # Notification-centre jobs.
    #
    # All four run HOURLY on purpose, even though each is conceptually a daily
    # notification. The scheduler is pinned to Asia/Kolkata while clinics are
    # spread across timezones, so a fixed hour here is the wrong hour for most
    # of them. Each job wakes every hour and picks only the clinics whose OWN
    # local clock has reached the target hour. Offset to :05, :10, :15 so four
    # full-table sweeps don't land on the same second as the platform job.
    sched.add_job(
        clinic_morning_digest_job,
        trigger="cron",
        minute=5,
        id="clinic_morning_digest",
        replace_existing=True,
    )

    sched.add_job(
        clinic_day_close_job,
        trigger="cron",
        minute=10,
        id="clinic_day_close",
        replace_existing=True,
    )

    sched.add_job(
        dues_ageing_job,
        trigger="cron",
        minute=15,
        id="clinic_dues_ageing",
        replace_existing=True,
    )

    sched.add_job(
        trial_lifecycle_job,
        trigger="cron",
        minute=20,
        id="clinic_trial_lifecycle",
        replace_existing=True,
    )

    sched.add_job(
        account_verification_job,
        trigger="cron",
        minute=25,
        id="clinic_account_verification",
        replace_existing=True,
    )

    sched.add_job(
        appointment_reminder_scan_job,
        trigger="cron",
        minute="*/15",
        id="appointment_reminder_scan",
        replace_existing=True,
    )

    sched.add_job(
        daily_summary_broadcast_job,
        trigger="cron",
        hour=20,
        minute=0,
        id="daily_summary_broadcast",
        replace_existing=True,
    )

    sched.add_job(
        weekly_summary_broadcast_job,
        trigger="cron",
        day_of_week="sun",
        hour=20,
        minute=0,
        id="weekly_summary_broadcast",
        replace_existing=True,
    )

    # day='last' fires on the actual last day of every month (Feb 28/29, Apr 30, May 31, ...)
    sched.add_job(
        monthly_summary_broadcast_job,
        trigger="cron",
        day="last",
        hour=20,
        minute=0,
        id="monthly_summary_broadcast",
        replace_existing=True,
    )

    # Morning motivation push — 9:00 AM IST daily
    sched.add_job(
        morning_motivation_push_job,
        trigger="cron",
        hour=9,
        minute=0,
        id="morning_motivation_push",
        replace_existing=True,
    )

    # Evening motivation push — 8:00 PM IST daily
    sched.add_job(
        evening_motivation_push_job,
        trigger="cron",
        hour=20,
        minute=0,
        id="evening_motivation_push",
        replace_existing=True,
    )
