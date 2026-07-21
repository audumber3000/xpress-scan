"""Clinic-local time helpers.

Timestamps are stored in UTC (server runs on UTC). But "today", day boundaries,
and the default date a payment lands on must follow the *clinic's* timezone, not
the server's UTC day. A payment taken at 1 AM in India (still 7:30 PM UTC the day
before) belongs to the clinic's calendar day, not UTC's.

Every clinic carries a `timezone` (e.g. "Asia/Kolkata"), set from its country at
signup. These helpers resolve it, with a safe fallback for older rows.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

DEFAULT_TZ = "Asia/Kolkata"


def clinic_tzinfo(clinic):
    """ZoneInfo for a clinic, falling back to India if unset or invalid."""
    name = getattr(clinic, "timezone", None) or DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def clinic_now(clinic):
    """Timezone-aware 'now' in the clinic's local time."""
    return datetime.now(clinic_tzinfo(clinic))


def clinic_today(clinic):
    """The clinic's local calendar date right now."""
    return clinic_now(clinic).date()


def clinic_day_bounds_utc(clinic, d_from=None, d_to=None):
    """Convert a clinic-local date range into naive UTC datetime bounds.

    Given calendar dates as the clinic sees them, return (start_utc, end_utc)
    covering [00:00 on d_from ... 24:00 on d_to) in the clinic's timezone,
    expressed as naive UTC datetimes so they compare directly against the
    UTC timestamps stored in the DB. Either bound may be None (open-ended).
    """
    tz = clinic_tzinfo(clinic)

    def _to_utc_naive(local_dt):
        return local_dt.replace(tzinfo=tz).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

    start_utc = _to_utc_naive(datetime.combine(d_from, time.min)) if d_from else None
    # End is exclusive: start of the day after d_to, so the whole d_to day is included.
    end_utc = _to_utc_naive(datetime.combine(d_to + timedelta(days=1), time.min)) if d_to else None
    return start_utc, end_utc
