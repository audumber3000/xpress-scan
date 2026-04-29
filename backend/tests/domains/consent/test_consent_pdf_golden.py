"""Golden snapshot test for the consent PDF engine.

Phase 8 ported the consent renderer from Nexus into the main backend's
`consent_templates/` registry. This locks the classic variant's output so
future tweaks become visible diffs.
"""
from __future__ import annotations

import datetime
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from domains.consent.consent_templates import resolve_variant
from domains.infrastructure.services.preview_samples import sample_clinic, sample_consent

GOLDEN_DIR = Path(__file__).resolve().parents[2] / "golden"
GOLDEN_PATH = GOLDEN_DIR / "consent_classic.html"

_FROZEN_NOW = datetime.datetime(2026, 4, 28, 10, 0, 0)


class _FrozenDatetime(datetime.datetime):
    """Pin `datetime.now()` so the printed sign-date is stable across runs."""
    @classmethod
    def now(cls, tz=None):
        return _FROZEN_NOW


def _render(template_id: str = "classic", color: str = "#2a276e", footer: str = "Computer-generated.") -> str:
    cfg = SimpleNamespace(
        template_id=template_id,
        primary_color=color,
        footer_text=footer,
        logo_url=None,
    )
    sample = sample_consent()
    variant = resolve_variant(template_id)
    with patch("domains.consent.consent_templates.classic.datetime", _FrozenDatetime):
        return variant['render'](
            clinic=sample_clinic(),
            patient_name=sample["patient_name"],
            patient_id=sample["patient_id"],
            template_name=sample["template_name"],
            content=sample["content"],
            signature_base64=sample["signature_base64"],
            config=cfg,
        )


def test_classic_consent_matches_golden():
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    rendered = _render("classic")
    if os.environ.get("UPDATE_GOLDEN") == "1" or not GOLDEN_PATH.exists():
        GOLDEN_PATH.write_text(rendered, encoding="utf-8")
        if not os.environ.get("UPDATE_GOLDEN"):
            import pytest
            pytest.skip(f"Wrote new golden at {GOLDEN_PATH}. Re-run to verify.")
        return
    expected = GOLDEN_PATH.read_text(encoding="utf-8")
    assert rendered == expected, (
        f"Consent classic HTML diverged from golden at {GOLDEN_PATH}.\n"
        f"Re-run with UPDATE_GOLDEN=1 to refresh if intentional."
    )


def test_legacy_template_id_aliases_to_classic():
    """Old DB rows have template_id='standard' / 'default' — registry must alias."""
    standard = _render("standard")
    classic = _render("classic")
    assert standard == classic


def test_unknown_template_id_falls_back_to_classic():
    unknown = _render("some-removed-variant")
    classic = _render("classic")
    assert unknown == classic


def test_signature_embeds_when_provided():
    """If signature_base64 is given, an <img> tag must appear in the signature section."""
    rendered = _render("classic")
    assert 'data:image/png;base64,' in rendered
    assert 'alt="Patient signature"' in rendered


def test_svg_signature_is_rejected():
    """Belt-and-braces: even if a poisoned signature URI lands here, the
    renderer must drop SVG (script vector)."""
    cfg = SimpleNamespace(template_id="classic", primary_color=None, footer_text="", logo_url=None)
    variant = resolve_variant("classic")
    rendered = variant['render'](
        clinic=sample_clinic(),
        patient_name="X",
        patient_id=1,
        template_name="T",
        content="C",
        signature_base64='data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
        config=cfg,
    )
    assert '<script' not in rendered
    assert '<svg' not in rendered.lower()


def test_malicious_content_is_escaped():
    """Patient-supplied content (which becomes the signed legal text) must be
    HTML-escaped — clinics shouldn't be able to be tricked into signing a doc
    that smuggles markup."""
    cfg = SimpleNamespace(template_id="classic", primary_color=None, footer_text="", logo_url=None)
    variant = resolve_variant("classic")
    rendered = variant['render'](
        clinic=sample_clinic(),
        patient_name="<bad>name</bad>",
        patient_id=1,
        template_name="<i>Template</i>",
        content="<script>alert(1)</script>\nLine 2",
        signature_base64=None,
        config=cfg,
    )
    assert '<script>alert(1)' not in rendered
    assert '&lt;script&gt;' in rendered
    assert '&lt;bad&gt;' in rendered
