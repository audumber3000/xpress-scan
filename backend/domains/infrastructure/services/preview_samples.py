"""Deterministic sample data for the Templates preview endpoint.

Used by `POST /api/v1/template-configs/preview` to render real engine output
against the user's unsaved config — without writing anything to the DB or R2.

Critically: the preview endpoint must call the *same* render functions used
by production PDF generation. Otherwise the preview lies. So instead of a
parallel mock renderer, the engine just receives these fake objects and runs
end-to-end exactly as it would for a real patient.
"""
from __future__ import annotations

import datetime
from types import SimpleNamespace


def sample_clinic() -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        name="MolarPlus Dental",
        phone="+91 22 4000 1234",
        email="hello@molarplus.example",
        address="12 Marine Drive, Mumbai 400020",
        tagline="Comprehensive Dental & Orthodontic Care",
        reg_number="MH/DC/12345",
        gst_number="27ABCDE1234F1Z5",
        doctor_name="Dr. R. Sharma",
        primary_color=None,
        logo_url=None,
    )


def sample_patient() -> SimpleNamespace:
    return SimpleNamespace(
        id=42,
        name="Asha Mehta",
        phone="9876543210",
        age=34,
        gender="Female",
        uhid="PT-42",
        display_id="PT-42",
    )


def sample_invoice() -> SimpleNamespace:
    """Fixed-date invoice — preview output stays stable across renders."""
    line_items = [
        SimpleNamespace(
            description="Root canal treatment",
            sac_code="9993",
            tooth_number="46",
            quantity=1,
            unit_price=4500.00,
            amount=4500.00,
        ),
        SimpleNamespace(
            description="Composite filling",
            sac_code="9993",
            tooth_number="36",
            quantity=2,
            unit_price=750.00,
            amount=1500.00,
        ),
    ]
    return SimpleNamespace(
        id=101,
        invoice_number="INV-101",
        line_items=line_items,
        patient=sample_patient(),
        status="paid",
        payment_mode="UPI",
        utr="UPI123456789",
        created_at=datetime.datetime(2026, 4, 27, 10, 0, 0),
        subtotal=6000.00,
        discount_amount=500.00,
        tax=990.00,
        total=6490.00,
        notes="Follow up in 2 weeks.",
        appointment=None,
    )


def sample_prescription_request():
    """Mirrors PrescriptionRequestDTO shape using SimpleNamespace so callers
    can hit `prescription_service.render_prescription_html` without DB."""
    items = [
        SimpleNamespace(
            medicine_name="Amoxicillin 500mg",
            dosage="1-0-1",
            duration="5 days",
            quantity=10,
            notes="After meals",
        ),
        SimpleNamespace(
            medicine_name="Ibuprofen 400mg",
            dosage="0-0-1",
            duration="3 days",
            quantity=3,
            notes="If pain persists",
        ),
    ]
    return SimpleNamespace(
        items=items,
        notes=(
            "CC: Severe pain in lower right molar.\n"
            "Dx: Pulpitis #46.\n"
            "Advice: Avoid hard foods on the right side.\n"
            "Next visit: 11 May 2026 for filling check-up."
        ),
    )


def sample_consent() -> dict:
    """Deterministic sample data for the consent preview. Mirrors the kwargs
    the consent renderer expects (patient_name, patient_id, template_name,
    content, signature_base64)."""
    return {
        "patient_name": "Asha Mehta",
        "patient_id": 42,
        "template_name": "Root Canal Treatment — Informed Consent",
        "content": (
            "I, the undersigned, hereby authorise the dental surgeon and clinic staff to perform "
            "a root canal procedure on tooth #46.\n\n"
            "I understand that the procedure carries certain risks, including but not limited to "
            "post-operative discomfort, sensitivity, infection, and the rare possibility of treatment "
            "failure requiring re-intervention.\n\n"
            "I have been given the opportunity to ask questions and have received satisfactory answers. "
            "I voluntarily agree to undergo this procedure and confirm that I have read and understood "
            "the information provided to me."
        ),
        # Tiny 1×1 black PNG so the preview shows a signature exists.
        "signature_base64": (
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
        ),
    }


def config_from_payload(payload: dict) -> SimpleNamespace:
    """Convert preview request body → engine-compatible config object.
    Same shape as a TemplateConfiguration row, attribute access only."""
    return SimpleNamespace(
        primary_color=payload.get("primary_color") or None,
        footer_text=payload.get("footer_text") or "",
        logo_url=payload.get("logo_url") or None,
        template_id=payload.get("template_id") or "classic",
    )
