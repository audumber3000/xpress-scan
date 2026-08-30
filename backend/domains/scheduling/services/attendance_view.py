"""What one day of attendance actually says, in one place.

The week grid, the month grid and both export formats all read a day through
`serialize_day` below. That is the point: the moment "late" or "worked hours"
is computed in two places they drift, and the PDF an owner files starts
disagreeing with the screen they filed it from.

── On the clock-in detail ───────────────────────────────────────────────────

A phone clock-in stores more than a time, and an owner reviewing the week needs
most of it. The fields here, and why each earns its place:

  check_in / check_out    The primary fact. Everything else qualifies it.
  worked_minutes          What the day is worth. Derived, never stored, because
                          a stored total goes stale the moment a time is edited.
  late_by_minutes         Measured against the clinic's own opening time for
                          that weekday (Clinic.timings), not a fixed 9 AM. A
                          clinic that opens at 8 on Saturdays should not have
                          its whole Saturday staff marked late.
  source                  'mobile' when the staff member clocked in themselves,
                          'manual' when somebody marked it for them. This is
                          the integrity question — "was she here, or did the
                          front desk say she was?" — and it is the single most
                          useful thing on this screen. It is derived from
                          marked_by, which only the manual path sets.
  marked_by_name          Who did the marking, when it was manual. "Marked
                          present" is a different claim depending on who made
                          it.
  distance_m / accuracy   How far from the clinic pin the phone was, and how
                          much that reading can be trusted. Distance alone is
                          not evidence: 40 m out on a +/- 5 m fix is a
                          different story from 40 m out on a +/- 200 m one, so
                          the two always travel together.
  address                 The reverse-geocoded line, when the phone supplied
                          one. Reads faster than coordinates.
  outside_geofence        Whether the fix sat beyond the clinic's radius once
                          its own error is allowed for. Clock-out is never
                          refused for this (staff leave the building), so this
                          is the only place it surfaces.
  is_open_shift           Clocked in and never out. Usually somebody who forgot,
                          and worth showing as its own state rather than as a
                          blank clock-out that reads like missing data.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from core.clinic_time import clinic_tzinfo

_UTC = ZoneInfo("UTC")

_WEEKDAY_KEYS = [
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday",
]


def _to_clinic_local(dt: datetime, tz) -> datetime | None:
    """A stored timestamp, read in the clinic's timezone.

    Timestamps are written naive and in UTC (the servers run on UTC; see
    core.clinic_time). Naive values are therefore treated as UTC rather than as
    server-local, which is the same assumption every other reader in this
    codebase makes.
    """
    if dt is None:
        return None
    aware = dt.replace(tzinfo=_UTC) if dt.tzinfo is None else dt
    return aware.astimezone(tz)


def _hhmm(dt: datetime | None) -> str | None:
    return dt.strftime("%H:%M") if dt else None


def _opening_time_for(clinic, day) -> str | None:
    """The clinic's opening time on this weekday, as 'HH:MM', or None when the
    clinic is closed that day or has never configured its hours."""
    timings = getattr(clinic, "timings", None) or {}
    if not isinstance(timings, dict):
        return None
    cfg = timings.get(_WEEKDAY_KEYS[day.weekday()])
    if not isinstance(cfg, dict) or cfg.get("closed"):
        return None
    return cfg.get("open") or None


def _late_by_minutes(check_in_local: datetime | None, opening: str | None) -> int | None:
    """Minutes past opening, or None when it cannot be said honestly.

    None rather than 0 when there is no clock-in or no configured opening time.
    Zero would claim the person was punctual; None says we do not know, and the
    UI shows nothing instead of a green tick nobody earned.
    """
    if check_in_local is None or not opening:
        return None
    try:
        hour, minute = (int(x) for x in str(opening).split(":")[:2])
    except (ValueError, TypeError):
        return None
    expected = check_in_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    delta = (check_in_local - expected).total_seconds() / 60
    return int(delta) if delta > 0 else 0


def _outside_geofence(clinic, distance_m, accuracy_m) -> bool | None:
    """Whether a fix sat beyond the clinic's radius, allowing for its own error.

    Mirrors is_within_clinic_radius in attendance_mobile so the two can never
    disagree about the same reading. None when there is no pin or no distance,
    because "not outside" and "we never measured" are different answers.
    """
    if distance_m is None:
        return None
    if getattr(clinic, "latitude", None) is None:
        return None
    radius = getattr(clinic, "geofence_radius_m", None) or 150
    slack = min(float(accuracy_m or 0), 200.0)
    return float(distance_m) > (radius + slack)


# Anything later than this past opening time is recorded as late. Not zero:
# a phone that says 08:00:40 for somebody who walked in at 07:59 should not
# start an argument, and clinics do not run to the second.
LATE_GRACE_MINUTES = 5


def status_for_check_in(clinic, day, check_in_utc) -> str:
    """What a clock-in at this moment should be recorded as.

    Used by the phone clock-in so the stored status means something. It used to
    take the column default and write 'on_time' for everybody, so a staff member
    who arrived 102 minutes after opening produced a green "Present" cell — the
    screen looked authoritative and told the owner nothing, which is the whole
    complaint this feature exists to answer.

    Falls back to 'on_time' when the clinic has no hours set for that day. With
    nothing to be late against, the benefit of the doubt goes to the person who
    turned up.
    """
    if check_in_utc is None:
        return "on_time"
    local = _to_clinic_local(check_in_utc, clinic_tzinfo(clinic))
    late_by = _late_by_minutes(local, _opening_time_for(clinic, day))
    if late_by is None:
        return "on_time"
    return "late" if late_by > LATE_GRACE_MINUTES else "on_time"


def serialize_day(record, clinic, user_names: dict | None = None) -> dict:
    """One attendance record as the grids and exports read it."""
    tz = clinic_tzinfo(clinic)
    check_in = _to_clinic_local(record.check_in_time, tz)
    check_out = _to_clinic_local(record.check_out_time, tz)

    worked_minutes = None
    if check_in and check_out and check_out > check_in:
        worked_minutes = int((check_out - check_in).total_seconds() // 60)

    day = record.date.date() if isinstance(record.date, datetime) else record.date
    opening = _opening_time_for(clinic, day)

    # marked_by is set by the manual path only; the phone leaves it null. That
    # asymmetry is what makes this derivable at all, so it is asserted here
    # rather than left implicit at each call site.
    is_manual = record.marked_by is not None
    marker_name = (user_names or {}).get(record.marked_by) if is_manual else None

    return {
        "id": record.id,
        "status": record.status,
        "reason": record.reason or "",
        "notes": record.notes or "",
        "check_in": _hhmm(check_in),
        "check_out": _hhmm(check_out),
        "worked_minutes": worked_minutes,
        "expected_open": opening,
        "late_by_minutes": _late_by_minutes(check_in, opening),
        "is_open_shift": bool(check_in and not check_out),
        "source": "manual" if is_manual else ("mobile" if check_in else "manual"),
        "marked_by_name": marker_name,
        "clock_in": {
            "latitude": record.clock_in_latitude,
            "longitude": record.clock_in_longitude,
            "accuracy_m": record.clock_in_accuracy,
            "distance_m": record.clock_in_distance_m,
            "address": record.clock_in_address,
            "outside_geofence": _outside_geofence(
                clinic, record.clock_in_distance_m, record.clock_in_accuracy
            ),
        } if record.clock_in_latitude is not None else None,
        "clock_out": {
            "latitude": record.clock_out_latitude,
            "longitude": record.clock_out_longitude,
            "accuracy_m": record.clock_out_accuracy,
            "distance_m": record.clock_out_distance_m,
            "address": record.clock_out_address,
            "outside_geofence": _outside_geofence(
                clinic, record.clock_out_distance_m, record.clock_out_accuracy
            ),
        } if record.clock_out_latitude is not None else None,
    }


def summarise(days: list) -> dict:
    """Per-employee totals for a range. Counts only days that were marked.

    `present` counts on_time and late together, because for a payroll total the
    question is how many days somebody turned up, not how punctually.
    """
    marked = [d for d in days if d]
    worked = [d["worked_minutes"] for d in marked if d.get("worked_minutes")]
    late_days = [d for d in marked if d.get("status") == "late"]
    return {
        "marked_days": len(marked),
        "on_time": sum(1 for d in marked if d.get("status") == "on_time"),
        "late": len(late_days),
        "absent": sum(1 for d in marked if d.get("status") == "absent"),
        "holiday": sum(1 for d in marked if d.get("status") == "holiday"),
        "present": sum(1 for d in marked if d.get("status") in ("on_time", "late")),
        "worked_minutes": sum(worked),
        "total_late_minutes": sum(d.get("late_by_minutes") or 0 for d in late_days),
    }


def fmt_duration(minutes) -> str:
    """'7h 30m' — the shape a timesheet is read in. Empty for nothing worked."""
    if not minutes:
        return ""
    return f"{int(minutes) // 60}h {int(minutes) % 60:02d}m"


def day_keys(start, end):
    """Every calendar day in [start, end], inclusive, as YYYY-MM-DD strings."""
    out, cur = [], start
    while cur <= end:
        out.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return out
