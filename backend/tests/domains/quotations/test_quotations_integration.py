"""Integration tests for the quotations domain (previously zero coverage).

Quotations are the closest thing in this app to the invoice-sending flow
that broke prod: /send-whatsapp dispatches through the same notify_event ->
nexus-service path. The most valuable test here isn't the happy path (that
needs a real notification-preference row plus a real wallet balance, which
would mean mocking notify_event's internals rather than testing this
route), it's proving the FAILURE mode is honest: when messaging isn't
configured, the response says so plainly rather than claiming "sent" while
nothing went out — see test_send_whatsapp_without_notification_preference.
"""
import pytest


@pytest.fixture
def quotation_payload(test_patient):
    return {
        "patient_id": test_patient.id,
        "notes": "Root canal + crown",
        "discount": 0.0,
        "lines": [
            {"description": "Root canal treatment", "tooth_number": "16", "quantity": 1, "unit_price": 8000.0},
            {"description": "Crown", "tooth_number": "16", "quantity": 1, "unit_price": 6000.0},
        ],
    }


# ── Auth boundary ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/quotations"),
    ("post", "/api/v1/quotations"),
    ("get", "/api/v1/quotations/1"),
    ("put", "/api/v1/quotations/1"),
    ("delete", "/api/v1/quotations/1"),
    ("post", "/api/v1/quotations/1/send"),
    ("post", "/api/v1/quotations/1/respond"),
    ("post", "/api/v1/quotations/1/send-whatsapp"),
    ("get", "/api/v1/quotations/1/pdf"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {}} if method in ("post", "put") else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code}"


# ── CRUD lifecycle ──────────────────────────────────────────────────────────

def test_create_quotation_prices_lines_and_assigns_a_number(client, auth_headers, quotation_payload):
    r = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "draft"
    assert data["quotation_number"].startswith("QTN-")
    assert data["subtotal"] == 14000.0
    assert data["total"] == 14000.0
    assert len(data["line_items"]) == 2


def test_create_quotation_unknown_patient_404s(client, auth_headers):
    r = client.post(
        "/api/v1/quotations",
        json={"patient_id": 999999, "lines": []},
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_get_and_list_quotation(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()

    got = client.get(f"/api/v1/quotations/{created['id']}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["id"] == created["id"]

    listed = client.get("/api/v1/quotations", headers=auth_headers)
    assert listed.status_code == 200
    assert any(q["id"] == created["id"] for q in listed.json())


def test_update_draft_quotation_reprices_it(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()

    payload = dict(quotation_payload)
    payload["discount"] = 1000.0
    payload["lines"] = [{"description": "Filling", "quantity": 2, "unit_price": 1500.0}]

    r = client.put(f"/api/v1/quotations/{created['id']}", json=payload, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["subtotal"] == 3000.0
    assert data["total"] == 2000.0
    assert len(data["line_items"]) == 1


def test_delete_draft_quotation(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()

    r = client.delete(f"/api/v1/quotations/{created['id']}", headers=auth_headers)
    assert r.status_code == 200

    assert client.get(f"/api/v1/quotations/{created['id']}", headers=auth_headers).status_code == 404


# ── Status transitions ──────────────────────────────────────────────────────

def test_send_requires_at_least_one_line_item(client, auth_headers, test_patient):
    created = client.post(
        "/api/v1/quotations", json={"patient_id": test_patient.id, "lines": []}, headers=auth_headers
    ).json()

    r = client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)
    assert r.status_code == 400


def test_send_marks_it_sent(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()

    r = client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "sent"
    assert r.json()["sent_at"] is not None


def test_accepting_creates_a_draft_invoice_exactly_once(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()
    client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)

    r = client.post(
        f"/api/v1/quotations/{created['id']}/respond", json={"accepted": True}, headers=auth_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "accepted"
    assert data["converted_invoice_id"] is not None

    invoice = client.get(f"/api/v1/invoices/{data['converted_invoice_id']}", headers=auth_headers)
    assert invoice.status_code == 200
    assert invoice.json()["status"] == "draft"

    # Answering twice must not raise a second invoice for the same quotation.
    again = client.post(
        f"/api/v1/quotations/{created['id']}/respond", json={"accepted": True}, headers=auth_headers
    )
    assert again.status_code == 400


def test_declining_does_not_create_an_invoice(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()
    client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)

    r = client.post(
        f"/api/v1/quotations/{created['id']}/respond", json={"accepted": False}, headers=auth_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "declined"
    assert data["converted_invoice_id"] is None


def test_cannot_edit_a_sent_quotation(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()
    client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)

    r = client.put(f"/api/v1/quotations/{created['id']}", json=quotation_payload, headers=auth_headers)
    assert r.status_code == 400


def test_cannot_delete_a_quotation_that_became_an_invoice(client, auth_headers, quotation_payload):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()
    client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth_headers)
    client.post(f"/api/v1/quotations/{created['id']}/respond", json={"accepted": True}, headers=auth_headers)

    r = client.delete(f"/api/v1/quotations/{created['id']}", headers=auth_headers)
    assert r.status_code == 400


# ── WhatsApp send: the failure mode must be honest ─────────────────────────
#
# See the module docstring. A fresh test clinic has no NotificationPreference
# row for "quotation_sent" — the exact same state a real clinic that never
# visited notification settings would be in — so this exercises the real
# early-return path, no mocking required.

def test_send_whatsapp_without_notification_preference_says_so_plainly(
    client, auth_headers, quotation_payload
):
    created = client.post("/api/v1/quotations", json=quotation_payload, headers=auth_headers).json()

    r = client.post(f"/api/v1/quotations/{created['id']}/send-whatsapp", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["sent"] is False
    assert data["reason"] == "not_configured"

    # And the quotation record must NOT have been silently marked as sent —
    # that would tell staff a patient was messaged when nobody was.
    still = client.get(f"/api/v1/quotations/{created['id']}", headers=auth_headers)
    assert still.json()["status"] == "draft"


def test_send_whatsapp_requires_at_least_one_line_item(client, auth_headers, test_patient):
    created = client.post(
        "/api/v1/quotations", json={"patient_id": test_patient.id, "lines": []}, headers=auth_headers
    ).json()

    r = client.post(f"/api/v1/quotations/{created['id']}/send-whatsapp", headers=auth_headers)
    assert r.status_code == 400


def test_send_whatsapp_requires_a_patient_phone_number(client, auth_headers, db_session, test_clinic):
    from models import Patient

    no_phone_patient = Patient(clinic_id=test_clinic.id, name="No Phone", age=40, gender="male", phone="")
    db_session.add(no_phone_patient)
    db_session.commit()
    db_session.refresh(no_phone_patient)

    created = client.post(
        "/api/v1/quotations",
        json={
            "patient_id": no_phone_patient.id,
            "lines": [{"description": "Cleaning", "quantity": 1, "unit_price": 500.0}],
        },
        headers=auth_headers,
    ).json()

    r = client.post(f"/api/v1/quotations/{created['id']}/send-whatsapp", headers=auth_headers)
    assert r.status_code == 400
