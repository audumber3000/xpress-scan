"""
What a clinic is using, measured against what its plan allows.

One module because two things need the identical answer: `GET /subscriptions/usage`,
which draws the meters, and the over-limit nudge job, which notifies off them. A
meter reading 412/500 while a notification claims the limit was passed is the
kind of contradiction that costs more trust than either feature earns.

Two things here are easy to get wrong and are deliberate.

The month is the CLINIC'S month. `clinic_day_bounds_utc` converts its local
calendar month into the UTC bounds the timestamps are actually stored in. A
plain UTC month puts a Toronto clinic's first-of-the-month nine and a half hours
out and quietly misreports every clinic outside India.

Patients and appointments are counted by when the ROW WAS CREATED, not by when
the appointment happens. "500 new patients and appointments a month" on the
pricing page measures intake, and counting scheduled dates would let a clinic
booking a year ahead blow the month it booked in.
"""
import calendar
import logging

from sqlalchemy import func, or_

from core import plans

logger = logging.getLogger(__name__)

# The order the meters are drawn in, and the order the nudge considers them.
METRICS = ("staff", "patients", "appointments", "branches", "storage_gb")

# How full a meter has to be before it is worth saying anything about.
NUDGE_AT = 0.8


def compute(db, clinic) -> dict:
    """Usage for one clinic, keyed by metric, each with its plan limit.

    A limit of None means unlimited and is rendered as such rather than as a
    number nobody can reach.
    """
    from models import (
        Patient, Appointment, PatientDocument, XrayImage, User, user_clinics,
    )

    clinic_id = clinic.id
    from core.clinic_time import clinic_today, clinic_day_bounds_utc

    today = clinic_today(clinic)
    first = today.replace(day=1)
    last = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    start_utc, end_utc = clinic_day_bounds_utc(clinic, first, last)

    def _created_this_month(model):
        return (
            db.query(func.count(model.id))
            .filter(
                model.clinic_id == clinic_id,
                model.created_at >= start_utc,
                model.created_at < end_utc,
            )
            .scalar() or 0
        )

    # Membership is read two ways for the same reason
    # notification_center_service._recipients does it: `users.clinic_id` is the
    # user's current clinic, while user_clinics is the multi-branch membership
    # table, and staff at a clinic with branches may be attached by either.
    staff = (
        db.query(func.count(func.distinct(User.id)))
        .outerjoin(user_clinics, user_clinics.c.user_id == User.id)
        .filter(
            User.is_active == True,  # noqa: E712
            or_(User.clinic_id == clinic_id, user_clinics.c.clinic_id == clinic_id),
        )
        .scalar() or 0
    )

    # Branches are counted per OWNER, not per clinic: the limit is on the account.
    owner_id = (
        db.query(User.id)
        .filter(
            User.clinic_id == clinic_id,
            User.role == "clinic_owner",
            User.is_active == True,  # noqa: E712
        )
        .scalar()
    )
    branches = 1
    if owner_id:
        branches = (
            db.query(func.count(func.distinct(user_clinics.c.clinic_id)))
            .filter(
                user_clinics.c.user_id == owner_id,
                user_clinics.c.role == "clinic_owner",
                user_clinics.c.is_active == True,  # noqa: E712
            )
            .scalar() or 1
        )

    stored_bytes = 0
    for model in (PatientDocument, XrayImage):
        stored_bytes += (
            db.query(func.coalesce(func.sum(model.file_size), 0))
            .filter(model.clinic_id == clinic_id)
            .scalar() or 0
        )

    # The effective plan, which during a trial is the trial's plan. Kept in sync
    # by get_current_subscription, including its auto-downgrade on expiry.
    plan_name = clinic.subscription_plan

    used = {
        "staff": staff,
        "patients": _created_this_month(Patient),
        "appointments": _created_this_month(Appointment),
        "branches": branches,
        "storage_gb": round(stored_bytes / (1024 ** 3), 2),
    }

    return {
        "plan_name": plan_name,
        "plan_label": plans.label(plan_name),
        "period": {"from": first.isoformat(), "to": last.isoformat()},
        "metrics": {
            key: {"used": used[key], "limit": plans.limit(plan_name, key)}
            for key in METRICS
        },
    }


# What each metric is called when it appears in a sentence. Both forms, because
# a limit of 1 is common (Plus covers one branch) and "your 1 branches" is the
# kind of sentence that makes software look unfinished.
LABELS = {
    "staff": "staff logins",
    "patients": "new patients",
    "appointments": "appointments",
    "branches": "branches",
    "storage_gb": "GB of storage",
}

SINGULAR = {
    "staff": "staff login",
    "patients": "new patient",
    "appointments": "appointment",
    "branches": "branch",
    "storage_gb": "GB of storage",
}


def noun(metric: str, count: int) -> str:
    """The right form of the metric's name for this number."""
    return (SINGULAR if count == 1 else LABELS).get(metric, metric)

# Metrics that reset every month, and therefore read as "this month".
MONTHLY = {"patients", "appointments"}


def pressured(usage: dict) -> list[dict]:
    """Metrics at or past NUDGE_AT, worst first.

    Unlimited metrics never appear. Neither does a metric whose limit is 1 and
    whose usage is 1, which is every single-clinic account's branch count: a
    full bar saying "1 of 1" reads as a problem rather than as a fact.
    """
    out = []
    for key, m in usage.get("metrics", {}).items():
        limit, used = m.get("limit"), m.get("used") or 0
        if not limit:
            continue
        if limit == 1 and used <= 1:
            continue
        ratio = used / limit
        if ratio >= NUDGE_AT:
            out.append({"key": key, "used": used, "limit": limit, "ratio": ratio})
    return sorted(out, key=lambda m: m["ratio"], reverse=True)
