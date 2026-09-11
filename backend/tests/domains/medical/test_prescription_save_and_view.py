"""Writing a prescription from the patient file, and seeing it as it will print.

Four separate faults sat behind "I save it and it's blank", and each is pinned
here because each one on its own was enough to lose the doctor's work:

  * the patient file's save handler never called the API at all (frontend,
    covered by the fix, not by these tests),
  * a medicine picked from a set arrives with a numeric quantity, which the
    schema rejected with a 422 the drawer swallowed,
  * a real prescription never printed the doctor's name — there is no
    `clinics.doctor_name`, and a prescription did not record who wrote it —
    so the qualifications added alongside it never printed either,
  * the Preview was a hand-drawn imitation that ignored the chosen template.
"""
import pytest

from models import Patient, Prescription, TemplateConfiguration, User

ITEMS = [{"medicine_name": "Amoxicillin 500mg", "dosage": "1-0-1",
          "duration": "5 days", "quantity": "10", "notes": "After meals"}]


@pytest.fixture
def patient(db_session, test_clinic):
    p = Patient(clinic_id=test_clinic.id, name="Asha Mehta", phone="9876543210", age=34)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def doctor_user(db_session, test_user):
    test_user.name = "Dr R Sharma"
    test_user.qualifications = "BDS, MDS (Orthodontics)"
    db_session.commit()
    return test_user


def _set_template(db_session, clinic_id, template_id, config_json=None):
    row = TemplateConfiguration(clinic_id=clinic_id, category='prescription',
                                template_id=template_id, config_json=config_json)
    db_session.add(row)
    db_session.commit()


# ── Saving ──────────────────────────────────────────────────────────────────

def test_a_numeric_quantity_is_accepted(client, auth_headers, patient):
    """Picked from a medication set, the quantity comes off a numeric column."""
    items = [{**ITEMS[0], "quantity": 10}]
    r = client.post("/api/v1/clinical/prescriptions", headers=auth_headers,
                    json={"patient_id": patient.id, "items": items})
    assert r.status_code == 200, r.text
    assert r.json()["items"][0]["quantity"] == "10"


def test_saving_records_who_wrote_it(client, auth_headers, patient, test_user, db_session):
    r = client.post("/api/v1/clinical/prescriptions", headers=auth_headers,
                    json={"patient_id": patient.id, "items": ITEMS})
    assert r.status_code == 200, r.text
    rx = db_session.query(Prescription).get(r.json()["id"])
    assert rx.doctor_id == test_user.id


# ── The printed copy carries the doctor ─────────────────────────────────────

def test_a_saved_prescription_prints_the_doctor_who_wrote_it(
        client, auth_headers, patient, doctor_user, db_session, test_clinic):
    """The model path — download and WhatsApp — takes the doctor from the
    appointment, and a prescription written from the patient file has none."""
    from domains.medical.services.prescription_service import PrescriptionService

    created = client.post("/api/v1/clinical/prescriptions", headers=auth_headers,
                          json={"patient_id": patient.id, "items": ITEMS}).json()
    rx = db_session.query(Prescription).get(created["id"])
    html, _ = PrescriptionService(db_session).generate_prescription_pdf_from_model(
        rx, test_clinic)
    assert "Dr R Sharma" in html
    assert "BDS, MDS (Orthodontics)" in html


def test_the_renderer_prefers_the_prescribing_doctor_over_the_clinic(
        db_session, test_clinic, patient):
    from types import SimpleNamespace as NS
    from domains.medical.services.prescription_service import PrescriptionService

    html = PrescriptionService(db_session).render_prescription_html(
        patient, test_clinic,
        NS(items=[NS(**{**ITEMS[0], "instructions": None})], notes=""),
        doctor=NS(name="Dr A Kulkarni", qualifications="BDS", signature_url=None),
    )
    assert "Dr A Kulkarni" in html


# ── Preview is the real template ────────────────────────────────────────────

@pytest.mark.parametrize("template_id,marker", [
    ("plain", "No clinic header by design"),
    ("classic", "prescription-container"),
])
def test_the_preview_renders_the_chosen_template(
        client, auth_headers, patient, db_session, test_clinic, template_id, marker):
    _set_template(db_session, test_clinic.id, template_id)
    r = client.post("/api/v1/clinical/prescriptions/render-preview", headers=auth_headers,
                    json={"patient_id": patient.id, "items": ITEMS})
    assert r.status_code == 200, r.text
    assert marker in r.json()["html"]


def test_the_preview_honours_the_clinics_toggles(
        client, auth_headers, patient, doctor_user, db_session, test_clinic):
    """The old mock printed the doctor whatever the settings said."""
    _set_template(db_session, test_clinic.id, "classic",
                  {"show": {"doctor_name": False}})
    html = client.post("/api/v1/clinical/prescriptions/render-preview",
                       headers=auth_headers,
                       json={"patient_id": patient.id, "items": ITEMS}).json()["html"]
    assert "Dr R Sharma" not in html
    assert "Amoxicillin 500mg" in html


def test_the_preview_shows_the_letterhead_band(
        client, auth_headers, patient, db_session, test_clinic):
    _set_template(db_session, test_clinic.id, "plain",
                  {"letterhead": {"enabled": True, "top_mm": 100, "bottom_mm": 20,
                                  "left_mm": 15, "right_mm": 15}})
    html = client.post("/api/v1/clinical/prescriptions/render-preview",
                       headers=auth_headers,
                       json={"patient_id": patient.id, "items": ITEMS}).json()["html"]
    assert "padding: 100mm 15mm 20mm 15mm !important" in html


def test_the_preview_prints_the_writer_of_an_existing_prescription(
        client, auth_headers, patient, db_session, test_clinic):
    """Reopening someone else's prescription shows their name, not yours."""
    other = User(clinic_id=test_clinic.id, email="assoc@x.com", first_name="A",
                 last_name="Kulkarni", name="Dr A Kulkarni", role="doctor",
                 qualifications="BDS", is_active=True)
    db_session.add(other)
    db_session.commit()
    rx = Prescription(clinic_id=test_clinic.id, patient_id=patient.id,
                      items=ITEMS, doctor_id=other.id)
    db_session.add(rx)
    db_session.commit()

    html = client.post("/api/v1/clinical/prescriptions/render-preview",
                       headers=auth_headers,
                       json={"patient_id": patient.id, "items": ITEMS,
                             "prescription_id": rx.id}).json()["html"]
    assert "Dr A Kulkarni" in html


def test_the_preview_is_scoped_to_the_callers_clinic(client, auth_headers, db_session):
    from models import Clinic
    other = Clinic(name="Other", address="x", phone="2", email="o@c.com",
                   specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    theirs = Patient(clinic_id=other.id, name="Not Yours", phone="9999999999")
    db_session.add(theirs)
    db_session.commit()
    r = client.post("/api/v1/clinical/prescriptions/render-preview", headers=auth_headers,
                    json={"patient_id": theirs.id, "items": ITEMS})
    assert r.status_code == 404


# ── A storage failure must not lose the prescription ────────────────────────

def test_an_upload_failure_keeps_the_prescription(
        client, auth_headers, patient, db_session, test_clinic, monkeypatch):
    """The PDF used to be written with a null storage key into a NOT NULL
    column, which rolled back the request and took the prescription with it."""
    import domains.medical.services.prescription_service as svc
    monkeypatch.setattr(svc, "upload_pdf_to_r2", lambda data, path: None)

    r = client.post(f"/api/v1/reports/{patient.id}/prescriptions/generate-pdf",
                    headers=auth_headers, json={"items": ITEMS, "notes": ""})
    assert r.status_code == 502
    assert "saved" in r.json()["detail"]
    assert db_session.query(Prescription).filter(
        Prescription.patient_id == patient.id).count() == 1


def test_the_generate_path_uses_the_chosen_template(
        client, auth_headers, patient, db_session, test_clinic, monkeypatch):
    import domains.medical.services.prescription_service as svc
    seen = {}
    real = svc.PrescriptionService.render_prescription_html

    def spy(self, *a, **kw):
        seen['config'] = kw.get('config_override')
        return real(self, *a, **kw)

    monkeypatch.setattr(svc.PrescriptionService, "render_prescription_html", spy)
    monkeypatch.setattr(svc, "upload_pdf_to_r2", lambda data, path: "k")
    _set_template(db_session, test_clinic.id, "plain")

    client.post(f"/api/v1/reports/{patient.id}/prescriptions/generate-pdf",
                headers=auth_headers, json={"items": ITEMS, "notes": ""})
    assert seen['config'] is not None
    assert seen['config'].template_id == "plain"
