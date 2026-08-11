"""
Who is actually available, and when.

The calendar greys out unavailable time, but greying out is only a hint. Every
check here also runs on the server before a booking is written, because a UI
affordance is not a rule: an API call, the mobile app, or the public booking
page must not be able to put a patient in front of a dentist who is on leave.
"""
from datetime import date, datetime, time
from typing import Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from models import Appointment, DoctorAvailability, DoctorTimeOff
from domains.scheduling.appointment_status import OPEN_STATUSES

# The lattice the whole calendar snaps to. 15 is the grid, not a rule: the
# booking form still accepts any start and any duration, so a 20 minute review
# saves as 20 minutes and simply renders at its true height between the lines.
SLOT_MINUTES = 15


def to_minutes(hhmm: str | None) -> int:
    """"09:30" -> 570. Tolerant of junk, because this is fed by stored strings."""
    if not hhmm:
        return 0
    try:
        parts = str(hhmm).split(":")
        return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)
    except (ValueError, IndexError):
        return 0


def to_hhmm(minutes: int) -> str:
    minutes = max(0, min(24 * 60 - 1, int(minutes)))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def snap(minutes: int, step: int = SLOT_MINUTES) -> int:
    """Round to the nearest lattice line."""
    return int(round(minutes / step) * step)


def overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    """Half-open intervals: an appointment ending at 10:00 does not clash with
    one starting at 10:00, which is the whole point of back-to-back booking."""
    return a_start < b_end and b_start < a_end


# ── Working hours ────────────────────────────────────────────────────────────

def working_blocks(db: Session, clinic_id: int, doctor_id: int, on: date) -> List[Tuple[int, int]]:
    """The minute ranges this doctor works on this date, leave already removed.

    An empty list means not available at all that day, which is different from
    "no availability configured": see `has_availability`.
    """
    rows = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.clinic_id == clinic_id,
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.weekday == on.weekday(),
        )
        .all()
    )
    blocks = sorted((to_minutes(r.start_time), to_minutes(r.end_time)) for r in rows)
    blocks = [(s, e) for s, e in blocks if e > s]
    if not blocks:
        return []

    for off in time_off_on(db, clinic_id, doctor_id, on):
        blocks = _subtract(blocks, off)
    return blocks


def time_off_on(db: Session, clinic_id: int, doctor_id: int, on: date) -> List[Tuple[int, int]]:
    """Leave ranges that touch this date, as minute ranges."""
    rows = (
        db.query(DoctorTimeOff)
        .filter(
            DoctorTimeOff.clinic_id == clinic_id,
            DoctorTimeOff.doctor_id == doctor_id,
            DoctorTimeOff.start_date <= on,
            DoctorTimeOff.end_date >= on,
        )
        .all()
    )
    out = []
    for r in rows:
        # No times means the whole day. A part-day range only applies to its own
        # first and last day; the days in between are off entirely.
        if not r.start_time and not r.end_time:
            out.append((0, 24 * 60))
        else:
            out.append((to_minutes(r.start_time) if r.start_time else 0,
                        to_minutes(r.end_time) if r.end_time else 24 * 60))
    return out


def _subtract(blocks: List[Tuple[int, int]], cut: Tuple[int, int]) -> List[Tuple[int, int]]:
    """Remove one range from a list of ranges, splitting where it lands inside."""
    cut_s, cut_e = cut
    out = []
    for s, e in blocks:
        if cut_e <= s or cut_s >= e:
            out.append((s, e))
            continue
        if s < cut_s:
            out.append((s, cut_s))
        if cut_e < e:
            out.append((cut_e, e))
    return [(s, e) for s, e in out if e > s]


def has_availability(db: Session, clinic_id: int, doctor_id: int) -> bool:
    """Whether this doctor has any working hours configured at all.

    The distinction matters. A clinic that has never set up hours must not have
    every booking refused, so callers treat "not configured" as "no opinion"
    and only enforce once someone has actually said when a dentist works.
    """
    return db.query(DoctorAvailability.id).filter(
        DoctorAvailability.clinic_id == clinic_id,
        DoctorAvailability.doctor_id == doctor_id,
    ).first() is not None


def check_available(
    db: Session, clinic_id: int, doctor_id: Optional[int],
    on: date, start: str, end: str,
) -> Optional[str]:
    """Why this slot cannot be booked, or None if it can.

    Returns a sentence fit to show a receptionist, not an error code.
    """
    if not doctor_id:
        return None  # Unassigned bookings are a deliberate holding state.
    if not has_availability(db, clinic_id, doctor_id):
        return None  # Nobody has said when this doctor works, so we do not guess.

    s, e = to_minutes(start), to_minutes(end)
    blocks = working_blocks(db, clinic_id, doctor_id, on)
    if not blocks:
        for off in time_off_on(db, clinic_id, doctor_id, on):
            if off == (0, 24 * 60):
                return "That doctor is away on this date"
        return "That doctor does not work on this day"

    if any(bs <= s and e <= be for bs, be in blocks):
        return None

    readable = ", ".join(f"{to_hhmm(bs)} to {to_hhmm(be)}" for bs, be in blocks)
    return f"Outside working hours. Available {readable}"


# ── Clashes ──────────────────────────────────────────────────────────────────

def find_conflict(
    db: Session, clinic_id: int, doctor_id: Optional[int],
    on: date, start: str, end: str, exclude_id: Optional[int] = None,
) -> Optional[Appointment]:
    """An existing open appointment for the same doctor that overlaps this one.

    Cancelled and completed appointments never block a slot, which is what
    makes a freed-up cancellation reusable.
    """
    s, e = to_minutes(start), to_minutes(end)
    q = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.status.in_(OPEN_STATUSES),
            Appointment.appointment_date >= datetime.combine(on, time.min),
            Appointment.appointment_date <= datetime.combine(on, time.max),
        )
    )
    # Two bookings only clash if they are for the same resource. Different
    # doctors do not collide, and an unassigned booking only collides with
    # other unassigned ones, since reception will allocate it later.
    q = q.filter(Appointment.doctor_id == doctor_id) if doctor_id else \
        q.filter(Appointment.doctor_id.is_(None))
    if exclude_id:
        q = q.filter(Appointment.id != exclude_id)

    for appt in q.all():
        if overlaps(s, e, to_minutes(appt.start_time), to_minutes(appt.end_time)):
            return appt
    return None


def free_slots(
    db: Session, clinic_id: int, doctor_id: int, on: date, duration: int,
) -> List[str]:
    """Every lattice-aligned start time that would fit `duration` minutes."""
    blocks = working_blocks(db, clinic_id, doctor_id, on)
    if not blocks:
        return []

    taken = []
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_(OPEN_STATUSES),
            Appointment.appointment_date >= datetime.combine(on, time.min),
            Appointment.appointment_date <= datetime.combine(on, time.max),
        )
        .all()
    )
    for a in rows:
        taken.append((to_minutes(a.start_time), to_minutes(a.end_time)))

    out = []
    for bs, be in blocks:
        cursor = snap(bs)
        if cursor < bs:
            cursor += SLOT_MINUTES
        while cursor + duration <= be:
            if not any(overlaps(cursor, cursor + duration, ts, te) for ts, te in taken):
                out.append(to_hhmm(cursor))
            cursor += SLOT_MINUTES
    return out
