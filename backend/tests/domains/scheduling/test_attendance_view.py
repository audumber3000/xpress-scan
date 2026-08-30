"""What one attendance record means, asserted rather than assumed.

Four things on this screen are derived, not stored, and each of them is a claim
about a member of staff that somebody might act on:

  - whether they were late, and by how much
  - how long they were on shift
  - whether THEY clocked in or somebody marked it for them
  - whether the phone was actually at the clinic

Getting any of them subtly wrong produces a screen that looks authoritative and
is not, which is worse than showing nothing. These pin the edges.

In-memory SQLite rather than the postgres fixtures in tests/conftest.py, for the
reason given in test_plan_provisioning: what is under test is pure computation
over a row, identical on either engine, and a unit test that needs a running
database is a unit test that stops being run.
"""
import datetime as dt

import pytest

from domains.scheduling.services.attendance_view import (
    serialize_day,
    summarise,
    fmt_duration,
    day_keys,
)
from models import Attendance, Clinic


OPEN_AT_NINE = {
    "monday":    {"open": "09:00", "close": "18:00", "closed": False},
    "tuesday":   {"open": "09:00", "close": "18:00", "closed": False},
    "wednesday": {"open": "09:00", "close": "18:00", "closed": False},
    "thursday":  {"open": "09:00", "close": "18:00", "closed": False},
    "friday":    {"open": "09:00", "close": "18:00", "closed": False},
    "saturday":  {"open": "08:00", "close": "14:00", "closed": False},
    "sunday":    {"open": "09:00", "close": "18:00", "closed": True},
}


@pytest.fixture()
def clinic():
    """A clinic in India with a pin down and a 150 m fence."""
    return Clinic(
        id=1, name="Test Clinic", timezone="Asia/Kolkata",
        timings=OPEN_AT_NINE, latitude=19.076, longitude=72.877,
        geofence_radius_m=150,
    )


def _record(**kw):
    """An attendance row. Times are UTC, as they are in the database."""
    base = dict(
        id=1, clinic_id=1, user_id=7,
        date=dt.datetime(2026, 8, 24),      # a Monday
        status="on_time", marked_by=None,
        check_in_time=None, check_out_time=None,
        reason=None, notes=None,
        clock_in_latitude=None, clock_in_longitude=None,
        clock_in_accuracy=None, clock_in_address=None, clock_in_distance_m=None,
        clock_out_latitude=None, clock_out_longitude=None,
        clock_out_accuracy=None, clock_out_address=None, clock_out_distance_m=None,
        created_at=dt.datetime(2026, 8, 24, 3, 0),
        updated_at=dt.datetime(2026, 8, 24, 3, 0),
    )
    base.update(kw)
    return Attendance(**base)


# ── Times are read in the clinic's timezone, not the server's ────────────────

def test_stored_utc_is_shown_in_clinic_local_time(clinic):
    # 03:34 UTC is 09:04 in Kolkata. A clinic that opens at 09:00 must see
    # 09:04, not 03:34, or every single staff member reads as absurdly early.
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 3, 34)), clinic)
    assert day["check_in"] == "09:04"


def test_worked_minutes_spans_the_shift(clinic):
    day = serialize_day(_record(
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),    # 09:00 local
        check_out_time=dt.datetime(2026, 8, 24, 12, 45),  # 18:15 local
    ), clinic)
    assert day["worked_minutes"] == 555
    assert fmt_duration(day["worked_minutes"]) == "9h 15m"


def test_open_shift_has_no_duration_and_says_so(clinic):
    """Clocked in, never out. Not zero hours — unknown hours."""
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 3, 30)), clinic)
    assert day["is_open_shift"] is True
    assert day["worked_minutes"] is None
    assert day["check_out"] is None


# ── Late is measured against THIS clinic on THIS weekday ─────────────────────

def test_late_is_measured_against_the_clinic_opening_time(clinic):
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 4, 0)), clinic)  # 09:30
    assert day["expected_open"] == "09:00"
    assert day["late_by_minutes"] == 30


def test_saturday_uses_the_saturday_opening_time(clinic):
    """A clinic that opens at 08:00 on Saturdays must not mark its whole
    Saturday staff an hour late against a weekday 09:00."""
    saturday = _record(
        date=dt.datetime(2026, 8, 29),                    # a Saturday
        check_in_time=dt.datetime(2026, 8, 29, 2, 40),    # 08:10 local
    )
    day = serialize_day(saturday, clinic)
    assert day["expected_open"] == "08:00"
    assert day["late_by_minutes"] == 10


def test_early_arrival_is_zero_late_not_negative(clinic):
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 3, 0)), clinic)  # 08:30
    assert day["late_by_minutes"] == 0


def test_late_is_none_when_the_clinic_is_closed_that_day(clinic):
    """Sunday is closed, so there is no opening time to be late against. None,
    not 0 — zero would claim punctuality nobody can verify."""
    sunday = _record(
        date=dt.datetime(2026, 8, 30),
        check_in_time=dt.datetime(2026, 8, 30, 5, 0),
    )
    day = serialize_day(sunday, clinic)
    assert day["expected_open"] is None
    assert day["late_by_minutes"] is None


def test_late_is_none_when_the_clinic_never_set_its_hours():
    bare = Clinic(id=1, name="No hours", timezone="Asia/Kolkata", timings=None)
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 6, 0)), bare)
    assert day["late_by_minutes"] is None


# ── Who recorded it: the question the whole screen exists for ────────────────

def test_a_phone_clock_in_reads_as_mobile(clinic):
    """The phone leaves marked_by null. That asymmetry is the only way to tell
    a real clock-in from a front-desk mark, so it is asserted here."""
    day = serialize_day(_record(check_in_time=dt.datetime(2026, 8, 24, 3, 30)), clinic)
    assert day["source"] == "mobile"
    assert day["marked_by_name"] is None


def test_a_hand_marked_day_names_who_marked_it(clinic):
    day = serialize_day(
        _record(marked_by=42, check_in_time=None),
        clinic,
        user_names={42: "Reception"},
    )
    assert day["source"] == "manual"
    assert day["marked_by_name"] == "Reception"


def test_an_edited_clock_in_reads_as_manual(clinic):
    """An owner who corrects a clocked-in day takes ownership of it: marked_by
    is stamped, and the day must stop claiming the phone vouched for it."""
    day = serialize_day(
        _record(marked_by=42, check_in_time=dt.datetime(2026, 8, 24, 3, 30)),
        clinic,
        user_names={42: "Dr Mehta"},
    )
    assert day["source"] == "manual"
    assert day["marked_by_name"] == "Dr Mehta"


# ── Location, and the accuracy that qualifies it ─────────────────────────────

def test_a_close_fix_is_inside_the_fence(clinic):
    day = serialize_day(_record(
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),
        clock_in_latitude=19.076, clock_in_longitude=72.877,
        clock_in_distance_m=40.0, clock_in_accuracy=5.0,
    ), clinic)
    assert day["clock_in"]["outside_geofence"] is False
    assert day["clock_in"]["distance_m"] == 40.0


def test_a_far_fix_is_outside_the_fence(clinic):
    day = serialize_day(_record(
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),
        clock_in_latitude=19.1, clock_in_longitude=72.9,
        clock_in_distance_m=900.0, clock_in_accuracy=10.0,
    ), clinic)
    assert day["clock_in"]["outside_geofence"] is True


def test_a_vague_fix_gets_the_benefit_of_its_own_error(clinic):
    """300 m out on a +/- 200 m reading is not evidence of anything. This
    mirrors is_within_clinic_radius, which lets the same fix clock in — the two
    must never disagree about the same reading."""
    day = serialize_day(_record(
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),
        clock_in_latitude=19.08, clock_in_longitude=72.88,
        clock_in_distance_m=300.0, clock_in_accuracy=400.0,
    ), clinic)
    assert day["clock_in"]["outside_geofence"] is False


def test_no_pin_means_no_verdict():
    """A clinic that never dropped its pin cannot call anybody out of bounds."""
    unpinned = Clinic(id=1, name="Unpinned", timezone="Asia/Kolkata", timings=OPEN_AT_NINE)
    day = serialize_day(_record(
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),
        clock_in_latitude=19.076, clock_in_longitude=72.877,
        clock_in_distance_m=None, clock_in_accuracy=8.0,
    ), unpinned)
    assert day["clock_in"]["outside_geofence"] is None


def test_no_location_at_all_omits_the_block(clinic):
    day = serialize_day(_record(marked_by=3), clinic)
    assert day["clock_in"] is None
    assert day["clock_out"] is None


# ── Range totals ─────────────────────────────────────────────────────────────

def test_summary_counts_present_as_on_time_plus_late():
    days = [
        {"status": "on_time", "worked_minutes": 480, "late_by_minutes": 0},
        {"status": "late", "worked_minutes": 420, "late_by_minutes": 25},
        {"status": "late", "worked_minutes": 400, "late_by_minutes": 15},
        {"status": "absent", "worked_minutes": None, "late_by_minutes": None},
        {},          # an unmarked past day
        None,        # a future day
    ]
    s = summarise(days)
    assert s["present"] == 3
    assert s["on_time"] == 1
    assert s["late"] == 2
    assert s["absent"] == 1
    # marked_days means days that actually carry a record. Neither {} (a past
    # day nobody marked) nor None (a future day) is one, so the grid's
    # "present / marked" reads as 3 of 4, not 3 of 6.
    assert s["marked_days"] == 4
    assert s["worked_minutes"] == 1300
    assert s["total_late_minutes"] == 40


def test_fmt_duration_is_blank_for_nothing_worked():
    assert fmt_duration(None) == ""
    assert fmt_duration(0) == ""
    assert fmt_duration(65) == "1h 05m"


def test_day_keys_walks_a_month_boundary():
    keys = day_keys(dt.date(2026, 1, 30), dt.date(2026, 2, 2))
    assert keys == ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]


def test_day_keys_covers_a_leap_february():
    keys = day_keys(dt.date(2028, 2, 1), dt.date(2028, 2, 29))
    assert len(keys) == 29
    assert keys[-1] == "2028-02-29"


# ── The status a phone clock-in gets recorded with ───────────────────────────
#
# This used to be the column default, so every clock-in was 'on_time' however
# late it was, and the owner's grid was a wall of green that said nothing.

def test_a_punctual_clock_in_is_on_time(clinic):
    from domains.scheduling.services.attendance_view import status_for_check_in
    assert status_for_check_in(
        clinic, dt.date(2026, 8, 24), dt.datetime(2026, 8, 24, 3, 25)  # 08:55
    ) == "on_time"


def test_a_late_clock_in_is_recorded_as_late(clinic):
    from domains.scheduling.services.attendance_view import status_for_check_in
    assert status_for_check_in(
        clinic, dt.date(2026, 8, 24), dt.datetime(2026, 8, 24, 5, 12)  # 10:42
    ) == "late"


def test_a_few_minutes_over_is_still_on_time(clinic):
    """Grace, so a phone clock reading 08:03 does not start an argument."""
    from domains.scheduling.services.attendance_view import status_for_check_in
    assert status_for_check_in(
        clinic, dt.date(2026, 8, 24), dt.datetime(2026, 8, 24, 3, 33)  # 09:03
    ) == "on_time"


def test_just_past_the_grace_is_late(clinic):
    from domains.scheduling.services.attendance_view import status_for_check_in
    assert status_for_check_in(
        clinic, dt.date(2026, 8, 24), dt.datetime(2026, 8, 24, 3, 36)  # 09:06
    ) == "late"


def test_a_clinic_with_no_hours_gives_the_benefit_of_the_doubt():
    """Nothing to be late against, so the person who turned up is not blamed."""
    from domains.scheduling.services.attendance_view import status_for_check_in
    bare = Clinic(id=1, name="No hours", timezone="Asia/Kolkata", timings=None)
    assert status_for_check_in(
        bare, dt.date(2026, 8, 24), dt.datetime(2026, 8, 24, 9, 0)
    ) == "on_time"


def test_the_recorded_status_agrees_with_the_late_minutes(clinic):
    """The badge and the number come from the same helper, so a day that reads
    'late' must also report late minutes, and vice versa."""
    from domains.scheduling.services.attendance_view import status_for_check_in
    check_in = dt.datetime(2026, 8, 24, 5, 12)     # 10:42, opens 09:00
    status = status_for_check_in(clinic, dt.date(2026, 8, 24), check_in)
    day = serialize_day(_record(status=status, check_in_time=check_in), clinic)
    assert status == "late"
    assert day["late_by_minutes"] == 102
