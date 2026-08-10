"""Cross-tenant scoping for patient documents.

Patient documents are the most sensitive records the app holds: radiographs,
medical reports, scans. Several of these routes used to take a bare integer id
with no auth and no clinic filter, so counting upwards from 1 walked every
clinic's imaging. These tests are the regression net for that.

Deliberately built on in-memory SQLite with the real models rather than the
Postgres integration harness, so they run anywhere — the integration suite
currently errors out entirely without a local `postgres` role, which is exactly
how a scoping regression would slip through unnoticed.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from domains.document.routes.documents import (
    _check_internal_auth,
    _scoped_document,
    _scoped_patient,
    thumbnail_token,
)

CLINIC_A, CLINIC_B = 1, 2


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    models.Base.metadata.create_all(
        engine,
        tables=[
            models.Clinic.__table__,
            models.Patient.__table__,
            models.User.__table__,
            models.PatientDocument.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()

    session.add_all([
        models.Clinic(id=CLINIC_A, name="Clinic A"),
        models.Clinic(id=CLINIC_B, name="Clinic B"),
        # One patient and one document in each clinic, same shape, so the only
        # thing distinguishing them is tenancy.
        models.Patient(id=10, clinic_id=CLINIC_A, name="A Patient",
                       phone="9000000001", treatment_type="General"),
        models.Patient(id=20, clinic_id=CLINIC_B, name="B Patient",
                       phone="9000000002", treatment_type="General"),
        models.PatientDocument(
            id=100, patient_id=10, clinic_id=CLINIC_A,
            file_name="a-xray.dcm", file_path="clinics/1/x.dcm", file_type="dcm",
        ),
        models.PatientDocument(
            id=200, patient_id=20, clinic_id=CLINIC_B,
            file_name="b-xray.dcm", file_path="clinics/2/x.dcm", file_type="dcm",
        ),
    ])
    session.commit()
    yield session
    session.close()


def user(clinic_id: int) -> models.User:
    return models.User(id=clinic_id * 1000, clinic_id=clinic_id, email=f"u{clinic_id}@x.com")


# ── Patients ─────────────────────────────────────────────────────────────────

def test_own_patient_resolves(db):
    assert _scoped_patient(db, 10, user(CLINIC_A)).id == 10


def test_other_clinics_patient_is_404(db):
    with pytest.raises(HTTPException) as exc:
        _scoped_patient(db, 20, user(CLINIC_A))
    assert exc.value.status_code == 404


def test_missing_patient_and_foreign_patient_are_indistinguishable(db):
    """404 both ways, with the same detail.

    A 403 (or a different message) on a real-but-foreign id would confirm the
    record exists, which is itself a cross-tenant leak.
    """
    with pytest.raises(HTTPException) as foreign:
        _scoped_patient(db, 20, user(CLINIC_A))
    with pytest.raises(HTTPException) as absent:
        _scoped_patient(db, 99999, user(CLINIC_A))
    assert foreign.value.status_code == absent.value.status_code == 404
    assert foreign.value.detail == absent.value.detail


# ── Documents ────────────────────────────────────────────────────────────────

def test_own_document_resolves(db):
    assert _scoped_document(db, 100, user(CLINIC_A)).file_name == "a-xray.dcm"


def test_other_clinics_document_is_404(db):
    with pytest.raises(HTTPException) as exc:
        _scoped_document(db, 200, user(CLINIC_A))
    assert exc.value.status_code == 404


@pytest.mark.parametrize("doc_id", [100, 200])
def test_every_document_is_reachable_by_exactly_one_clinic(db, doc_id):
    """Walking the id space from another tenant must never hit anything."""
    owners = [c for c in (CLINIC_A, CLINIC_B) if _reachable(db, doc_id, c)]
    assert len(owners) == 1


def _reachable(db, doc_id: int, clinic_id: int) -> bool:
    try:
        _scoped_document(db, doc_id, user(clinic_id))
        return True
    except HTTPException:
        return False


# ── Thumbnail token ──────────────────────────────────────────────────────────
# The thumbnail endpoint cannot take an Authorization header (it is an <img
# src>), so this token is the whole access control on it.

def test_token_is_stable_and_document_specific():
    assert thumbnail_token(100) == thumbnail_token(100)
    assert thumbnail_token(100) != thumbnail_token(101)


def test_token_is_not_derivable_from_the_id():
    """Guards against someone 'simplifying' this to a hash of the id alone."""
    import hashlib
    for naive in (
        str(100),
        hashlib.sha256(b"100").hexdigest()[:32],
        hashlib.md5(b"100").hexdigest()[:32],
    ):
        assert thumbnail_token(100) != naive


def test_token_is_long_enough_to_not_be_guessable():
    assert len(thumbnail_token(1)) >= 32


# ── Internal service auth ────────────────────────────────────────────────────

def test_internal_auth_fails_closed_when_unconfigured(monkeypatch):
    """No secret set must mean 'reject everything', never 'allow everything'."""
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        _check_internal_auth("anything")
    assert exc.value.status_code == 503


@pytest.mark.parametrize("supplied", [None, "", "wrong", "secret-x"])
def test_internal_auth_rejects_bad_secrets(monkeypatch, supplied):
    monkeypatch.setenv("INTERNAL_API_KEY", "secret")
    with pytest.raises(HTTPException) as exc:
        _check_internal_auth(supplied)
    assert exc.value.status_code == 403


def test_internal_auth_accepts_the_right_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "secret")
    _check_internal_auth("secret")  # must not raise
