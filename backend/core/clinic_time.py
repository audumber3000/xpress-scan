"""Clinic-local time helpers.

Timestamps are stored in UTC (server runs on UTC). But "today", day boundaries,
and the default date a payment lands on must follow the *clinic's* timezone, not
the server's UTC day. A payment taken at 1 AM in India (still 7:30 PM UTC the day
before) belongs to the clinic's calendar day, not UTC's.

Every clinic carries a `timezone` (e.g. "Asia/Kolkata"), set from its country at
signup. These helpers resolve it, with a safe fallback for older rows.
"""
from datetime import datetime
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
