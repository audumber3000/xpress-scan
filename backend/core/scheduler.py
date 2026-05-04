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
    )

    sched.add_job(
        run_platform_automation_job,
        trigger="cron",
        minute=0,
        id="platform_automation_hourly",
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
