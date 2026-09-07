"""The medical-form round trip, from adopting the starter to the filed PDF.

Covers the whole path in one test module because the value of this feature is
in the joins, not the pieces: the schema the clinic edits has to survive being
frozen onto a submission, answered by a stranger on a phone, rendered into a
document and filed against the right patient. A unit test on any one of those
would pass while the chain was broken.

Runs on its own throwaway SQLite file and mounts only the two forms routers, so
it needs neither Postgres nor Redis. R2 is stubbed: the point is the route
logic and the render, not boto3.
"""
from __future__ import annotations

import os
import tempfile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.auth_utils import get_current_user
from database import get_db
from domains.forms.starter_forms import MEDICAL_HISTORY_FORM
from models import Base, Clinic, FormSubmission, Patient, PatientDocument, User

# A 1x1 PNG. Enough to prove the signature survives the round trip and is
# embedded, without carrying a real bitmap around in the test file.
SIGNATURE = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

COMPLETE_ANSWERS = {
    "full_name": "Rahul Sharma",
    "mobile": "+91 90000 11111",
    "emergency_name": "Priya Sharma",
    "emergency_phone": "+91 90000 22222",
    "visit_reason": "Pain in the lower right back tooth.",
    "conditions": ["Diabetes", "Penicillin allergy"],
    "antibiotics_needed": {"answer": "Yes", "explain": "Cardiologist advised cover."},
    "allergies": "Penicillin",
    "blood_group": "B+",
    "declaration": True,
    "signature": SIGNATURE,
}


@pytest.fixture(scope="module")
def env():
    """A clinic, a patient, and the two routers wired to a scratch database.

    A file rather than `sqlite:///:memory:`: each pooled connection to an
    in-memory SQLite gets its own empty database, so the tables disappear
    between requests.
    """
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    clinic = Clinic(name="Sunrise Dental Care", phone="+919876543210",
                    address="12 MG Road, Bengaluru", email="hi@sunrise.in")
    db.add(clinic); db.commit(); db.refresh(clinic)
    patient = Patient(name="Rahul Sharma", phone="+919000011111", clinic_id=clinic.id)
    db.add(patient); db.commit(); db.refresh(patient)
    user = User(email="doc@sunrise.in", clinic_id=clinic.id, role="clinic_owner",
                first_name="Waseema", last_name="Hamid", name="Waseema Hamid")
    db.add(user); db.commit(); db.refresh(user)

    import domains.infrastructure.services.r2_storage as r2
    real_upload, real_presign = r2.upload_bytes_to_r2, r2.get_presigned_url
    r2.upload_bytes_to_r2 = lambda **kw: (
        f"clinics/{kw['clinic_id']}/patients/{kw['patient_id']}/consents/{kw['filename']}"
    )
    r2.get_presigned_url = lambda key, **kw: f"https://r2.example/{key}"

    from domains.forms.routes import forms as forms_routes
    from domains.forms.routes import public_forms

    app = FastAPI()
    app.include_router(forms_routes.router, prefix="/api/v1/forms")
    app.include_router(public_forms.router, prefix="/api/v1/public/forms")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    yield {"client": TestClient(app), "db": db, "patient": patient, "clinic": clinic}

    r2.upload_bytes_to_r2, r2.get_presigned_url = real_upload, real_presign
    db.close()
    engine.dispose()
    os.unlink(path)


@pytest.fixture(scope="module")
def template(env):
    res = env["client"].post("/api/v1/forms/templates/adopt", json=[MEDICAL_HISTORY_FORM["name"]])
    assert res.status_code == 200, res.text
    return res.json()[0]


def _send(env, template):
    res = env["client"].post(
        f"/api/v1/forms/patient/{env['patient'].id}/send", json={"template_id": template["id"]}
    )
    assert res.status_code == 200, res.text
    return res.json()


# ── The clinic's half ────────────────────────────────────────────────────────

def test_starter_is_adopted_as_a_medical_history(template):
    assert template["kind"] == "medical_history"
    assert len(template["schema"]) == len(MEDICAL_HISTORY_FORM["schema"])


@pytest.mark.parametrize("schema,reason", [
    ([{"key": "q", "label": "Pick one", "type": "single_select", "options": []}],
     "a choice question with nothing to choose from"),
    ([{"key": "s", "label": "Sign here", "type": "signature", "maps_to": "allergies"}],
     "a signature aimed at a clinical column"),
    ([{"key": "d", "label": "Agree", "type": "not_a_type"}],
     "an unknown field type"),
])
def test_unfillable_schemas_are_refused(env, schema, reason):
    """The editor lets a clinic build the schema by hand, so shapes the starter
    library guaranteed are now things somebody can get wrong. Each of these
    produces a form that cannot be completed, and save is the last place to
    catch it before it reaches a patient."""
    res = env["client"].post(
        "/api/v1/forms/templates", json={"name": "Broken", "kind": "medical_history", "schema": schema}
    )
    assert res.status_code == 400, f"{reason} was accepted: {res.text}"


def test_a_heading_is_corrected_rather_than_refused(env):
    """A section has nothing to answer, so required and maps_to are stripped.
    Silently, because the editor cannot produce one and the message would teach
    a clinic nothing."""
    res = env["client"].post("/api/v1/forms/templates", json={
        "name": "Custom history", "kind": "medical_history", "schema": [
            {"key": "sec", "label": "About you", "type": "section",
             "required": True, "maps_to": "allergies"},
            {"key": "q1", "label": "Any allergies?", "type": "textarea", "maps_to": "allergies"},
        ]})
    assert res.status_code == 200, res.text
    heading = res.json()["schema"][0]
    assert heading["required"] is False and heading["maps_to"] is None


# ── The patient's half ───────────────────────────────────────────────────────

def test_patient_opens_the_link(env, template):
    sent = _send(env, template)
    res = env["client"].get(f"/api/v1/public/forms/{sent['token']}")
    assert res.status_code == 200, res.text
    body = res.json()
    # The phone decides whether to show the review-the-document step from this.
    assert body["kind"] == "medical_history"
    assert body["patient_first_name"] == "Rahul"
    assert len(body["schema"]) == len(MEDICAL_HISTORY_FORM["schema"])


def test_required_answers_are_enforced(env, template):
    sent = _send(env, template)
    res = env["client"].post(f"/api/v1/public/forms/{sent['token']}/submit", json={"answers": {}})
    assert res.status_code == 400
    assert "Please answer" in res.text


def test_an_unticked_declaration_blocks_submission(env, template):
    sent = _send(env, template)
    answers = {**COMPLETE_ANSWERS, "declaration": False}
    res = env["client"].post(f"/api/v1/public/forms/{sent['token']}/submit", json={"answers": answers})
    assert res.status_code == 400


def test_a_yes_no_question_needs_the_yes_or_no(env, template):
    """It arrives as a dict, and a dict carrying only an explanation is as
    unanswered as no dict at all even though it is truthy."""
    sent = _send(env, template)
    schema = env["client"].get(f"/api/v1/public/forms/{sent['token']}").json()["schema"]
    field = next(f for f in schema if f["type"] == "yes_no_explain")
    # Make it required for this one form so the rule is observable.
    sub = env["db"].query(FormSubmission).filter(FormSubmission.token == sent["token"]).first()
    sub.schema_snapshot = [{**f, "required": True} if f["key"] == field["key"] else f for f in schema]
    env["db"].commit()

    answers = {**COMPLETE_ANSWERS, field["key"]: {"answer": "", "explain": "maybe"}}
    res = env["client"].post(f"/api/v1/public/forms/{sent['token']}/submit", json={"answers": answers})
    assert res.status_code == 400
    assert field["label"] in res.text


def test_preview_renders_a_pdf_and_stores_nothing(env, template):
    """A patient who looks at the document and closes the tab has submitted
    nothing, which is what the button promises them."""
    sent = _send(env, template)
    env["client"].get(f"/api/v1/public/forms/{sent['token']}")   # the patient opens it first
    docs_before = env["db"].query(PatientDocument).count()

    res = env["client"].post(f"/api/v1/public/forms/{sent['token']}/preview",
                             json={"answers": COMPLETE_ANSWERS})
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert res.content[:4] == b"%PDF"

    env["db"].expire_all()
    sub = env["db"].query(FormSubmission).filter(FormSubmission.id == sent["id"]).first()
    assert sub.answers is None
    assert sub.status == "opened"
    assert env["db"].query(PatientDocument).count() == docs_before


def test_submit_files_a_signed_copy_with_its_audit_trail(env, template):
    sent = _send(env, template)
    answers = {**COMPLETE_ANSWERS, "not_a_real_key": "should be dropped"}
    res = env["client"].post(
        f"/api/v1/public/forms/{sent['token']}/submit", json={"answers": answers},
        headers={"user-agent": "Mozilla/5.0 (iPhone)", "x-forwarded-for": "49.36.181.22, 10.0.0.1"},
    )
    assert res.status_code == 200, res.text

    env["db"].expire_all()
    sub = env["db"].query(FormSubmission).filter(FormSubmission.id == sent["id"]).first()
    assert sub.token is None, "the link must be single use"
    assert sub.status == "submitted"
    assert "not_a_real_key" not in sub.answers, "public input outside the schema must be dropped"
    # The four things that make an electronic signature defensible rather than
    # decorative: what was signed, when, from where, and by which browser.
    assert sub.signature_data
    assert sub.pdf_sha256 and len(sub.pdf_sha256) == 64
    assert sub.signed_ip == "49.36.181.22", "the client, not the proxy in front of it"
    assert "iPhone" in sub.signed_user_agent

    doc = env["db"].query(PatientDocument).filter(PatientDocument.id == sub.document_id).first()
    assert doc is not None, "the signed history has to reach the patient's documents"
    assert doc.patient_id == env["patient"].id
    assert doc.file_type == "pdf" and doc.file_size > 5000

    # A forwarded WhatsApp message must not be a permanent door into the record.
    assert env["client"].get(f"/api/v1/public/forms/{sent['token']}").status_code == 404


# ── Back on the clinic side ──────────────────────────────────────────────────

def test_signed_list_and_pdf_link(env, template):
    rows = env["client"].get("/api/v1/forms/signed").json()
    assert rows, "a submitted history has to show up in the signed list"
    row = rows[0]
    assert row["patient_name"] == "Rahul Sharma" and row["has_pdf"]

    res = env["client"].get(f"/api/v1/forms/submissions/{row['id']}/pdf")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["url"].startswith("https://r2.example/")
    assert body["signed_ip"] == "49.36.181.22" and body["checksum"]


def test_accepted_answers_reach_the_chart(env, template):
    """The half that separates this from a scanned PDF: a mapped answer a human
    accepted lands on the patient's own column."""
    rows = env["client"].get("/api/v1/forms/signed").json()
    res = env["client"].post(f"/api/v1/forms/submissions/{rows[0]['id']}/apply",
                             json={"accept_keys": ["allergies", "blood_group"]})
    assert res.status_code == 200, res.text

    env["db"].expire_all()
    patient = env["db"].query(Patient).filter(Patient.id == env["patient"].id).first()
    assert patient.allergies == "Penicillin"
    assert patient.blood_group == "B+"
