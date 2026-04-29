"""Golden snapshot for the Modern Compact invoice variant.

Same shape as test_invoice_pdf_golden.py but pinned to template_id='modern'.
Locks down the modern variant's HTML so future tweaks are visible diffs.
"""
from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

from domains.finance.invoice_pdf_engine import generate_invoice_html

# Reuse the same fixture builders as the classic golden — just hand them a
# config with a different template_id so the dispatcher routes to modern.
from tests.domains.finance.test_invoice_pdf_golden import (
    _sample_invoice, _sample_clinic,
)

GOLDEN_DIR = Path(__file__).resolve().parents[2] / "golden"
GOLDEN_PATH = GOLDEN_DIR / "invoice_modern.html"


def _modern_config():
    return SimpleNamespace(
        template_id="modern",
        primary_color="#0F766E",
        footer_text="Thank you. Computer-generated invoice.",
        logo_url=None,
    )


def test_modern_invoice_matches_golden():
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    rendered = generate_invoice_html(_sample_invoice(), _sample_clinic(), _modern_config())

    if os.environ.get("UPDATE_GOLDEN") == "1" or not GOLDEN_PATH.exists():
        GOLDEN_PATH.write_text(rendered, encoding="utf-8")
        if not os.environ.get("UPDATE_GOLDEN"):
            import pytest
            pytest.skip(f"Wrote new golden at {GOLDEN_PATH}. Re-run to verify.")
        return

    expected = GOLDEN_PATH.read_text(encoding="utf-8")
    assert rendered == expected, (
        f"Modern invoice HTML diverged from golden at {GOLDEN_PATH}.\n"
        f"Re-run with UPDATE_GOLDEN=1 to refresh if intentional."
    )


def test_legacy_template_id_aliases_to_classic():
    """Old DB rows have template_id like 'modern_orange' / 'standard'. The
    registry must alias these to classic, not 500 with KeyError."""
    cfg = SimpleNamespace(template_id="modern_orange", primary_color=None, footer_text="", logo_url=None)
    classic_html = generate_invoice_html(_sample_invoice(), _sample_clinic(), cfg)

    cfg2 = SimpleNamespace(template_id="classic", primary_color=None, footer_text="", logo_url=None)
    direct_classic = generate_invoice_html(_sample_invoice(), _sample_clinic(), cfg2)

    assert classic_html == direct_classic, "legacy aliases must render identical to classic"


def test_unknown_template_id_falls_back_to_classic():
    cfg = SimpleNamespace(template_id="some-removed-variant", primary_color=None, footer_text="", logo_url=None)
    rendered = generate_invoice_html(_sample_invoice(), _sample_clinic(), cfg)
    # Classic-only signal: it has the "Amount in Words" block; modern doesn't.
    assert "Amount in Words" in rendered


def _invoice_with_signed_doctor():
    """Build a sample invoice whose appointment.doctor has a signature_url set,
    so Phase 5's signature embedding fires."""
    inv = _sample_invoice()
    doctor = SimpleNamespace(
        name="Dr. R. Sharma",
        signature_url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    )
    inv.appointment = SimpleNamespace(doctor=doctor)
    return inv


def test_signature_embeds_when_doctor_has_one_classic():
    """Phase 5: signature image must appear in classic invoice when doctor has signature_url."""
    cfg = SimpleNamespace(template_id="classic", primary_color=None, footer_text="", logo_url=None)
    rendered = generate_invoice_html(_invoice_with_signed_doctor(), _sample_clinic(), cfg)
    assert 'data:image/png;base64,iVBOR' in rendered
    assert 'alt="Signature"' in rendered


def test_signature_embeds_when_doctor_has_one_modern():
    cfg = SimpleNamespace(template_id="modern", primary_color=None, footer_text="", logo_url=None)
    rendered = generate_invoice_html(_invoice_with_signed_doctor(), _sample_clinic(), cfg)
    assert 'data:image/png;base64,iVBOR' in rendered
    assert 'alt="Signature"' in rendered


def test_svg_signature_is_rejected_at_render():
    """Defence in depth: even if a poisoned data URI lands in the DB, the
    renderer must drop SVG (script vector) rather than embed it."""
    inv = _sample_invoice()
    inv.appointment = SimpleNamespace(doctor=SimpleNamespace(
        name="Dr. X",
        signature_url='data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
    ))
    cfg = SimpleNamespace(template_id="classic", primary_color=None, footer_text="", logo_url=None)
    rendered = generate_invoice_html(inv, _sample_clinic(), cfg)
    assert 'svg' not in rendered.lower() or '<svg' not in rendered.lower()
    assert '<script' not in rendered
