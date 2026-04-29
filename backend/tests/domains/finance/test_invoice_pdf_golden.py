"""Golden-output snapshot test for invoice PDF HTML rendering.

Locks down the exact HTML produced by `generate_invoice_html` against a
checked-in golden file. Any future change to the engine that alters output
will fail this test — forcing a conscious update to the golden via
`UPDATE_GOLDEN=1 pytest tests/domains/finance/test_invoice_pdf_golden.py`.

This is the safety net for Phase 1+ work on the templates section: variants,
upload flow, preview etc. must not accidentally break existing PDFs.
"""
from __future__ import annotations

import datetime
import os
from pathlib import Path
from types import SimpleNamespace

from domains.finance.invoice_pdf_engine import generate_invoice_html

GOLDEN_DIR = Path(__file__).resolve().parents[2] / "golden"
GOLDEN_PATH = GOLDEN_DIR / "invoice_basic.html"


def _sample_invoice():
    """Deterministic invoice fixture. Fixed created_at so the rendered
    'invoice_date' string is stable across runs."""
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
    patient = SimpleNamespace(
        id=42,
        name="Asha Mehta",
        phone="9876543210",
        age=34,
        gender="Female",
        uhid="PT-42",
    )
    invoice = SimpleNamespace(
        id=101,
        invoice_number="INV-101",
        line_items=line_items,
        patient=patient,
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
    return invoice


def _sample_clinic():
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
        primary_color="#FF9800",
        logo_url=None,
    )


def _sample_config():
    return SimpleNamespace(
        primary_color="#FF9800",
        footer_text="This is a computer-generated invoice. No signature required.",
        logo_url=None,
    )


def test_invoice_html_matches_golden():
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    rendered = generate_invoice_html(_sample_invoice(), _sample_clinic(), _sample_config())

    if os.environ.get("UPDATE_GOLDEN") == "1" or not GOLDEN_PATH.exists():
        GOLDEN_PATH.write_text(rendered, encoding="utf-8")
        if not os.environ.get("UPDATE_GOLDEN"):
            import pytest
            pytest.skip(f"Wrote new golden at {GOLDEN_PATH}. Re-run to verify.")
        return

    expected = GOLDEN_PATH.read_text(encoding="utf-8")
    assert rendered == expected, (
        f"Invoice HTML output diverged from golden at {GOLDEN_PATH}.\n"
        f"If the change is intentional, re-run with UPDATE_GOLDEN=1 to refresh."
    )


def test_invoice_renders_with_malicious_inputs_safely():
    """Belt-and-braces: even if poisoned data slips into the DB, the renderer
    must not produce executable HTML/CSS. This guards the pdf_safety helpers
    that the engine calls on every render."""
    clinic = _sample_clinic()
    poisoned_config = SimpleNamespace(
        primary_color="red; } body { display:none; /*",     # CSS escape attempt
        footer_text="<script>alert(1)</script>",            # XSS attempt
        logo_url="http://169.254.169.254/latest/meta-data/", # SSRF attempt
    )
    rendered = generate_invoice_html(_sample_invoice(), clinic, poisoned_config)

    assert "<script>" not in rendered
    assert "display:none" not in rendered
    assert "169.254.169.254" not in rendered
    assert "&lt;script&gt;" in rendered
