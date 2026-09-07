"""Every registered layout must survive the data a real clinic actually has.

The golden tests pin one variant's exact output against one tidy fixture. This
asks a blunter question of all of them at once: given a clinic that has filled
in almost nothing, an invoice with no line items, a name long enough to wrap a
letterhead, or twenty-six treatments, does the document still come out as a
valid PDF rather than a traceback in the middle of a patient's checkout?

That is the failure mode a picker makes likely. A clinic can now select any of
six invoice layouts, and a variant is only exercised by the clinics that chose
it — so a template that breaks on an empty address breaks quietly, for them,
months later. This runs all of them against the same hostile inputs.
"""
from __future__ import annotations

import datetime
import io
from types import SimpleNamespace

import pytest

from domains.consent.consent_templates import CONSENT_VARIANTS
from domains.finance.invoice_templates import INVOICE_VARIANTS
from domains.finance.receipt_templates import RECEIPT_VARIANTS
from domains.medical.prescription_templates import PRESCRIPTION_VARIANTS
from domains.infrastructure.services.preview_samples import (
    config_from_payload, preview_clinic, sample_consent, sample_invoice,
    sample_patient, sample_prescription_request,
)

pytest.importorskip("weasyprint")

LONG = "Full mouth rehabilitation with zirconia crowns on all posterior teeth " * 3


def _pdf(html: str):
    """Render and return the document, so a template that produces markup
    WeasyPrint chokes on fails here rather than in production."""
    from weasyprint import HTML
    buf = io.BytesIO()
    HTML(string=html).write_pdf(target=buf, presentational_hints=True)
    data = buf.getvalue()
    assert data[:4] == b"%PDF", "not a PDF"
    return data


def _bare_clinic():
    """A clinic on day one: a name and nothing else. Every optional field the
    layouts reach for is absent, which is what a new signup looks like."""
    return SimpleNamespace(
        name="A", address=None, phone=None, email=None, logo_url=None,
        gst_number=None, tagline=None, license_number=None, doctor_name=None,
        primary_color=None, currency_symbol=None, country="IN", tax_label=None,
    )


def _invoice(items, patient=None, **over):
    base = dict(
        id=1, invoice_number="INV-1", line_items=items, patient=patient,
        status="paid", payment_mode="Cash", utr="", appointment=None,
        created_at=datetime.datetime(2026, 4, 27, 10, 0, 0),
        subtotal=0.0, discount_amount=0.0, tax=0.0, total=0.0, notes="",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _item(**over):
    base = dict(description="Scaling", sac_code="9993", tooth_number="11",
                quantity=1, unit_price=500.0, amount=500.0)
    base.update(over)
    return SimpleNamespace(**base)


INVOICE_CASES = {
    "no line items at all": _invoice([]),
    "bare clinic, no patient": _invoice([_item()]),
    "long description and no tooth": _invoice([_item(description=LONG, tooth_number=None)]),
    "twenty six items, spills to page two": _invoice(
        [_item(description=f"Treatment {i}") for i in range(26)],
        subtotal=13000.0, total=15340.0, tax=2340.0),
    "zero total, fully discounted": _invoice(
        [_item()], subtotal=500.0, discount_amount=500.0, tax=0.0, total=0.0),
    "no invoice number": _invoice([_item()], invoice_number=""),
}


@pytest.mark.parametrize("variant_id", sorted(INVOICE_VARIANTS))
@pytest.mark.parametrize("case", sorted(INVOICE_CASES))
def test_invoice_variant_survives(variant_id, case):
    invoice = INVOICE_CASES[case]
    cfg = config_from_payload({"template_id": variant_id, "primary_color": "#2a276e"})
    _pdf(INVOICE_VARIANTS[variant_id]["render"](invoice, _bare_clinic(), cfg))


@pytest.mark.parametrize("variant_id", sorted(INVOICE_VARIANTS))
def test_invoice_variant_with_a_full_clinic(variant_id):
    cfg = config_from_payload({"template_id": variant_id, "primary_color": "#2a276e",
                               "footer_text": "Computer generated."})
    _pdf(INVOICE_VARIANTS[variant_id]["render"](
        sample_invoice(), preview_clinic(None, doctor_name="Dr R. Sharma"), cfg))


@pytest.mark.parametrize("variant_id", sorted(RECEIPT_VARIANTS))
def test_receipt_variant_survives(variant_id):
    """Receipts inherit the invoice's id, so every one of them gets rendered
    whether or not anyone designed it for that clinic."""
    payment = SimpleNamespace(
        amount=500.0, receipt_number="", receipt_paid_to_date=None,
        receipt_balance_due=None, method=None, reference=None,
        created_at=None, signature_url=None,
    )
    cfg = config_from_payload({"template_id": variant_id, "primary_color": "#2a276e"})
    _pdf(RECEIPT_VARIANTS[variant_id]["render"](
        _invoice([_item()], total=500.0), payment, _bare_clinic(), cfg))


@pytest.mark.parametrize("variant_id", sorted(PRESCRIPTION_VARIANTS))
@pytest.mark.parametrize("count,label", [(0, "none"), (1, "one"), (22, "spills to page two")])
def test_prescription_variant_survives(variant_id, count, label):
    """The medication count is what decides pagination, and the footer of a
    multi-page prescription is where these went wrong once already: a fixed
    footer with no reserved band printed straight over the medicine names."""
    from domains.medical.services.prescription_service import PrescriptionService

    req = sample_prescription_request()
    req.items = [SimpleNamespace(medicine_name=f"Medicine {i} 500mg", dosage="1-0-1",
                                 duration="5 days", quantity=10, notes="After meals")
                 for i in range(count)]
    cfg = config_from_payload({"template_id": variant_id, "primary_color": "#2a276e"})
    html = PrescriptionService(None).render_prescription_html(
        sample_patient(), _bare_clinic(), req, config_override=cfg)
    _pdf(html)


@pytest.mark.parametrize("variant_id", sorted(CONSENT_VARIANTS))
def test_consent_variant_survives(variant_id):
    sample = sample_consent()
    cfg = config_from_payload({"template_id": variant_id, "primary_color": "#2a276e"})
    _pdf(CONSENT_VARIANTS[variant_id]["render"](
        clinic=_bare_clinic(), patient_name=sample["patient_name"],
        patient_id=sample["patient_id"], template_name=sample["template_name"],
        content=sample["content"], signature_base64=sample.get("signature_base64", ""),
        config=cfg))
