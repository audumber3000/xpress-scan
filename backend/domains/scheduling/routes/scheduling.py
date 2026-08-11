"""
Doctor hours, leave, free slots, the waitlist, and recurring series.

Everything the calendar needs to stop being a blank grid you type into. All of
it is clinic-scoped through the signed-in user; none of it is public.
"""
import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import (Appointment, AppointmentWaitlist, Clinic, DoctorAvailability,
                    DoctorTimeOff, Patient, TreatmentType, User)
from domains.scheduling.appointment_status import (CANCELLED, OPEN_STATUSES,
                                                   SCHEDULED, normalize_status)
from domains.scheduling.availability import (SLOT_MINUTES, check_available,
                                             find_conflict, free_slots,
                                             to_hhmm, to_minutes, working_blocks)
from core.roles import CLINICAL_ROLES

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


# ── Doctor working hours ─────────────────────────────────────────────────────

class AvailabilityBlock(BaseModel):
    weekday: int          # 0 = Monday
    start_time: str
    end_time: str


class AvailabilityPayload(BaseModel):
    blocks: List[AvailabilityBlock]


@router.get("/availability/{doctor_id}")
def get_availability(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.clinic_id == current_user.clinic_id,
                DoctorAvailability.doctor_id == doctor_id)
        .order_by(DoctorAvailability.weekday, DoctorAvailability.start_time)
        .all()
    )
    off = (
        db.query(DoctorTimeOff)
        .filter(DoctorTimeOff.clinic_id == current_user.clinic_id,
                DoctorTimeOff.doctor_id == doctor_id,
                DoctorTimeOff.end_date >= date.today())
        .order_by(DoctorTimeOff.start_date)
        .all()
    )
    return {
        "doctor_id": doctor_id,
        "configured": len(rows) > 0,
        "blocks": [
            {"id": r.id, "weekday": r.weekday, "start_time": r.start_time, "end_time": r.end_time}
            for r in rows
        ],
        "time_off": [
            {"id": r.id, "start_date": r.start_date.isoformat(), "end_date": r.end_date.isoformat(),
             "start_time": r.start_time, "end_time": r.end_time, "reason": r.reason}
            for r in off
        ],
    }


@router.put("/availability/{doctor_id}")
def set_availability(
    doctor_id: int,
    payload: AvailabilityPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace this doctor's whole week.

    Replace rather than merge: a week is edited as a whole in the UI, and
    diffing individual blocks would leave orphans behind whenever someone
    deletes a shift.
    """
    doctor = db.query(User).filter(
        User.id == doctor_id, User.clinic_id == current_user.clinic_id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="That team member is not in this clinic")

    for b in payload.blocks:
        if not 0 <= b.weekday <= 6:
            raise HTTPException(status_code=400, detail="Weekday must be 0 (Monday) to 6 (Sunday)")
        if to_minutes(b.end_time) <= to_minutes(b.start_time):
            raise HTTPException(
                status_code=400,
                detail=f"End time must be after start time ({b.start_time} to {b.end_time})",
            )

    db.query(DoctorAvailability).filter(
        DoctorAvailability.clinic_id == current_user.clinic_id,
        DoctorAvailability.doctor_id == doctor_id,
    ).delete(synchronize_session=False)

    for b in payload.blocks:
        db.add(DoctorAvailability(
            clinic_id=current_user.clinic_id, doctor_id=doctor_id,
            weekday=b.weekday, start_time=b.start_time, end_time=b.end_time,
        ))
    db.commit()
    return get_availability(doctor_id, db=db, current_user=current_user)


class TimeOffPayload(BaseModel):
    doctor_id: int
    start_date: date
    end_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None


@router.post("/time-off")
def add_time_off(
    payload: TimeOffPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="The last day cannot be before the first")

    row = DoctorTimeOff(
        clinic_id=current_user.clinic_id, doctor_id=payload.doctor_id,
        start_date=payload.start_date, end_date=payload.end_date,
        start_time=payload.start_time, end_time=payload.end_time,
        reason=(payload.reason or "").strip() or None,
        created_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # Bookings already in the diary are not moved or cancelled: that is the
    # clinic's call, not ours. They are counted and reported so somebody knows
    # to ring those patients.
    clashing = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == current_user.clinic_id,
            Appointment.doctor_id == payload.doctor_id,
            Appointment.status.in_(OPEN_STATUSES),
            Appointment.appointment_date >= datetime.combine(payload.start_date, datetime.min.time()),
            Appointment.appointment_date <= datetime.combine(payload.end_date, datetime.max.time()),
        )
        .all()
    )
    return {
        "id": row.id,
        "affected_appointments": [
            {"id": a.id, "patient_name": a.patient_name,
             "appointment_date": a.appointment_date.strftime("%Y-%m-%d"),
             "start_time": a.start_time}
            for a in clashing
        ],
    }


@router.delete("/time-off/{time_off_id}")
def remove_time_off(
    time_off_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(DoctorTimeOff).filter(
        DoctorTimeOff.id == time_off_id,
        DoctorTimeOff.clinic_id == current_user.clinic_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"message": "Time off removed"}


# ── What the grid needs to draw a day ────────────────────────────────────────

@router.get("/day-shape")
def day_shape(
    on: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Working blocks for every doctor on one date, plus the lattice step.

    One request instead of one per doctor: the day view needs all of them at
    once to shade its columns, and N requests for an eight-dentist practice is
    how a calendar starts feeling slow.
    """
    doctors = (
        db.query(User)
        .filter(User.clinic_id == current_user.clinic_id,
                User.role.in_(CLINICAL_ROLES),
                User.is_active == True)  # noqa: E712
        .all()
    )
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()

    out = {}
    for d in doctors:
        blocks = working_blocks(db, current_user.clinic_id, d.id, on)
        configured = db.query(DoctorAvailability.id).filter(
            DoctorAvailability.clinic_id == current_user.clinic_id,
            DoctorAvailability.doctor_id == d.id,
        ).first() is not None
        out[str(d.id)] = {
            "configured": configured,
            "blocks": [{"start": to_hhmm(s), "end": to_hhmm(e)} for s, e in blocks],
        }

    return {
        "date": on.isoformat(),
        "slot_minutes": SLOT_MINUTES,
        "chairs": max(1, int(getattr(clinic, "number_of_chairs", 1) or 1)),
        "doctors": out,
    }


@router.get("/free-slots")
def get_free_slots(
    doctor_id: int,
    on: date,
    duration: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "date": on.isoformat(),
        "doctor_id": doctor_id,
        "duration": duration,
        "slots": free_slots(db, current_user.clinic_id, doctor_id, on, duration),
    }


class CheckSlotPayload(BaseModel):
    doctor_id: Optional[int] = None
    on: date
    start_time: str
    end_time: str
    exclude_id: Optional[int] = None


@router.post("/check-slot")
def check_slot(
    payload: CheckSlotPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Can this slot be booked, and if not, why not.

    Called by the booking form as you change the time, so a clash is caught
    while the booking is still open rather than after it is written.
    """
    reason = check_available(db, current_user.clinic_id, payload.doctor_id,
                             payload.on, payload.start_time, payload.end_time)
    clash = find_conflict(db, current_user.clinic_id, payload.doctor_id, payload.on,
                          payload.start_time, payload.end_time, payload.exclude_id)
    return {
        "ok": reason is None and clash is None,
        "unavailable_reason": reason,
        "conflict": None if not clash else {
            "id": clash.id, "patient_name": clash.patient_name,
            "start_time": clash.start_time, "end_time": clash.end_time,
        },
    }


# ── Recurring series ─────────────────────────────────────────────────────────

class SeriesPayload(BaseModel):
    patient_id: Optional[int] = None
    patient_name: str
    patient_phone: Optional[str] = None
    doctor_id: Optional[int] = None
    treatment: Optional[str] = None
    chair_number: Optional[str] = None
    start_date: date
    start_time: str
    duration: int = 30
    occurrences: int = 3
    interval_days: int = 7


@router.post("/series")
def create_series(
    payload: SeriesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Book a course of treatment in one action.

    A root canal is three visits and each was previously booked from scratch.
    The visits share a `series_id` but are otherwise ordinary appointments, so
    moving or cancelling one does not disturb its siblings.

    Dates that clash or fall outside working hours are reported and skipped
    rather than silently dropped, so nobody discovers visit two is missing a
    fortnight later.
    """
    if not 1 <= payload.occurrences <= 24:
        raise HTTPException(status_code=400, detail="A series can be 1 to 24 visits")
    if payload.interval_days < 1:
        raise HTTPException(status_code=400, detail="Visits must be at least a day apart")

    series_id = uuid.uuid4().hex[:16]
    end_time = to_hhmm(to_minutes(payload.start_time) + payload.duration)

    created, skipped = [], []
    for i in range(payload.occurrences):
        on = payload.start_date + timedelta(days=payload.interval_days * i)

        reason = check_available(db, current_user.clinic_id, payload.doctor_id,
                                 on, payload.start_time, end_time)
        clash = find_conflict(db, current_user.clinic_id, payload.doctor_id,
                              on, payload.start_time, end_time)
        if reason or clash:
            skipped.append({
                "date": on.isoformat(),
                "reason": reason or f"Clashes with {clash.patient_name} at {clash.start_time}",
            })
            continue

        appt = Appointment(
            clinic_id=current_user.clinic_id,
            patient_id=payload.patient_id,
            patient_name=payload.patient_name,
            patient_phone=payload.patient_phone,
            doctor_id=payload.doctor_id,
            treatment=payload.treatment,
            appointment_date=datetime.combine(
                on, datetime.strptime(payload.start_time, "%H:%M").time()
            ),
            start_time=payload.start_time,
            end_time=end_time,
            duration=payload.duration,
            status=SCHEDULED,
            chair_number=payload.chair_number,
            series_id=series_id,
            visit_number=i + 1,
            created_by=current_user.id,
        )
        db.add(appt)
        db.flush()
        created.append({"id": appt.id, "date": on.isoformat(), "visit_number": i + 1})

    db.commit()
    return {"series_id": series_id, "created": created, "skipped": skipped}


@router.get("/series/{series_id}")
def get_series(
    series_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Appointment)
        .filter(Appointment.clinic_id == current_user.clinic_id,
                Appointment.series_id == series_id)
        .order_by(Appointment.appointment_date)
        .all()
    )
    return [
        {"id": a.id, "appointment_date": a.appointment_date.strftime("%Y-%m-%d"),
         "start_time": a.start_time, "status": normalize_status(a.status),
         "visit_number": a.visit_number}
        for a in rows
    ]


# ── Waitlist ─────────────────────────────────────────────────────────────────

class WaitlistPayload(BaseModel):
    patient_id: Optional[int] = None
    patient_name: str
    patient_phone: Optional[str] = None
    doctor_id: Optional[int] = None
    treatment: Optional[str] = None
    duration: int = 30
    preferred_from: Optional[date] = None
    preferred_to: Optional[date] = None
    note: Optional[str] = None


@router.get("/waitlist")
def list_waitlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(AppointmentWaitlist)
        .filter(AppointmentWaitlist.clinic_id == current_user.clinic_id,
                AppointmentWaitlist.status == "waiting")
        .order_by(AppointmentWaitlist.created_at)
        .all()
    )
    return [
        {"id": r.id, "patient_id": r.patient_id, "patient_name": r.patient_name,
         "patient_phone": r.patient_phone, "doctor_id": r.doctor_id,
         "treatment": r.treatment, "duration": r.duration,
         "preferred_from": r.preferred_from.isoformat() if r.preferred_from else None,
         "preferred_to": r.preferred_to.isoformat() if r.preferred_to else None,
         "note": r.note, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.post("/waitlist")
def add_to_waitlist(
    payload: WaitlistPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = AppointmentWaitlist(
        clinic_id=current_user.clinic_id, **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.delete("/waitlist/{entry_id}")
def drop_from_waitlist(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AppointmentWaitlist).filter(
        AppointmentWaitlist.id == entry_id,
        AppointmentWaitlist.clinic_id == current_user.clinic_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.status = "dropped"
    db.commit()
    return {"message": "Removed from the waiting list"}


@router.get("/waitlist/matches")
def waitlist_matches(
    on: date,
    start_time: str,
    duration: int = 30,
    doctor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Who on the list would take this freed-up slot.

    Called when a cancellation opens a gap. Matching is deliberately loose:
    a waitlist entry with no preferred window or no named doctor matches
    anything, because the point is to fill the chair, not to be clever.
    """
    rows = (
        db.query(AppointmentWaitlist)
        .filter(AppointmentWaitlist.clinic_id == current_user.clinic_id,
                AppointmentWaitlist.status == "waiting")
        .order_by(AppointmentWaitlist.created_at)
        .all()
    )
    out = []
    for r in rows:
        if r.preferred_from and on < r.preferred_from:
            continue
        if r.preferred_to and on > r.preferred_to:
            continue
        if r.doctor_id and doctor_id and r.doctor_id != doctor_id:
            continue
        if r.duration > duration:
            continue
        out.append({"id": r.id, "patient_name": r.patient_name,
                    "patient_phone": r.patient_phone, "patient_id": r.patient_id,
                    "treatment": r.treatment, "duration": r.duration})
    return {"date": on.isoformat(), "start_time": start_time, "matches": out}
