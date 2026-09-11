"""The phone app, as installed today, against this backend.

Store builds lag the repo by weeks (iOS from Aug 24, Android from Sep 4), and a
clinic cannot be made to update on the day a fix ships. These pin the backend's
half of the contract with those builds: what they send is read, and what they
read is there.

Each test names the symptom a clinic saw before the fix:

  * templates saved on a phone switched the web's letterhead printing off
  * prescriptions written on a phone were saved with no medicines
  * invoices raised from a phone's case paper were empty and attached to nothing
  * a tooth changed on a phone kept showing its old state on the web
"""
import datetime

import pytest

from models import Appointment, Patient


def _case_paper(client, headers, patient_id):
    r = client.post("/api/v1/clinical/case-papers", headers=headers, json={
        "patient_id": patient_id, "date": "2026-09-11T05:00:00",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _appointment(db, clinic, patient):
    a = Appointment(
        clinic_id=clinic.id, patient_id=patient.id, patient_name=patient.name,
        appointment_date=datetime.datetime.utcnow(),
        start_time="11:00", end_time="11:30", duration=30, status="scheduled",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _other_patient(db, clinic):
    p = Patient(clinic_id=clinic.id, name="Someone Else", phone="9000000001")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ── templates ──────────────────────────────────────────────────────────────

WEB_SAVE = {
    "category": "prescription", "template_id": "classic",
    "config_json": {
        "show": {"logo": False},
        "letterhead": {"enabled": True, "top_mm": 45, "bottom_mm": 25, "left_mm": 30, "right_mm": 28},
    },
}

# Exactly what TemplatesScreen.handleSave sends.
PHONE_SAVE = {
    "category": "prescription", "template_id": "classic", "logo_url": "",
    "primary_color": "#2a276e", "footer_text": "",
    "config_json": {"show": {"logo": True, "contact": True}},
}


def test_a_phone_save_keeps_the_letterhead_set_on_the_web(client, auth_headers):
    assert client.post("/api/v1/template-configs", json=WEB_SAVE, headers=auth_headers).status_code in (200, 201)
    r = client.post("/api/v1/template-configs", json=PHONE_SAVE, headers=auth_headers)
    assert r.status_code in (200, 201), r.text
    cfg = r.json()["config_json"]
    assert cfg["letterhead"]["enabled"] is True
    assert cfg["letterhead"]["top_mm"] == 45
    # The phone owns `show`, so its flags do replace the web's.
    assert cfg["show"] == {"logo": True, "contact": True}


def test_the_web_can_still_turn_the_letterhead_off(client, auth_headers):
    client.post("/api/v1/template-configs", json=WEB_SAVE, headers=auth_headers)
    off = {**WEB_SAVE, "config_json": {"show": {}, "letterhead": {"enabled": False}}}
    cfg = client.post("/api/v1/template-configs", json=off, headers=auth_headers).json()["config_json"]
    assert cfg["letterhead"]["enabled"] is False
    assert "show" not in cfg


def test_merge_rules():
    from domains.infrastructure.routes.template_configs import merge_config_json
    current = {"show": {"logo": False}, "letterhead": {"enabled": True, "top_mm": 40}}
    assert merge_config_json(current, None) is None                       # explicit null clears
    assert merge_config_json(current, {"show": {"logo": True}})["letterhead"]["top_mm"] == 40
    assert merge_config_json(current, {"logo": True})["show"] == {"logo": True}  # bare flag map
    assert merge_config_json(current, {})["letterhead"]["enabled"] is True
    assert merge_config_json(None, {"show": {"logo": True}}) == {"show": {"logo": True}}


# ── prescriptions ─────────────────────────────────────────────────────────

def _phone_rx(patient_id, appointment_id):
    """Exactly what CasePapersTab.savePrescription sends."""
    return {
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "medicines": [
            {"name": "Amoxicillin 500mg", "dosage": "1 cap", "duration": "5 days", "notes": "After food"},
            {"name": "", "dosage": "", "duration": "", "notes": ""},   # a row never filled in
        ],
        "notes": "Review in a week",
    }


def test_a_phone_prescription_keeps_its_medicines_and_its_visit(client, auth_headers, test_patient):
    cp = _case_paper(client, auth_headers, test_patient.id)
    r = client.post("/api/v1/clinical/prescriptions", json=_phone_rx(test_patient.id, cp), headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [i["medicine_name"] for i in body["items"]] == ["Amoxicillin 500mg"]
    assert body["items"][0]["dosage"] == "1 cap"
    assert body["case_paper_id"] == cp
    assert body["appointment_id"] is None
    # And back in the phone's own shape, so an installed build can show it.
    assert body["medicines"][0]["name"] == "Amoxicillin 500mg"
    assert body["medicines"][0]["notes"] == "After food"


def test_the_web_shape_is_untouched(client, auth_headers, test_patient):
    cp = _case_paper(client, auth_headers, test_patient.id)
    r = client.post("/api/v1/clinical/prescriptions", headers=auth_headers, json={
        "patient_id": test_patient.id, "case_paper_id": cp,
        "items": [{"medicine_name": "Ibuprofen 400mg", "frequency": "TDS", "quantity": 10}],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["items"][0]["medicine_name"] == "Ibuprofen 400mg"
    assert body["items"][0]["quantity"] == "10"
    assert body["case_paper_id"] == cp
    assert body["medicines"][0]["name"] == "Ibuprofen 400mg"


def test_a_real_appointment_link_is_kept(client, auth_headers, db_session, test_clinic, test_patient):
    appt = _appointment(db_session, test_clinic, test_patient)
    body = client.post("/api/v1/clinical/prescriptions", headers=auth_headers, json={
        "patient_id": test_patient.id, "appointment_id": appt.id,
        "items": [{"medicine_name": "Paracetamol"}],
    }).json()
    assert body["appointment_id"] == appt.id


def test_another_patients_appointment_is_never_linked(client, auth_headers, db_session, test_clinic, test_patient):
    """A shared number used to attach a prescription to a stranger's visit."""
    stranger = _other_patient(db_session, test_clinic)
    appt = _appointment(db_session, test_clinic, stranger)
    body = client.post("/api/v1/clinical/prescriptions", headers=auth_headers, json={
        "patient_id": test_patient.id, "appointment_id": appt.id,
        "items": [{"medicine_name": "Paracetamol"}],
    }).json()
    assert body["appointment_id"] is None
    assert body["case_paper_id"] is None


def test_the_list_carries_medicines_for_older_phones(client, auth_headers, test_patient):
    cp = _case_paper(client, auth_headers, test_patient.id)
    client.post("/api/v1/clinical/prescriptions", json=_phone_rx(test_patient.id, cp), headers=auth_headers)
    rows = client.get(f"/api/v1/clinical/prescriptions/patient/{test_patient.id}", headers=auth_headers).json()
    assert rows[0]["medicines"][0]["name"] == "Amoxicillin 500mg"


# ── invoices ──────────────────────────────────────────────────────────────

def _list(client, headers, **params):
    data = client.get("/api/v1/invoices", params=params, headers=headers).json()
    return data if isinstance(data, list) else data.get("items", [])


def test_a_phone_invoice_lands_on_its_case_paper_with_its_lines(client, auth_headers, test_patient):
    cp = _case_paper(client, auth_headers, test_patient.id)
    # Exactly what CasePapersTab.openInvoice sends.
    r = client.post("/api/v1/invoices", headers=auth_headers, json={
        "patient_id": test_patient.id, "appointment_id": cp, "notes": "Case Paper #1",
        "line_items": [
            {"description": "Root canal (Tooth #3)", "quantity": 1, "unit_price": 5000},
            {"description": "Scaling", "quantity": 2, "unit_price": 750},
        ],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["case_paper_id"] == cp
    assert body["appointment_id"] is None
    assert [li["description"] for li in body["line_items"]] == ["Root canal (Tooth #3)", "Scaling"]
    assert body["subtotal"] == 6500


def test_the_phones_lookup_finds_the_visits_invoice(client, auth_headers, test_patient):
    """The phone searches by `appointment_id=<case paper id>`. It used to find
    nothing, then raise a second bill for work the web had already billed."""
    cp = _case_paper(client, auth_headers, test_patient.id)
    web = client.post("/api/v1/invoices", headers=auth_headers, json={
        "patient_id": test_patient.id, "case_paper_id": cp,
    }).json()
    found = _list(client, auth_headers, patient_id=test_patient.id, appointment_id=cp, limit=10)
    assert [i["id"] for i in found] == [web["id"]]


def test_an_appointment_lookup_is_unchanged(client, auth_headers, db_session, test_clinic, test_patient):
    appt = _appointment(db_session, test_clinic, test_patient)
    inv = client.post("/api/v1/invoices", headers=auth_headers, json={
        "patient_id": test_patient.id, "appointment_id": appt.id,
    }).json()
    assert inv["appointment_id"] == appt.id
    found = _list(client, auth_headers, patient_id=test_patient.id, appointment_id=appt.id)
    assert [i["id"] for i in found] == [inv["id"]]


def test_without_a_patient_the_lookup_stays_literal(client, auth_headers, test_patient):
    """The case-paper reading is patient-guarded; with no patient it never applies."""
    cp = _case_paper(client, auth_headers, test_patient.id)
    client.post("/api/v1/invoices", headers=auth_headers, json={"patient_id": test_patient.id, "case_paper_id": cp})
    assert _list(client, auth_headers, appointment_id=cp) == []


# ── the chart ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("tooth,expected", [
    # Written by the web: axes and status agree, so the axes are read.
    ({"condition": "fractured", "work": "planned", "workType": "crown_porcelain", "status": "planned"},
     ("fractured", "planned", "crown_porcelain")),
    # Then changed on a phone, which writes only `status`: the status wins.
    ({"condition": "sound", "work": "planned", "workType": None, "status": "missing"},
     ("missing", None, None)),
    ({"condition": "sound", "work": None, "status": "rootCanal"},
     ("sound", "existing", "root_canal")),
    # Axes with no status at all are simply the axes.
    ({"condition": "impacted"}, ("impacted", None, None)),
    # A chart from before the axes existed.
    ({"status": "implant"}, ("sound", "existing", "implant")),
    ({"status": "something-new"}, ("sound", None, None)),
])
def test_a_status_changed_on_a_phone_is_read(tooth, expected):
    from domains.clinical.clinical_summary_pdf import tooth_state
    assert tooth_state(tooth) == expected


def test_the_plan_pdf_reads_the_phones_change():
    from domains.clinical.treatment_plan_pdf import _tooth_findings
    found, done, _ = _tooth_findings("3", {"condition": "sound", "work": "planned", "status": "missing"}, "")
    assert "Missing / extracted" in found
    assert done == []


# ── appointments ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("sent,expected", [
    ("Registered", "arrived"),   # sent when a patient file is created for the visit
    ("checking", "arrived"),
    ("accepted", "scheduled"),
    ("rejected", "cancelled"),
    ("finished", "completed"),
])
def test_older_phones_status_words_land_where_they_meant(
    client, auth_headers, db_session, test_clinic, test_patient, sent, expected
):
    """"Registered" used to fall through to `scheduled`, putting a patient who
    had already arrived back on the books."""
    appt = _appointment(db_session, test_clinic, test_patient)
    appt.status = "arrived"
    db_session.commit()
    r = client.put(f"/api/v1/appointments/{appt.id}", json={"status": sent}, headers=auth_headers)
    assert r.status_code == 200, r.text
    db_session.refresh(appt)
    assert appt.status == expected
