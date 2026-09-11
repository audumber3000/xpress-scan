"""Breaks within a shift.

The clock-out screen wants a "total breaks" figure, and until there was a way
to record one the only honest number was none at all. These pin the recording:
a break needs an open shift, one at a time, it counts while it runs, and a shift
that ends mid-break ends the break with it.
"""
import datetime

import pytest

from models import Attendance

FIX = {"latitude": 19.0894963, "longitude": 74.7359093, "accuracy": 10}


def _post(client, headers, path, json=None):
    return client.post(f"/api/v1/attendance-mobile/{path}", json=json, headers=headers)


def _status(client, headers):
    return client.get("/api/v1/attendance-mobile/status", headers=headers).json()


@pytest.fixture
def on_shift(client, auth_headers):
    r = _post(client, auth_headers, "clock-in", FIX)
    assert r.status_code == 200, r.text
    return r.json()


def test_no_break_without_a_shift(client, auth_headers):
    r = _post(client, auth_headers, "break/start")
    assert r.status_code == 400
    assert "not clocked in" in r.json()["detail"]


def test_a_break_starts_and_ends(client, auth_headers, on_shift):
    assert _post(client, auth_headers, "break/start").status_code == 200
    s = _status(client, auth_headers)
    assert s["on_break"] is True
    assert s["break_started_at"]

    assert _post(client, auth_headers, "break/end").status_code == 200
    s = _status(client, auth_headers)
    assert s["on_break"] is False
    assert s["break_started_at"] is None


def test_one_break_at_a_time(client, auth_headers, on_shift):
    _post(client, auth_headers, "break/start")
    r = _post(client, auth_headers, "break/start")
    assert r.status_code == 400
    assert "already on a break" in r.json()["detail"]


def test_ending_a_break_needs_one_open(client, auth_headers, on_shift):
    r = _post(client, auth_headers, "break/end")
    assert r.status_code == 400


def test_break_minutes_add_up(client, auth_headers, db_session, on_shift):
    """Two finished breaks of 20 and 25 minutes read as 45."""
    att = db_session.query(Attendance).get(on_shift["id"])
    base = datetime.datetime.now() - datetime.timedelta(hours=3)
    att.breaks = [
        {"start": base.isoformat(), "end": (base + datetime.timedelta(minutes=20)).isoformat()},
        {"start": (base + datetime.timedelta(hours=1)).isoformat(),
         "end": (base + datetime.timedelta(hours=1, minutes=25)).isoformat()},
    ]
    db_session.commit()
    assert _status(client, auth_headers)["break_minutes"] == 45


def test_clocking_out_mid_break_closes_the_break(client, auth_headers, db_session, on_shift):
    _post(client, auth_headers, "break/start")
    r = _post(client, auth_headers, "clock-out", {**FIX, "notes": "Quiet afternoon"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert all(b["end"] for b in body["breaks"])
    assert body["notes"] == "Quiet afternoon"
    s = _status(client, auth_headers)
    assert s["on_break"] is False
    assert s["is_done_for_today"] is True


def test_malformed_breaks_never_break_the_status(client, auth_headers, db_session, on_shift):
    att = db_session.query(Attendance).get(on_shift["id"])
    att.breaks = [{"start": "not a date"}, "junk", None, {"end": "x"}]
    db_session.commit()
    s = _status(client, auth_headers)
    assert s["break_minutes"] == 0
    assert s["on_break"] is False
