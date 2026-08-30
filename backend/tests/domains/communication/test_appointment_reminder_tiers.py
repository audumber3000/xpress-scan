"""Two appointment reminders, not one.

A patient now gets nudged the day before and again about two hours out. The
whole change hinges on one thing: the two tiers must be genuinely separate
events. If they share an event_type, three things go wrong at once — the dedup
guard reads the second send as a duplicate of the first and drops it, a clinic
cannot switch one on without the other, and the NotificationLog stops being able
to say which reminder actually went.

These tests drive the real scan against an in-memory database with notify_event
captured, so what is asserted is what would actually be sent.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core import scheduled_jobs
from core.scheduled_jobs import REMINDER_TIERS, _scan_appointment_reminders
from models import Base, Appointment, Clinic, NotificationLog


@pytest.fixture()
def Session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


@pytest.fixture()
def sent(monkeypatch, Session):
    """Point the job at our database and capture every send it attempts."""
    import database
    monkeypatch.setattr(database, "SessionLocal", Session)

    captured = []

    def fake_notify_event(event_type, **kwargs):
        captured.append({"event_type": event_type, **kwargs})
        # Mirror what the real dispatcher does: log the send, because the dedup
        # guard reads those rows back on the next scan.
        db = kwargs["db"]
        db.add(NotificationLog(
            clinic_id=kwargs["clinic_id"], channel="whatsapp",
            recipient=kwargs.get("to_phone") or kwargs.get("to_email") or "",
            event_type=event_type, status="sent",
            created_at=scheduled_jobs._ist_now(),
        ))
        db.commit()

    monkeypatch.setattr(scheduled_jobs, "notify_event", fake_notify_event)
    return captured


def _seed(Session, hours_ahead, status="scheduled", phone="9876543210"):
    """One clinic with one appointment `hours_ahead` from now, in IST.

    Returns the clinic id rather than the instance: the session is closed here,
    and a detached ORM object cannot be read from afterwards.
    """
    db = Session()
    clinic = Clinic(name="Reminder Clinic", email="r@c.com", specialization="dental",
                    phone="02212345678", timezone="Asia/Kolkata")
    db.add(clinic)
    db.commit()
    db.refresh(clinic)

    when = scheduled_jobs._ist_now() + dt.timedelta(hours=hours_ahead)
    db.add(Appointment(
        clinic_id=clinic.id, patient_name="Rahul Sharma",
        patient_phone=phone, patient_email="rahul@example.com",
        appointment_date=when, start_time=when.strftime("%H:%M"),
        end_time="10:30", duration=30, status=status,
    ))
    db.commit()
    clinic_id = clinic.id
    db.close()
    return clinic_id


# ── The tiers are configured as two distinct events ──────────────────────────

def test_there_are_exactly_two_tiers_with_distinct_event_types():
    assert set(REMINDER_TIERS) == {"appointment_reminder", "appointment_reminder_2h"}


def test_the_lead_times_are_a_day_and_two_hours():
    assert REMINDER_TIERS["appointment_reminder"][0] == dt.timedelta(hours=24)
    assert REMINDER_TIERS["appointment_reminder_2h"][0] == dt.timedelta(hours=2)


def test_every_window_is_wide_enough_for_the_scan_interval():
    """The scans run every 15 minutes. A half-width under 7.5 minutes leaves a
    gap an appointment can fall through and never be reminded about at all."""
    for event_type, (_lead, half_width, _dedup) in REMINDER_TIERS.items():
        assert half_width >= dt.timedelta(minutes=7, seconds=30), event_type


# ── Each tier catches its own appointments and no others ─────────────────────

def test_the_day_before_tier_catches_an_appointment_24_hours_out(Session, sent):
    _seed(Session, hours_ahead=24)
    _scan_appointment_reminders("appointment_reminder")
    assert [s["event_type"] for s in sent] == ["appointment_reminder"]


def test_the_two_hour_tier_catches_an_appointment_2_hours_out(Session, sent):
    _seed(Session, hours_ahead=2)
    _scan_appointment_reminders("appointment_reminder_2h")
    assert [s["event_type"] for s in sent] == ["appointment_reminder_2h"]


def test_the_two_hour_tier_ignores_a_day_out_appointment(Session, sent):
    _seed(Session, hours_ahead=24)
    _scan_appointment_reminders("appointment_reminder_2h")
    assert sent == []


def test_the_day_before_tier_ignores_a_two_hour_out_appointment(Session, sent):
    _seed(Session, hours_ahead=2)
    _scan_appointment_reminders("appointment_reminder")
    assert sent == []


def test_an_appointment_outside_every_window_is_left_alone(Session, sent):
    _seed(Session, hours_ahead=9)
    for event_type in REMINDER_TIERS:
        _scan_appointment_reminders(event_type)
    assert sent == []


# ── The part that would silently break if the tiers shared an event_type ─────

def test_both_reminders_reach_the_same_appointment_over_its_life(Session, sent):
    """The regression this whole change is about.

    The same appointment is scanned by the 24-hour tier a day out and by the
    2-hour tier later the same day. Both must send. With one shared event_type
    the second would match the first in the dedup guard and be dropped, and the
    patient would get exactly the single reminder they got before.
    """
    clinic_id = _seed(Session, hours_ahead=24)
    _scan_appointment_reminders("appointment_reminder")

    # Time passes: the appointment is now two hours away.
    db = Session()
    appt = db.query(Appointment).first()
    appt.appointment_date = scheduled_jobs._ist_now() + dt.timedelta(hours=2)
    db.commit()
    db.close()

    _scan_appointment_reminders("appointment_reminder_2h")

    assert [s["event_type"] for s in sent] == [
        "appointment_reminder", "appointment_reminder_2h",
    ]
    assert {s["clinic_id"] for s in sent} == {clinic_id}


def test_a_tier_does_not_send_itself_twice(Session, sent):
    """The 30-minute window and the 15-minute cron mean most appointments are
    seen by two consecutive scans. The dedup lookback is what stops the patient
    getting the same message twice."""
    _seed(Session, hours_ahead=2)
    _scan_appointment_reminders("appointment_reminder_2h")
    _scan_appointment_reminders("appointment_reminder_2h")
    assert len(sent) == 1


def test_two_patients_in_the_same_window_both_get_reminded(Session, sent):
    """Dedup is per recipient, not per clinic. A clinic with a busy 10 AM must
    not have everyone after the first go unreminded."""
    _seed(Session, hours_ahead=2, phone="9000000001")

    db = Session()
    clinic = db.query(Clinic).first()
    when = scheduled_jobs._ist_now() + dt.timedelta(hours=2)
    db.add(Appointment(
        clinic_id=clinic.id, patient_name="Second Patient",
        patient_phone="9000000002", patient_email="second@example.com",
        appointment_date=when, start_time=when.strftime("%H:%M"),
        end_time="10:30", duration=30, status="scheduled",
    ))
    db.commit()
    db.close()

    _scan_appointment_reminders("appointment_reminder_2h")
    assert len(sent) == 2


# ── Who does and does not get reminded ───────────────────────────────────────

@pytest.mark.parametrize("status", ["cancelled", "completed", "no_show"])
def test_a_closed_appointment_is_never_reminded(Session, sent, status):
    _seed(Session, hours_ahead=2, status=status)
    _scan_appointment_reminders("appointment_reminder_2h")
    assert sent == []


@pytest.mark.parametrize("status", ["scheduled", "confirmed", "arrived"])
def test_an_open_appointment_is_reminded(Session, sent, status):
    _seed(Session, hours_ahead=2, status=status)
    _scan_appointment_reminders("appointment_reminder_2h")
    assert len(sent) == 1


def test_an_appointment_with_no_contact_details_is_skipped(Session, sent):
    _seed(Session, hours_ahead=2, phone=None)
    db = Session()
    appt = db.query(Appointment).first()
    appt.patient_email = None
    db.commit()
    db.close()

    _scan_appointment_reminders("appointment_reminder_2h")
    assert sent == []


def test_the_template_data_carries_the_appointment(Session, sent):
    _seed(Session, hours_ahead=2)
    _scan_appointment_reminders("appointment_reminder_2h")

    data = sent[0]["template_data"]
    assert data["patient_name"] == "Rahul Sharma"
    assert data["clinic_name"] == "Reminder Clinic"
    assert data["clinic_phone"] == "02212345678"
    assert data["appointment_date"]
    assert data["appointment_time"]


def test_a_send_that_raises_does_not_stop_the_rest(Session, monkeypatch):
    """One clinic's failure must not cost every later clinic its reminders."""
    import database
    _seed(Session, hours_ahead=2, phone="9000000001")

    db = Session()
    clinic = db.query(Clinic).first()
    when = scheduled_jobs._ist_now() + dt.timedelta(hours=2)
    db.add(Appointment(
        clinic_id=clinic.id, patient_name="Second Patient",
        patient_phone="9000000002", appointment_date=when,
        start_time=when.strftime("%H:%M"), end_time="10:30",
        duration=30, status="scheduled",
    ))
    db.commit()
    db.close()

    monkeypatch.setattr(database, "SessionLocal", Session)
    calls = []

    def explode_once(event_type, **kwargs):
        calls.append(kwargs.get("to_phone"))
        if len(calls) == 1:
            raise RuntimeError("provider is down")

    monkeypatch.setattr(scheduled_jobs, "notify_event", explode_once)
    _scan_appointment_reminders("appointment_reminder_2h")

    assert len(calls) == 2
