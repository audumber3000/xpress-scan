"""Taking the clinic's data out, and what must never come with it.

Runs against its own throwaway SQLite database rather than the shared fixture,
because what is being tested is a query shape and a CSV, not an endpoint: the
two things that can go wrong here are a row belonging to somebody else and a
secret in a column, and both are visible at this level.
"""
import csv
import io

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import (
    Base, Clinic, Invoice, InvoiceLineItem, Patient, User,
)
from domains.clinic.routes.backup import DATASETS, _csv_for, _rows_for

MINE, THEIRS = 1, 2


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    session.add_all([
        Clinic(id=MINE, name="Royal Smile"),
        Clinic(id=THEIRS, name="Somebody Else"),
    ])
    session.add_all([
        User(id=1, clinic_id=MINE, first_name="Anita", last_name="Rao", name="Anita Rao",
             role="clinic_owner", email="anita@royal.test",
             password_hash="$2b$12$dont-let-this-out", signature_url="data:image/png;base64,AAA"),
        Patient(id=1, clinic_id=MINE, name="Asha Mehta", phone="9820011111",
                treatment_type="General", dental_chart={"11": {"status": "caries"}}),
        Patient(id=2, clinic_id=THEIRS, name="Not Mine", phone="9820022222",
                treatment_type="General"),
        Invoice(id=1, clinic_id=MINE, patient_id=1, invoice_number="INV-1", total=100),
        Invoice(id=2, clinic_id=THEIRS, patient_id=2, invoice_number="INV-2", total=50),
        InvoiceLineItem(id=1, invoice_id=1, description="Composite filling",
                        quantity=1, unit_price=100, amount=100),
        InvoiceLineItem(id=2, invoice_id=2, description="Belongs to the other clinic",
                        quantity=1, unit_price=50, amount=50),
    ])
    session.commit()
    yield session
    session.close()


def _read(db, model):
    return list(csv.DictReader(io.StringIO(_csv_for(db, model, MINE))))


def test_it_exports_this_clinics_rows(db):
    rows = _read(db, Patient)
    assert [r["name"] for r in rows] == ["Asha Mehta"]


def test_it_never_exports_another_clinics_rows(db):
    assert "Not Mine" not in _csv_for(db, Patient, MINE)


def test_a_table_with_no_clinic_column_is_reached_through_the_invoice(db):
    """InvoiceLineItem has no clinic_id of its own. Scoped through the invoice
    that does, rather than exported wholesale and filtered afterwards."""
    rows = _read(db, InvoiceLineItem)
    assert [r["description"] for r in rows] == ["Composite filling"]


def test_credentials_never_travel(db):
    """A backup gets emailed to accountants and left on laptops. Nothing in it
    may let somebody sign in, and nothing in it is a legal signature."""
    staff = _csv_for(db, User, MINE)
    assert "password_hash" not in staff
    assert "dont-let-this-out" not in staff
    assert "signature_url" not in staff
    assert "Anita Rao" in staff  # but the staff list itself is still there


def test_structured_columns_are_written_as_real_json(db):
    """str() on a dict produces single quotes, which is not JSON and cannot be
    read back. Nobody notices until they try."""
    import json
    chart = _read(db, Patient)[0]["dental_chart"]
    assert json.loads(chart) == {"11": {"status": "caries"}}


def test_the_header_row_is_the_columns(db):
    text = _csv_for(db, Patient, MINE)
    header = text.splitlines()[0].split(",")
    assert header[:3] == ["id", "clinic_id", "name"]


@pytest.mark.parametrize("dataset", DATASETS, ids=lambda d: d[0])
def test_every_advertised_dataset_can_actually_be_read(db, dataset):
    """The menu offers twenty-one things to export. A filter that raises on one
    of them would hand somebody a zip with a table quietly missing."""
    _key, _label, model, _description, _group = dataset
    assert _rows_for(db, model, MINE).count() >= 0
    assert _csv_for(db, model, MINE).splitlines()[0]
