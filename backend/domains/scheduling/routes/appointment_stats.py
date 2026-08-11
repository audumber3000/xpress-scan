"""
What the appointment book is finally able to say about itself.

None of this was computable before outcomes existed. The no-show rate had no
denominator because nothing was ever marked completed, and lead time was
meaningless because nothing distinguished a booking from an arrival.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import Appointment, DoctorAvailability, User
from domains.scheduling.appointment_status import (CANCELLED, COMPLETED,
                                                   NO_SHOW, OPEN_STATUSES)
from domains.scheduling.availability import to_minutes, working_blocks
from core.roles import CLINICAL_ROLES

router = APIRouter(prefix="/appointment-stats", tags=["appointment-stats"])


@router.get("")
def appointment_stats(
    days: int = Query(90, ge=1, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Headline scheduling numbers over a trailing window."""
    cid = current_user.clinic_id
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    base = db.query(Appointment).filter(
        Appointment.clinic_id == cid,
        Appointment.appointment_date >= start,
        Appointment.appointment_date <= end,
    )

    rows = base.all()
    total = len(rows)
    completed = sum(1 for a in rows if a.status == COMPLETED)
    no_show = sum(1 for a in rows if a.status == NO_SHOW)
    cancelled = sum(1 for a in rows if a.status == CANCELLED)
    still_open = sum(1 for a in rows if a.status in OPEN_STATUSES)

    # Cancellations are excluded from the denominator on purpose: a slot called
    # off in advance can be refilled, which is a different failure from one
    # silently wasted. Mixing them would flatter the number.
    attended_or_not = completed + no_show
    no_show_rate = round(100.0 * no_show / attended_or_not, 1) if attended_or_not else None

    # How far ahead the clinic books. This is the honest measure of whether any
    # of this worked: production sat at 0.5 days, which is an arrivals log
    # rather than a schedule.
    leads = [
        (a.appointment_date.date() - a.created_at.date()).days
        for a in rows if a.created_at and a.appointment_date
    ]
    leads = [d for d in leads if d >= 0]
    avg_lead = round(sum(leads) / len(leads), 1) if leads else None
    same_day = sum(1 for d in leads if d == 0)

    return {
        "window_days": days,
        "total": total,
        "completed": completed,
        "no_show": no_show,
        "cancelled": cancelled,
        "still_open": still_open,
        "no_show_rate": no_show_rate,
        "attendance_base": attended_or_not,
        "avg_lead_days": avg_lead,
        "same_day_share": round(100.0 * same_day / len(leads), 1) if leads else None,
        "booked_minutes": sum(a.duration or 0 for a in rows if a.status not in (CANCELLED,)),
    }


@router.get("/by-doctor")
def stats_by_doctor(
    days: int = Query(90, ge=1, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-dentist attendance and booked time."""
    cid = current_user.clinic_id
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    rows = (
        db.query(
            Appointment.doctor_id,
            func.count(Appointment.id).label("total"),
            func.sum(case((Appointment.status == COMPLETED, 1), else_=0)).label("completed"),
            func.sum(case((Appointment.status == NO_SHOW, 1), else_=0)).label("no_show"),
            func.sum(case((Appointment.status == CANCELLED, 1), else_=0)).label("cancelled"),
            func.sum(case((Appointment.status != CANCELLED, Appointment.duration), else_=0)).label("minutes"),
        )
        .filter(Appointment.clinic_id == cid,
                Appointment.appointment_date >= start,
                Appointment.appointment_date <= end)
        .group_by(Appointment.doctor_id)
        .all()
    )

    names = {
        u.id: (u.name or u.email)
        for u in db.query(User).filter(User.clinic_id == cid).all()
    }

    out = []
    for r in rows:
        base = int(r.completed or 0) + int(r.no_show or 0)
        out.append({
            "doctor_id": r.doctor_id,
            "doctor_name": names.get(r.doctor_id, "Unassigned") if r.doctor_id else "Unassigned",
            "total": int(r.total or 0),
            "completed": int(r.completed or 0),
            "no_show": int(r.no_show or 0),
            "cancelled": int(r.cancelled or 0),
            "booked_minutes": int(r.minutes or 0),
            # None, not 0. A doctor with nothing to measure has no rate, and
            # showing 0% would read as a perfect record.
            "no_show_rate": round(100.0 * int(r.no_show or 0) / base, 1) if base else None,
        })
    out.sort(key=lambda x: x["total"], reverse=True)
    return out


@router.get("/utilisation")
def utilisation(
    on: Optional[date] = None,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Booked minutes against the minutes a doctor is actually available.

    Only doctors with configured working hours appear. A clinic that has never
    set hours has no denominator, and inventing one (say, clinic opening times)
    would produce a confident number that means nothing.
    """
    cid = current_user.clinic_id
    end_day = on or date.today()
    start_day = end_day - timedelta(days=days - 1)

    doctors = (
        db.query(User)
        .filter(User.clinic_id == cid,
                User.role.in_(CLINICAL_ROLES),
                User.is_active == True)  # noqa: E712
        .all()
    )

    appts = (
        db.query(Appointment)
        .filter(Appointment.clinic_id == cid,
                Appointment.status != CANCELLED,
                Appointment.appointment_date >= datetime.combine(start_day, datetime.min.time()),
                Appointment.appointment_date <= datetime.combine(end_day, datetime.max.time()))
        .all()
    )

    out = []
    for d in doctors:
        configured = db.query(DoctorAvailability.id).filter(
            DoctorAvailability.clinic_id == cid,
            DoctorAvailability.doctor_id == d.id,
        ).first() is not None
        if not configured:
            out.append({"doctor_id": d.id, "doctor_name": d.name or d.email,
                        "configured": False, "available_minutes": 0,
                        "booked_minutes": 0, "utilisation": None})
            continue

        available = 0
        cursor = start_day
        while cursor <= end_day:
            available += sum(e - s for s, e in working_blocks(db, cid, d.id, cursor))
            cursor += timedelta(days=1)

        booked = sum(a.duration or 0 for a in appts if a.doctor_id == d.id)
        out.append({
            "doctor_id": d.id,
            "doctor_name": d.name or d.email,
            "configured": True,
            "available_minutes": available,
            "booked_minutes": booked,
            "utilisation": round(100.0 * booked / available, 1) if available else None,
        })

    out.sort(key=lambda x: (x["utilisation"] is None, -(x["utilisation"] or 0)))
    return {"from": start_day.isoformat(), "to": end_day.isoformat(), "doctors": out}


@router.get("/busiest")
def busiest(
    days: int = Query(90, ge=1, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Which hours and weekdays actually fill up, for staffing."""
    cid = current_user.clinic_id
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    rows = (
        db.query(Appointment)
        .filter(Appointment.clinic_id == cid,
                Appointment.status != CANCELLED,
                Appointment.appointment_date >= start,
                Appointment.appointment_date <= end)
        .all()
    )

    by_hour = {h: 0 for h in range(24)}
    by_weekday = {w: 0 for w in range(7)}
    for a in rows:
        by_hour[to_minutes(a.start_time) // 60] += 1
        by_weekday[a.appointment_date.weekday()] += 1

    labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return {
        "by_hour": [{"hour": h, "count": c} for h, c in sorted(by_hour.items()) if c or 7 <= h <= 21],
        "by_weekday": [{"weekday": w, "label": labels[w], "count": by_weekday[w]} for w in range(7)],
    }
