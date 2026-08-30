"""Marking a day by hand must not destroy what the phone recorded.

The web grid sends a status and a reason. It does not send clock-in or clock-out
times, and never has. The create/update route used to assign every field on the
request model regardless, and those two default to None — so an owner marking
somebody "late" silently erased the times their phone had stored.

Nobody noticed because the web screen displayed neither. It displays both now,
which turns a quiet data loss into an obvious one: an owner opens a day to read
the clock-in detail, presses Save, and the detail is gone. These pin the
behaviour so it cannot come back.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from domains.scheduling.routes.attendance import create_attendance
from models import Base, Attendance, Clinic, User
from schemas import AttendanceCreate


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
    c = Clinic(name="Marking Clinic", email="m@c.com", specialization="dental",
               timezone="Asia/Kolkata")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def owner(db, clinic):
    u = User(name="Owner", first_name="Own", last_name="Er", email="own@c.com",
             role="clinic_owner", clinic_id=clinic.id, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def staff(db, clinic):
    u = User(name="Asha", first_name="Asha", last_name="R", email="asha@c.com",
             role="receptionist", clinic_id=clinic.id, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def clocked_in_day(db, clinic, staff):
    """A day the staff member clocked in and out from their phone."""
    day = dt.datetime(2026, 8, 24)
    row = Attendance(
        clinic_id=clinic.id, user_id=staff.id, date=day, status="on_time",
        check_in_time=dt.datetime(2026, 8, 24, 3, 30),
        check_out_time=dt.datetime(2026, 8, 24, 12, 30),
        clock_in_latitude=19.076, clock_in_longitude=72.877,
        clock_in_distance_m=18.0, clock_in_accuracy=5.0,
        marked_by=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _mark(db, staff, owner, **fields):
    """What the web grid posts: a status, sometimes a reason, nothing else."""
    payload = AttendanceCreate(
        user_id=staff.id, date=dt.datetime(2026, 8, 24), **fields
    )
    return create_attendance(attendance=payload, db=db, current_user=owner)


def test_marking_late_keeps_the_clock_in_times(db, clinic, staff, owner, clocked_in_day):
    """The regression. Status changes, times survive."""
    _mark(db, staff, owner, status="late", reason="Traffic")

    db.refresh(clocked_in_day)
    assert clocked_in_day.status == "late"
    assert clocked_in_day.reason == "Traffic"
    assert clocked_in_day.check_in_time == dt.datetime(2026, 8, 24, 3, 30)
    assert clocked_in_day.check_out_time == dt.datetime(2026, 8, 24, 12, 30)


def test_marking_keeps_the_recorded_location(db, clinic, staff, owner, clocked_in_day):
    """The location columns were never in the assignment list, but assert them
    anyway: they are the evidence behind the times, and a later refactor that
    starts copying fields wholesale would take them too."""
    _mark(db, staff, owner, status="absent", reason="Sick")

    db.refresh(clocked_in_day)
    assert clocked_in_day.clock_in_distance_m == 18.0
    assert clocked_in_day.clock_in_accuracy == 5.0
    assert clocked_in_day.clock_in_latitude == 19.076


def test_a_deliberate_clearing_still_works(db, clinic, staff, owner, clocked_in_day):
    """exclude_unset distinguishes 'not sent' from 'sent as null'. An owner
    correcting a bogus clock-out to nothing must still be able to."""
    payload = AttendanceCreate(
        user_id=staff.id, date=dt.datetime(2026, 8, 24),
        status="on_time", check_out_time=None,
    )
    create_attendance(attendance=payload, db=db, current_user=owner)

    db.refresh(clocked_in_day)
    assert clocked_in_day.check_out_time is None
    # The clock-in was not mentioned, so it stays.
    assert clocked_in_day.check_in_time == dt.datetime(2026, 8, 24, 3, 30)


def test_a_correction_is_stamped_with_who_made_it(db, clinic, staff, owner, clocked_in_day):
    """Once an owner has edited a day it stops being the phone's word alone,
    and the grid must stop presenting it as such."""
    assert clocked_in_day.marked_by is None
    _mark(db, staff, owner, status="late")

    db.refresh(clocked_in_day)
    assert clocked_in_day.marked_by == owner.id


def test_marking_an_unrecorded_day_creates_the_row(db, clinic, staff, owner):
    result = _mark(db, staff, owner, status="absent", reason="Leave")
    assert result.status == "absent"

    rows = db.query(Attendance).filter(Attendance.user_id == staff.id).all()
    assert len(rows) == 1
    assert rows[0].marked_by == owner.id


def test_marking_somebody_from_another_clinic_is_refused(db, clinic, owner):
    from fastapi import HTTPException

    other = Clinic(name="Other", email="o@c.com", specialization="dental")
    db.add(other)
    db.commit()
    outsider = User(name="Out", first_name="Out", last_name="Sider",
                    email="out@c.com", role="assistant",
                    clinic_id=other.id, is_active=True)
    db.add(outsider)
    db.commit()
    db.refresh(outsider)

    payload = AttendanceCreate(
        user_id=outsider.id, date=dt.datetime(2026, 8, 24), status="on_time"
    )
    with pytest.raises(HTTPException) as exc:
        create_attendance(attendance=payload, db=db, current_user=owner)
    assert exc.value.status_code == 404
