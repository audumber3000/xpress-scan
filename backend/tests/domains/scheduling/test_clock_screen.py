"""What the clock-in screen needs in one call, and what clocking out records.

The web modal used to be two lines of text and a button: you pressed it, and
either it worked or the server told you that you were too far away. To draw a
map with the clinic's pin and your own dot it needed coordinates, and to report
a shift back it needed to know what the shift produced. Both now come from
/status, so the screen renders in one request instead of three.
"""
import datetime

import pytest

from models import Attendance, Clinic


@pytest.fixture
def clinic_with_pin(db_session, test_clinic):
    test_clinic.latitude = 19.0894963
    test_clinic.longitude = 74.7359093
    test_clinic.geofence_radius_m = 150
    db_session.commit()
    return test_clinic


def _status(client, headers):
    r = client.get("/api/v1/attendance-mobile/status", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_status_carries_the_pin_the_map_needs(client, auth_headers, clinic_with_pin):
    """It used to return a bare `geofence_set` boolean, so a screen that wanted
    to draw the radius had to call /geofence as well."""
    s = _status(client, auth_headers)
    assert s["geofence_set"] is True
    assert s["clinic_latitude"] == pytest.approx(19.0894963)
    assert s["clinic_longitude"] == pytest.approx(74.7359093)
    assert s["geofence_radius_m"] == 150
    assert s["clinic_name"] == clinic_with_pin.name


def test_status_is_honest_when_no_pin_is_set(client, auth_headers, test_clinic):
    """A clinic that has never set its location must say so rather than send
    nulls the screen would draw a map around."""
    s = _status(client, auth_headers)
    assert s["geofence_set"] is False
    assert s["clinic_latitude"] is None


def test_status_reports_the_days_work(client, auth_headers):
    s = _status(client, auth_headers)
    assert set(s["today"]) == {"patients_seen", "patients_registered", "appointments"}
    assert all(isinstance(v, int) for v in s["today"].values())


def test_registering_a_patient_shows_up_in_the_shift_summary(client, auth_headers):
    """The receptionist's half of the summary. A dentist is measured on who
    they treated; whoever is on the front desk on who they booked in, and a
    single "patients seen" figure would read zero for them all day."""
    before = _status(client, auth_headers)["today"]["patients_registered"]
    r = client.post("/api/v1/patients",
                    json={"name": "Shift Walkin", "phone": "9812300011", "age": 30,
                          "gender": "Male"},
                    headers=auth_headers)
    assert r.status_code == 201, r.text
    after = _status(client, auth_headers)["today"]["patients_registered"]
    assert after == before + 1


def test_clocking_in_from_far_away_is_refused(client, auth_headers, clinic_with_pin):
    r = client.post("/api/v1/attendance-mobile/clock-in",
                    json={"latitude": 19.13, "longitude": 74.78, "accuracy": 12},
                    headers=auth_headers)
    assert r.status_code == 403, r.text


def test_clocking_out_from_far_away_is_allowed_and_measured(
    client, auth_headers, clinic_with_pin, db_session
):
    """Somebody who has finished their shift and walked to the car park still
    has to close it. A geofence that traps them clocked-in overnight turns a
    safeguard into a bug — but the distance is recorded either way."""
    assert client.post("/api/v1/attendance-mobile/clock-in",
                       json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8},
                       headers=auth_headers).status_code == 200

    out = client.post("/api/v1/attendance-mobile/clock-out",
                      json={"latitude": 19.13, "longitude": 74.78, "accuracy": 15},
                      headers=auth_headers)
    assert out.status_code == 200, out.text

    row = db_session.query(Attendance).order_by(Attendance.id.desc()).first()
    assert row.clock_out_distance_m > 1000


def test_the_shift_note_is_saved(client, auth_headers, clinic_with_pin, db_session):
    """Clocking out reported nothing back and could carry nothing with it. The
    note is optional by design — one that blocks the end of a shift is a note
    people learn to type "." into."""
    client.post("/api/v1/attendance-mobile/clock-in",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8},
                headers=auth_headers)
    client.post("/api/v1/attendance-mobile/clock-out",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8,
                      "notes": "Compressor sounded rough, booked service for Friday."},
                headers=auth_headers)

    row = db_session.query(Attendance).order_by(Attendance.id.desc()).first()
    assert "Compressor" in (row.notes or "")


def test_clocking_out_without_a_note_leaves_notes_alone(
    client, auth_headers, clinic_with_pin, db_session
):
    client.post("/api/v1/attendance-mobile/clock-in",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8},
                headers=auth_headers)
    client.post("/api/v1/attendance-mobile/clock-out",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8,
                      "notes": "   "},
                headers=auth_headers)

    row = db_session.query(Attendance).order_by(Attendance.id.desc()).first()
    assert not (row.notes or "").strip()


def test_the_three_shift_states_are_distinguishable(client, auth_headers, clinic_with_pin):
    """Not started, on shift, finished. They used to need two requests plus a
    guess, and a finished shift looked identical to one never started."""
    s = _status(client, auth_headers)
    assert (s["is_clocked_in"], s["is_done_for_today"]) == (False, False)

    client.post("/api/v1/attendance-mobile/clock-in",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8},
                headers=auth_headers)
    s = _status(client, auth_headers)
    assert (s["is_clocked_in"], s["is_done_for_today"]) == (True, False)
    assert s["clock_in_time"]

    client.post("/api/v1/attendance-mobile/clock-out",
                json={"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 8},
                headers=auth_headers)
    s = _status(client, auth_headers)
    assert (s["is_clocked_in"], s["is_done_for_today"]) == (False, True)
    assert s["clock_out_time"]
