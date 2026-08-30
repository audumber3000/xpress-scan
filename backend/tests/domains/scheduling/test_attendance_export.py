"""The two export formats.

An export is the copy that leaves the building: it gets printed, filed, and
argued over at the end of a month. Two things matter and are tested here.

  1. It must not silently lose days or people. A missing row in a spreadsheet
     looks exactly like a person who did not work.
  2. It must say the same thing the screen said. The CSV and the PDF are built
     from the same range payload as the grid for that reason, and these assert
     the detail actually survives the trip.

The PDF is exercised at its HTML stage rather than through WeasyPrint. What can
break here is the markup and the numbers in it; whether WeasyPrint is installed
on the machine running the tests is a different question, and one that would
stop these being run at all.
"""
import csv
import datetime as dt
import io

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.clinic_time import clinic_today
from domains.scheduling.routes.attendance import (
    _attendance_csv,
    _attendance_sheet_html,
    _build_range,
)
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
    c = Clinic(name="Export Clinic", email="e@c.com", specialization="dental",
               timezone="Asia/Kolkata", timings=TIMINGS,
               latitude=19.076, longitude=72.877, geofence_radius_m=150)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def populated(db, clinic):
    """Two staff, three days, covering every state an export has to render."""
    asha = User(name="Asha", first_name="Asha", last_name="R", email="asha@c.com",
                role="receptionist", clinic_id=clinic.id, is_active=True)
    bela = User(name="Bela", first_name="Bela", last_name="S", email="bela@c.com",
                role="assistant", clinic_id=clinic.id, is_active=True)
    db.add_all([asha, bela])
    db.commit()
    db.refresh(asha)
    db.refresh(bela)

    today = clinic_today(clinic)
    d1 = today - dt.timedelta(days=2)
    d2 = today - dt.timedelta(days=1)

    db.add_all([
        # Phone clock-in, well inside the fence, full shift.
        Attendance(
            clinic_id=clinic.id, user_id=asha.id,
            date=dt.datetime.combine(d1, dt.time.min), status="on_time",
            check_in_time=dt.datetime.combine(d1, dt.time(3, 30)),    # 09:00
            check_out_time=dt.datetime.combine(d1, dt.time(12, 30)),  # 18:00
            clock_in_latitude=19.076, clock_in_longitude=72.877,
            clock_in_distance_m=22.0, clock_in_accuracy=6.0,
            clock_in_address="12 Linking Road",
        ),
        # Late, and the phone was a long way off.
        Attendance(
            clinic_id=clinic.id, user_id=asha.id,
            date=dt.datetime.combine(d2, dt.time.min), status="late",
            reason="Traffic",
            check_in_time=dt.datetime.combine(d2, dt.time(4, 20)),    # 09:50
            check_out_time=dt.datetime.combine(d2, dt.time(12, 0)),
            clock_in_latitude=19.10, clock_in_longitude=72.90,
            clock_in_distance_m=1400.0, clock_in_accuracy=9.0,
        ),
        # Marked absent by hand.
        Attendance(
            clinic_id=clinic.id, user_id=bela.id,
            date=dt.datetime.combine(d1, dt.time.min), status="absent",
            reason="Sick leave", marked_by=asha.id,
        ),
    ])
    db.commit()
    return {"asha": asha, "bela": bela, "start": d1, "end": today}


def _rows(csv_text):
    return list(csv.reader(io.StringIO(csv_text)))


# ── CSV ──────────────────────────────────────────────────────────────────────

def test_csv_has_a_row_per_employee_per_day(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    rows = _rows(_attendance_csv(clinic, "test span", data))

    header_at = next(i for i, r in enumerate(rows) if r and r[0] == "Date")
    body = []
    for r in rows[header_at + 1:]:
        if not r or r[0] == "Summary":
            break
        body.append(r)

    # 2 staff x 3 days (start, start+1, today) and no future days in range.
    assert len(body) == 6


def test_csv_carries_the_clock_in_detail(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    text = _attendance_csv(clinic, "test span", data)
    rows = _rows(text)
    header = next(r for r in rows if r and r[0] == "Date")
    idx = {name: i for i, name in enumerate(header)}

    asha_first = next(
        r for r in rows
        if len(r) > 1 and r[1] == "Asha" and r[idx["Status"]] == "Present"
    )
    assert asha_first[idx["Clock in"]] == "09:00"
    assert asha_first[idx["Clock out"]] == "18:00"
    assert asha_first[idx["Hours worked"]] == "9h 00m"
    assert asha_first[idx["Recorded by"]] == "Phone"
    assert asha_first[idx["Distance at clock-in (m)"]] == "22"
    assert asha_first[idx["GPS accuracy (m)"]] == "6"
    assert asha_first[idx["Outside clinic area"]] == "No"
    assert asha_first[idx["Clock-in location"]] == "12 Linking Road"


def test_csv_flags_a_clock_in_from_outside_the_clinic(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    rows = _rows(_attendance_csv(clinic, "test span", data))
    header = next(r for r in rows if r and r[0] == "Date")
    idx = {name: i for i, name in enumerate(header)}

    late = next(r for r in rows if len(r) > 1 and r[idx["Status"]] == "Late")
    assert late[idx["Outside clinic area"]] == "Yes"
    assert late[idx["Late by (min)"]] == "50"
    assert late[idx["Reason"]] == "Traffic"


def test_csv_names_who_marked_a_hand_marked_day(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    rows = _rows(_attendance_csv(clinic, "test span", data))
    header = next(r for r in rows if r and r[0] == "Date")
    idx = {name: i for i, name in enumerate(header)}

    absent = next(r for r in rows if len(r) > 1 and r[idx["Status"]] == "Absent")
    assert absent[idx["Recorded by"]] == "Marked manually"
    assert absent[idx["Marked by"]] == "Asha"


def test_csv_says_not_marked_rather_than_leaving_a_blank(db, clinic, populated):
    """A blank status column in a filed register reads as a printing fault."""
    data = _build_range(db, clinic, populated["start"], populated["end"])
    text = _attendance_csv(clinic, "test span", data)
    assert "Not marked" in text


def test_csv_ends_with_a_per_employee_summary(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    rows = _rows(_attendance_csv(clinic, "test span", data))

    summary_at = next(i for i, r in enumerate(rows) if r and r[0] == "Summary")
    body = [r for r in rows[summary_at + 2:] if r]
    by_name = {r[0]: r for r in body}
    assert by_name["Asha"][1] == "2"       # days marked
    assert by_name["Asha"][2] == "2"       # present (on_time + late)
    # 09:00-18:00 is 9h, plus 09:50-17:30 is 7h40m.
    assert by_name["Asha"][6] == "16h 40m"
    assert by_name["Bela"][5] == "1"       # absent


def test_csv_of_an_empty_clinic_still_has_its_headers(db, clinic):
    """No staff is not an error. The file should open and be obviously empty."""
    today = clinic_today(clinic)
    data = _build_range(db, clinic, today, today)
    rows = _rows(_attendance_csv(clinic, "test span", data))
    assert any(r and r[0] == "Date" for r in rows)
    assert any(r and r[0] == "Summary" for r in rows)


# ── PDF (HTML stage) ─────────────────────────────────────────────────────────

def test_pdf_html_has_a_column_per_day_and_a_row_per_employee(db, clinic, populated):
    data = _build_range(db, clinic, populated["start"], populated["end"])
    html = _attendance_sheet_html(clinic, "test span", data, "now", "Dr Mehta")

    assert "Attendance register" in html
    assert "Export Clinic" in html
    assert "Asha" in html and "Bela" in html
    # One data cell per employee per day, plus two summary cells per row.
    assert html.count('<td class="c') == len(data["days"]) * 2


def test_pdf_html_marks_a_hand_marked_day(db, clinic, populated):
    """The 'm' is how a printed sheet distinguishes a real clock-in from a
    front-desk mark. Without it the paper copy loses the distinction the screen
    makes."""
    data = _build_range(db, clinic, populated["start"], populated["end"])
    html = _attendance_sheet_html(clinic, "test span", data, "now", "Dr Mehta")
    assert '<span class="m">m</span>' in html


def test_pdf_html_escapes_a_clinic_name_with_markup_in_it(db, clinic):
    """Clinic names are user input and land straight in the document."""
    clinic.name = 'Smile & <script>alert(1)</script> Dental'
    today = clinic_today(clinic)
    data = _build_range(db, clinic, today, today)
    html = _attendance_sheet_html(clinic, "span", data, "", "")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "Smile &amp;" in html


def test_pdf_html_says_so_when_there_is_nobody(db, clinic):
    today = clinic_today(clinic)
    data = _build_range(db, clinic, today, today)
    html = _attendance_sheet_html(clinic, "span", data, "", "")
    assert "No active employees" in html
