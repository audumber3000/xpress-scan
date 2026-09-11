"""The patient's photo.

Two things are being tested more than the happy path. First that what is stored
is the storage KEY and what is returned is a freshly signed URL — this codebase
has already shipped a stored presigned URL twice and watched it 403 days later.
Second that the upload is validated by decoding the image rather than by
trusting the client's Content-Type, because a file upload that believes its own
headers is a file upload that will eventually accept something else.
"""
import io

import pytest

from models import Patient


def _png(size=(40, 40), fmt="PNG"):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 80, 200)).save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture
def patient(db_session, test_clinic):
    p = Patient(clinic_id=test_clinic.id, name="Asha Mehta", phone="9876543210", age=34)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.mark.parametrize("method", ["post", "delete"])
def test_requires_auth(client, patient, method):
    kwargs = {"files": {"file": ("a.png", _png(), "image/png")}} if method == "post" else {}
    r = getattr(client, method)(f"/api/v1/patients/{patient.id}/photo", **kwargs)
    assert r.status_code in (401, 403)


def test_a_photo_for_another_clinics_patient_is_refused(client, auth_headers, db_session):
    from models import Clinic
    other = Clinic(name="Other", address="x", phone="2", email="o@c.com",
                   specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    theirs = Patient(clinic_id=other.id, name="Not Yours", phone="9999999999")
    db_session.add(theirs)
    db_session.commit()

    r = client.post(f"/api/v1/patients/{theirs.id}/photo", headers=auth_headers,
                    files={"file": ("a.png", _png(), "image/png")})
    assert r.status_code == 404


def test_an_empty_upload_is_refused(client, auth_headers, patient):
    r = client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                    files={"file": ("a.png", b"", "image/png")})
    assert r.status_code == 400


def test_a_file_that_is_not_an_image_is_refused_whatever_it_claims(
        client, auth_headers, patient):
    """The Content-Type says image/png and the bytes say otherwise. Believing
    the header is how an upload endpoint ends up storing something else."""
    r = client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                    files={"file": ("evil.png", b"#!/bin/sh\nrm -rf /", "image/png")})
    assert r.status_code == 400
    assert "not an image" in r.json()["detail"]


def test_an_oversized_file_is_refused(client, auth_headers, patient):
    r = client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                    files={"file": ("big.png", b"x" * (9 * 1024 * 1024), "image/png")})
    assert r.status_code == 413


def test_the_column_holds_the_key_and_the_response_holds_a_link(
        client, auth_headers, patient, db_session, monkeypatch):
    """The stored value must stay a key. A signed URL written back to the row is
    a 403 waiting for the signature to age out."""
    import domains.infrastructure.services.r2_storage as r2
    monkeypatch.setattr(r2, "upload_bytes_to_r2", lambda **kw: "clinics/1/patients/7/documents/x.jpg")
    monkeypatch.setattr(r2, "get_presigned_url", lambda k, **kw: f"https://r2.example/{k}?sig=abc")

    r = client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                    files={"file": ("a.png", _png(), "image/png")})
    assert r.status_code == 200, r.text
    assert r.json()["photo_url"].startswith("https://r2.example/")
    assert "sig=abc" in r.json()["photo_url"]

    db_session.refresh(patient)
    assert patient.photo_url == "clinics/1/patients/7/documents/x.jpg"
    assert "sig=" not in patient.photo_url


def test_reading_a_patient_signs_the_photo_rather_than_returning_the_key(
        client, auth_headers, patient, db_session, monkeypatch):
    import domains.infrastructure.services.r2_storage as r2
    monkeypatch.setattr(r2, "get_presigned_url", lambda k, **kw: f"https://r2.example/{k}?sig=xyz")

    patient.photo_url = "clinics/1/patients/7/documents/x.jpg"
    db_session.commit()

    got = client.get(f"/api/v1/patients/{patient.id}", headers=auth_headers)
    assert got.status_code == 200, got.text
    assert got.json()["photo_url"] == "https://r2.example/clinics/1/patients/7/documents/x.jpg?sig=xyz"


def test_signing_failure_does_not_cost_the_rest_of_the_record(
        client, auth_headers, patient, db_session, monkeypatch):
    """A storage hiccup must lose the picture, not the patient."""
    import domains.infrastructure.services.r2_storage as r2

    def boom(*a, **kw):
        raise RuntimeError("R2 unreachable")

    monkeypatch.setattr(r2, "get_presigned_url", boom)
    patient.photo_url = "clinics/1/patients/7/documents/x.jpg"
    db_session.commit()

    got = client.get(f"/api/v1/patients/{patient.id}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["name"] == "Asha Mehta"


def test_a_patient_without_a_photo_reports_none(client, auth_headers, patient):
    assert client.get(f"/api/v1/patients/{patient.id}",
                      headers=auth_headers).json()["photo_url"] is None


def test_removing_the_photo_clears_the_column(client, auth_headers, patient, db_session):
    patient.photo_url = "clinics/1/patients/7/documents/x.jpg"
    db_session.commit()

    r = client.delete(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers)
    assert r.status_code == 200
    db_session.refresh(patient)
    assert patient.photo_url is None


@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
def test_the_formats_a_browser_actually_produces_are_accepted(
        client, auth_headers, patient, monkeypatch, fmt):
    """WEBP matters: it is what some platforms hand back from a canvas when the
    webcam capture is encoded, and rejecting it would break capture on exactly
    those machines while file upload carried on working."""
    import domains.infrastructure.services.r2_storage as r2
    monkeypatch.setattr(r2, "upload_bytes_to_r2", lambda **kw: "k")
    monkeypatch.setattr(r2, "get_presigned_url", lambda k, **kw: "https://r2.example/k")

    r = client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                    files={"file": (f"a.{fmt.lower()}", _png(fmt=fmt), "application/octet-stream")})
    assert r.status_code == 200, r.text


def test_a_large_photo_is_downscaled_before_storing(client, auth_headers, patient, monkeypatch):
    """A 12-megapixel phone photo is four megabytes of nothing useful for a
    thumbnail beside a name, and on a clinic's connection it is the difference
    between a list that loads and one that does not."""
    from PIL import Image

    captured = {}

    import domains.infrastructure.services.r2_storage as r2
    def _capture(**kw):
        captured['data'] = kw['data']
        return "k"
    monkeypatch.setattr(r2, "upload_bytes_to_r2", _capture)
    monkeypatch.setattr(r2, "get_presigned_url", lambda k, **kw: "https://r2.example/k")

    client.post(f"/api/v1/patients/{patient.id}/photo", headers=auth_headers,
                files={"file": ("big.jpg", _png(size=(3000, 2000), fmt="JPEG"), "image/jpeg")})

    stored = Image.open(io.BytesIO(captured['data']))
    assert max(stored.size) <= 800
    assert stored.format == "JPEG"
