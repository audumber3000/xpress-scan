"""A case paper's date is the date of the VISIT, not the date it was typed up.

Clinics enter paper files weeks after the fact and write up yesterday's last
patient the next morning. Both used to be recorded as happening today, which put
them in today's register, today's footfall, and the wrong place in the patient's
own history.

Runs against a throwaway SQLite database: what is under test is the date landing
where it should and the register following it, both of which are visible without
the HTTP layer.
"""
import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.clinic_time import clinic_day_of
from domains.clinical.routes.case_papers import _move_register_entry
from models import Base, CasePaper, Clinic, DailyVisit, Patient

CLINIC = 1
# 3 June, 15:30 IST — well inside the clinic's day in both directions.
JUNE = datetime.datetime(2026, 6, 3, 10, 0)
SEPT = datetime.datetime(2026, 9, 17, 10, 0)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(Clinic(id=CLINIC, name="Royal Smile", timezone="Asia/Kolkata"))
    session.add(Patient(id=1, clinic_id=CLINIC, name="Asha Mehta",
                        phone="9820011111", treatment_type="General"))
    session.add(CasePaper(id=1, clinic_id=CLINIC, patient_id=1, date=SEPT))
    session.commit()
    yield session
    session.close()


def _register(db, day, **over):
    row = dict(clinic_id=CLINIC, patient_id=1, visit_date=day, source='case_paper')
    row.update(over)
    entry = DailyVisit(**row)
    db.add(entry)
    db.commit()
    return entry


def _paper(db):
    return db.get(CasePaper, 1)


# ─── Which day a stored timestamp belongs to ─────────────────────────────────

def test_a_late_evening_visit_stays_on_the_clinics_own_day():
    """18:30 UTC is already the next morning in India. A clinic reading its own
    register must not find last night's patient filed under tomorrow."""
    clinic = Clinic(name="x", timezone="Asia/Kolkata")
    assert clinic_day_of(clinic, datetime.datetime(2026, 6, 3, 10, 0)) == datetime.date(2026, 6, 3)
    assert clinic_day_of(clinic, datetime.datetime(2026, 6, 3, 18, 30)) == datetime.date(2026, 6, 4)


def test_an_unknown_time_has_no_day():
    """The caller falls back to "today" rather than being handed a guess."""
    assert clinic_day_of(Clinic(name="x"), None) is None


# ─── The register follows the paper ──────────────────────────────────────────

def test_back_dating_moves_the_register_entry(db):
    entry = _register(db, datetime.date(2026, 9, 17))
    _move_register_entry(db, _paper(db), SEPT, JUNE)
    db.commit()
    assert entry.visit_date == datetime.date(2026, 6, 3)


def test_a_save_that_does_not_move_the_day_changes_nothing(db):
    entry = _register(db, datetime.date(2026, 9, 17))
    _move_register_entry(db, _paper(db), SEPT, SEPT + datetime.timedelta(hours=1))
    db.commit()
    assert entry.visit_date == datetime.date(2026, 9, 17)


def test_an_entry_the_front_desk_typed_is_left_alone(db):
    """A manual row carries reception's own reason and doctor. A clinical edit
    does not get to relocate somebody else's record of the day."""
    entry = _register(db, datetime.date(2026, 9, 17), source='manual', reason='Walk-in')
    _move_register_entry(db, _paper(db), SEPT, JUNE)
    db.commit()
    assert entry.visit_date == datetime.date(2026, 9, 17)


def test_it_refuses_when_the_patient_is_already_on_the_new_day(db):
    """One row per patient per day. Merging two is not a decision to make
    silently behind a date edit."""
    moving = _register(db, datetime.date(2026, 9, 17))
    _register(db, datetime.date(2026, 6, 3), source='manual')
    _move_register_entry(db, _paper(db), SEPT, JUNE)
    db.commit()
    assert moving.visit_date == datetime.date(2026, 9, 17)
    assert db.query(DailyVisit).count() == 2


def test_no_register_entry_is_not_an_error(db):
    _move_register_entry(db, _paper(db), SEPT, JUNE)  # must not raise
    assert db.query(DailyVisit).count() == 0


# ─── The schema actually accepts a new date ──────────────────────────────────

def test_the_update_schema_takes_a_date():
    from schemas import CasePaperUpdate
    body = CasePaperUpdate(date="2026-06-03T15:30:00+05:30")
    assert body.date.year == 2026
    assert 'date' in body.model_dump(exclude_unset=True)


def test_a_save_that_does_not_mention_the_date_leaves_it_unset():
    """`exclude_unset` is what stops an ordinary clinical edit from stamping the
    paper with whatever the client happened to default to."""
    from schemas import CasePaperUpdate
    assert 'date' not in CasePaperUpdate(notes="x").model_dump(exclude_unset=True)


# ─── A prescription written on that visit carries the visit's date ───────────

def test_a_prescription_on_a_case_paper_takes_the_case_papers_date(db):
    """The whole point of back-dating a case paper is that the visit happened
    then. Medicines written on it are part of that visit, not of today."""
    from models import Prescription
    db.add(Prescription(id=1, clinic_id=CLINIC, patient_id=1, case_paper_id=1,
                        items=[], created_at=SEPT))
    db.commit()

    paper = _paper(db)
    paper.date = JUNE
    db.commit()

    rx = db.get(Prescription, 1)
    assert rx.issued_on == JUNE
    assert rx.created_at == SEPT  # the row was still made in September


def test_a_prescription_with_no_case_paper_falls_back_to_when_it_was_written(db):
    """Written straight from the patient file, there is no visit to borrow."""
    from models import Prescription
    db.add(Prescription(id=2, clinic_id=CLINIC, patient_id=1, items=[], created_at=SEPT))
    db.commit()
    assert db.get(Prescription, 2).issued_on == SEPT


# ─── The shadowing bug that shipped ──────────────────────────────────────────
#
# Adding a field called `date` above `next_visit_date: Optional[date]` rebound
# `date` inside the class, so the follow-up date could only ever be None and
# every case paper with one came back 422 in production.

def test_a_follow_up_date_is_accepted_on_update():
    from schemas import CasePaperUpdate
    body = CasePaperUpdate(next_visit_date='2026-10-01')
    assert body.next_visit_date == datetime.date(2026, 10, 1)


def test_the_visit_date_and_the_follow_up_date_travel_together():
    """The exact payload the case paper sends on Save."""
    from schemas import CasePaperUpdate
    body = CasePaperUpdate(
        date='2026-06-03T10:00:00.000Z',
        next_visit_date='2026-06-17',
        next_visit_recommendation='Review After 2 Weeks',
        status='Completed',
    )
    assert body.next_visit_date == datetime.date(2026, 6, 17)
    assert body.date.year == 2026


def test_no_schema_has_a_field_that_can_only_be_none():
    """The general form of the bug, across every request and response model.

    A field whose type resolved to NoneType rejects every real value. Nobody
    declares one on purpose, so any that appears is a name hiding a type.
    """
    import inspect
    from pydantic import BaseModel
    import schemas
    import core.dtos as dtos

    bad = []
    for mod in (schemas, dtos):
        for name, cls in inspect.getmembers(mod, inspect.isclass):
            if not (issubclass(cls, BaseModel) and cls.__module__ == mod.__name__):
                continue
            for field, info in cls.model_fields.items():
                if info.annotation is type(None):
                    bad.append(f'{mod.__name__}.{name}.{field}')
    assert bad == []
