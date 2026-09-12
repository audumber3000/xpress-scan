"""Who may read whose attendance, and how a break is counted.

Attendance is pay data: when somebody arrived, how long they stayed, where their
phone was standing. Every read route took `user_id` from the query string and
honoured it, so any signed-in staff member could read a colleague's month. These
pin the rule that replaced that, and the break total the employee screen shows.
"""
import datetime
from types import SimpleNamespace as NS

import pytest

from models import Attendance, User

MONTH = datetime.date.today().strftime("%Y-%m")


def _staff(db, clinic, email="staff@example.com", permissions=None):
    u = User(
        clinic_id=clinic.id, email=email, name="Front Desk", first_name="Front",
        last_name="Desk", role="receptionist", is_active=True, permissions=permissions or {},
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _headers(user):
    from domains.auth.services.auth_service import AuthService
    return {"Authorization": f"Bearer {AuthService(None, None, None).create_jwt_token(user.id)}"}


def _shift(db, clinic, user, day=None, check_in="09:00", breaks=None):
    when = day or datetime.date.today()
    at = datetime.datetime.combine(when, datetime.time(*[int(x) for x in check_in.split(":")]))
    row = Attendance(
        clinic_id=clinic.id, user_id=user.id,
        date=datetime.datetime.combine(when, datetime.time()),
        status="on_time", check_in_time=at, check_out_time=at + datetime.timedelta(hours=8),
        breaks=breaks,
    )
    db.add(row)
    db.commit()
    return row


def _names(payload):
    return sorted(e["name"] for e in payload["employees"])


# ── who sees whom ──────────────────────────────────────────────────────────

def test_the_owner_sees_the_whole_team(client, auth_headers, db_session, test_clinic, test_user):
    rec = _staff(db_session, test_clinic)
    _shift(db_session, test_clinic, rec)
    _shift(db_session, test_clinic, test_user)
    r = client.get(f"/api/v1/attendance/calendar?month={MONTH}", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert _names(r.json()) == sorted([rec.name, test_user.name])


def test_staff_see_only_themselves_however_they_ask(client, db_session, test_clinic, test_user):
    """The gap this closes: `user_id=<the owner>` used to be honoured."""
    rec = _staff(db_session, test_clinic)
    _shift(db_session, test_clinic, rec)
    _shift(db_session, test_clinic, test_user)
    headers = _headers(rec)

    whole_team = client.get(f"/api/v1/attendance/calendar?month={MONTH}", headers=headers).json()
    assert _names(whole_team) == [rec.name]

    someone_else = client.get(
        f"/api/v1/attendance/calendar?month={MONTH}&user_id={test_user.id}", headers=headers).json()
    assert _names(someone_else) == [rec.name]


def test_staff_given_attendance_still_see_the_team(client, db_session, test_clinic, test_user):
    manager = _staff(db_session, test_clinic, email="mgr@example.com",
                     permissions={"attendance": {"read": True}})
    _shift(db_session, test_clinic, test_user)
    _shift(db_session, test_clinic, manager)
    r = client.get(f"/api/v1/attendance/calendar?month={MONTH}", headers=_headers(manager))
    assert _names(r.json()) == sorted([manager.name, test_user.name])


def test_the_week_grid_is_scoped_too(client, db_session, test_clinic, test_user):
    rec = _staff(db_session, test_clinic)
    _shift(db_session, test_clinic, test_user)
    _shift(db_session, test_clinic, rec)
    monday = datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())
    r = client.get(f"/api/v1/attendance/week?week_start={monday}", headers=_headers(rec))
    assert r.status_code == 200, r.text
    assert _names(r.json()) == [rec.name]


def test_the_record_list_is_scoped_too(client, db_session, test_clinic, test_user):
    rec = _staff(db_session, test_clinic)
    _shift(db_session, test_clinic, test_user)
    _shift(db_session, test_clinic, rec)
    rows = client.get(f"/api/v1/attendance?user_id={test_user.id}", headers=_headers(rec)).json()
    assert rows, "the staff member's own day should still come back"
    assert {row["user_id"] for row in rows} == {rec.id}


# ── what a day says ────────────────────────────────────────────────────────

def _day(**over):
    base = dict(
        id=1, status="on_time", reason=None, notes=None, marked_by=None,
        date=datetime.datetime.combine(datetime.date.today(), datetime.time()),
        check_in_time=datetime.datetime(2026, 9, 11, 9, 0),
        check_out_time=datetime.datetime(2026, 9, 11, 17, 0),
        breaks=None,
        clock_in_latitude=None, clock_in_longitude=None, clock_in_accuracy=None,
        clock_in_address=None, clock_in_distance_m=None,
        clock_out_latitude=None, clock_out_longitude=None, clock_out_accuracy=None,
        clock_out_address=None, clock_out_distance_m=None,
    )
    base.update(over)
    return NS(**base)


CLINIC = NS(timezone="Asia/Kolkata", timings=None, geofence_radius_m=150)


@pytest.mark.parametrize("breaks,expected", [
    (None, 0),
    ([], 0),
    ([{"start": "2026-09-11T13:00:00", "end": "2026-09-11T13:20:00"},
      {"start": "2026-09-11T15:00:00", "end": "2026-09-11T15:25:00"}], 45),
    # Left open: it stops at the clock-out rather than running forever.
    ([{"start": "2026-09-11T16:30:00", "end": None}], 30),
    ([{"start": "nonsense"}, "junk", None], 0),
])
def test_a_day_reports_its_break_time(breaks, expected):
    from domains.scheduling.services.attendance_view import serialize_day
    assert serialize_day(_day(breaks=breaks), CLINIC)["break_minutes"] == expected


def test_the_phone_and_the_grid_count_breaks_the_same_way():
    from domains.scheduling.routes.attendance_mobile import break_minutes
    from domains.scheduling.services.attendance_view import serialize_day
    record = _day(breaks=[{"start": "2026-09-11T13:00:00", "end": "2026-09-11T13:45:00"}])
    assert serialize_day(record, CLINIC)["break_minutes"] == break_minutes(record) == 45
