"""The range loader behind the week grid, the month grid and both exports.

Three behaviours here are easy to get wrong and expensive when wrong:

  1. A future day, an unmarked past day and a marked day must stay three
     distinguishable things. Collapse any two and the grid either invites you
     to mark tomorrow or shows today as already settled.
  2. A day can hold more than one attendance row, because the phone opens a
     fresh record on a second clock-in. Picking the wrong one shows a finished
     shift for somebody who is still on the floor.
  3. The range is inclusive at both ends. An off-by-one here silently drops the
     last day of every month from the register an owner files.

In-memory SQLite, per the convention set in test_plan_provisioning.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.clinic_time import clinic_today
from domains.scheduling.routes.attendance import _build_range, _resolve_range
from fastapi import HTTPException
from models import Base, Attendance, Clinic, User


TIMINGS = {
    d: {"open": "09:00", "close": "18:00", "closed": False}
    for d in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
}


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def clinic(db):
    c = Clinic(
        name="Range Clinic", email="r@c.com", specialization="dental",
        timezone="Asia/Kolkata", timings=TIMINGS,
        latitude=19.076, longitude=72.877, geofence_radius_m=150,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def staff(db, clinic):
    users = [
        User(name="Asha", first_name="Asha", last_name="R", email="asha@c.com",
             role="receptionist", clinic_id=clinic.id, is_active=True),
        User(name="Bela", first_name="Bela", last_name="S", email="bela@c.com",
             role="assistant", clinic_id=clinic.id, is_active=True),
    ]
    db.add_all(users)
    db.commit()
    for u in users:
        db.refresh(u)
    return users


def _today(clinic):
    """The CLINIC's today, not the machine's.

    The boundary between "not marked yet" and "has not happened yet" is the
    clinic's own calendar day, so a test that anchors on the server's date
    fails for anybody running it in a timezone behind India — which is exactly
    what happened the first time these were run, and exactly the bug the
    loader is written to avoid.
    """
    return clinic_today(clinic)


def test_future_days_are_null_and_past_days_are_empty(db, clinic, staff):
    """Three states, three values: None ahead, {} behind, a dict when marked."""
    today = _today(clinic)
    data = _build_range(db, clinic, today - dt.timedelta(days=2), today + dt.timedelta(days=2))

    asha = data["employees"][0]
    assert asha["attendance"][(today - dt.timedelta(days=2)).isoformat()] == {}
    assert asha["attendance"][(today + dt.timedelta(days=1)).isoformat()] is None
    assert asha["attendance"][(today + dt.timedelta(days=2)).isoformat()] is None


def test_the_future_boundary_follows_the_clinic_timezone(db, clinic, staff):
    """A clinic in Kolkata rolls over to tomorrow 5.5 hours before UTC does.
    During that window the server's date is still yesterday, and a loader that
    used it would show the clinic's today as an unmarkable future day."""
    ist_today = clinic_today(clinic)
    data = _build_range(db, clinic, ist_today, ist_today + dt.timedelta(days=1))

    cells = data["employees"][0]["attendance"]
    assert cells[ist_today.isoformat()] == {}                              # markable
    assert cells[(ist_today + dt.timedelta(days=1)).isoformat()] is None   # not yet


def test_range_is_inclusive_of_both_ends(db, clinic, staff):
    start = dt.date(2026, 2, 1)
    end = dt.date(2026, 2, 28)
    data = _build_range(db, clinic, start, end)
    assert len(data["days"]) == 28
    assert data["days"][0] == "2026-02-01"
    assert data["days"][-1] == "2026-02-28"


def test_a_marked_day_carries_its_record(db, clinic, staff):
    today = _today(clinic)
    day = today - dt.timedelta(days=1)
    db.add(Attendance(
        clinic_id=clinic.id, user_id=staff[0].id,
        date=dt.datetime.combine(day, dt.time.min),
        status="late", reason="Traffic",
        check_in_time=dt.datetime.combine(day, dt.time(4, 15)),   # 09:45 local
        check_out_time=dt.datetime.combine(day, dt.time(12, 30)),
    ))
    db.commit()

    data = _build_range(db, clinic, day, day)
    asha = next(e for e in data["employees"] if e["id"] == staff[0].id)
    cell = asha["attendance"][day.isoformat()]
    assert cell["status"] == "late"
    assert cell["check_in"] == "09:45"
    assert cell["reason"] == "Traffic"
    assert cell["source"] == "mobile"          # marked_by was never set
    assert asha["summary"]["late"] == 1
    assert asha["summary"]["present"] == 1


def test_an_open_shift_wins_over_a_closed_one_on_the_same_day(db, clinic, staff):
    """The phone opens a second record when somebody clocks back in after
    clocking out. A day with one closed and one open record is somebody who is
    currently on the floor, and the grid must say so."""
    today = _today(clinic)
    day = today - dt.timedelta(days=1)
    midnight = dt.datetime.combine(day, dt.time.min)

    db.add(Attendance(
        clinic_id=clinic.id, user_id=staff[0].id, date=midnight, status="on_time",
        check_in_time=dt.datetime.combine(day, dt.time(3, 30)),
        check_out_time=dt.datetime.combine(day, dt.time(7, 0)),
        created_at=dt.datetime.combine(day, dt.time(3, 30)),
        updated_at=dt.datetime.combine(day, dt.time(7, 0)),
    ))
    db.add(Attendance(
        clinic_id=clinic.id, user_id=staff[0].id, date=midnight, status="on_time",
        check_in_time=dt.datetime.combine(day, dt.time(8, 0)),
        check_out_time=None,
        created_at=dt.datetime.combine(day, dt.time(8, 0)),
        updated_at=dt.datetime.combine(day, dt.time(8, 0)),
    ))
    db.commit()

    data = _build_range(db, clinic, day, day)
    cell = data["employees"][0]["attendance"][day.isoformat()]
    assert cell["is_open_shift"] is True
    assert cell["check_in"] == "13:30"          # 08:00 UTC in Kolkata


def test_only_this_clinic_is_returned(db, clinic, staff):
    """Attendance is clinic-scoped. A second clinic's staff must not appear."""
    other = Clinic(name="Other", email="o@c.com", specialization="dental",
                   timezone="Asia/Kolkata", timings=TIMINGS)
    db.add(other)
    db.commit()
    db.add(User(name="Outsider", first_name="Out", last_name="Sider",
                email="out@c.com", role="assistant",
                clinic_id=other.id, is_active=True))
    db.commit()

    data = _build_range(db, clinic, _today(clinic), _today(clinic))
    assert {e["name"] for e in data["employees"]} == {"Asha", "Bela"}


def test_inactive_staff_are_left_out(db, clinic, staff):
    db.add(User(name="Left", first_name="Left", last_name="Gone",
                email="left@c.com", role="assistant",
                clinic_id=clinic.id, is_active=False))
    db.commit()
    data = _build_range(db, clinic, _today(clinic), _today(clinic))
    assert "Left" not in {e["name"] for e in data["employees"]}


def test_user_id_narrows_to_one_employee(db, clinic, staff):
    data = _build_range(db, clinic, _today(clinic), _today(clinic), user_id=staff[1].id)
    assert [e["name"] for e in data["employees"]] == ["Bela"]


def test_a_backwards_range_is_refused(db, clinic, staff):
    with pytest.raises(HTTPException) as exc:
        _build_range(db, clinic, dt.date(2026, 3, 10), dt.date(2026, 3, 1))
    assert exc.value.status_code == 400


def test_an_absurd_range_is_refused(db, clinic, staff):
    """What a mistyped year looks like. Refused rather than served slowly."""
    with pytest.raises(HTTPException) as exc:
        _build_range(db, clinic, dt.date(2020, 1, 1), dt.date(2026, 1, 1))
    assert exc.value.status_code == 400


# ── The three ways of asking for a range ─────────────────────────────────────

def test_month_shorthand_covers_the_whole_month():
    first, last = _resolve_range(None, None, "2026-02")
    assert (first, last) == (dt.date(2026, 2, 1), dt.date(2026, 2, 28))


def test_month_shorthand_knows_about_leap_years():
    first, last = _resolve_range(None, None, "2028-02")
    assert last == dt.date(2028, 2, 29)


def test_explicit_dates_are_used_as_given():
    first, last = _resolve_range("2026-05-04", "2026-05-10", None)
    assert (first, last) == (dt.date(2026, 5, 4), dt.date(2026, 5, 10))


def test_a_half_specified_range_is_refused():
    with pytest.raises(HTTPException) as exc:
        _resolve_range("2026-05-04", None, None)
    assert exc.value.status_code == 400


def test_a_malformed_month_is_refused():
    with pytest.raises(HTTPException) as exc:
        _resolve_range(None, None, "May 2026")
    assert exc.value.status_code == 400
