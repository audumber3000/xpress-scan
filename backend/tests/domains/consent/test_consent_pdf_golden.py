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


# ── Pre-printed letterhead ──────────────────────────────────────────────────
#
# The invoice and prescription sides of this live in
# tests/domains/finance/test_letterhead_mode.py and
# tests/domains/medical/test_prescription_letterhead.py. Consent has one thing
# neither of those does: a fixed footer carrying the terms and the signature,
# which is the legally meaningful part of the form. Letterhead mode must not
# touch it — the clinic's stationery replaces their branding, not the consent.

import re as _re
from types import SimpleNamespace as _NS

from domains.consent.consent_templates import resolve_variant as _resolve_variant

_ON = {'enabled': True, 'top_mm': 45, 'bottom_mm': 20, 'left_mm': 30, 'right_mm': 28}


def _lh_clinic():
    return _NS(
        id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
        phone='4441112222', email='hi@royalsmile.in',
        tagline='Smile with confidence', license_number='MH-DEN-4471',
        logo_url=None, primary_color='#2a276e', doctor_name='Dr R Sharma',
    )


def _lh_render(letterhead=None, show=None):
    body = {}
    if letterhead is not None:
        body['letterhead'] = letterhead
    if show is not None:
        body['show'] = show
    config = _NS(primary_color='#2a276e', footer_text='Thanks for visiting',
                 logo_url=None, template_id='classic', config_json=body or None)
    return _resolve_variant('classic')['render'](
        clinic=_lh_clinic(), patient_name='Asha Mehta', patient_id='PT-42',
        template_name='Extraction Consent', content='<p>I consent.</p>',
        signature_base64='', config=config,
    )


def _lh_page_rule(html):
    return _re.search(r'@page\s*\{[^}]*\}', html).group(0)


def test_letterhead_off_by_default_keeps_the_page_box():
    assert _lh_page_rule(_lh_render()) == '@page { size: A4; margin: 2mm; }'
    assert 'display: none !important' not in _lh_render()


def test_letterhead_disabled_renders_identically_to_no_config():
    assert _lh_render({'enabled': False, 'top_mm': 45}) == _lh_render()


def test_letterhead_enabled_reserves_the_four_margins():
    assert _lh_page_rule(_lh_render(_ON)) == \
        '@page { size: A4; margin: 45mm 28mm 20mm 30mm; }'


def test_letterhead_enabled_drops_the_header_and_strips():
    html = _lh_render(_ON)
    assert '.header, .color-strip { display: none !important; }' in html
    for leak in ('12 MG Road', '4441112222', 'hi@royalsmile.in',
                 'Smile with confidence', 'MH-DEN-4471', 'Thanks for visiting'):
        assert leak not in html, f'letterhead mode still prints {leak!r}'


def test_letterhead_enabled_keeps_the_terms_and_the_consent():
    """The stationery replaces the clinic's branding, not the form's substance."""
    html = _lh_render(_ON)
    assert 'Terms &amp; Conditions' in html
    assert 'legally valid under the IT Act' in html
    assert 'Asha Mehta' in html
    assert 'I consent.' in html


def test_letterhead_enabled_keeps_room_for_the_fixed_footer():
    """The footer is position:fixed and the body reserves its height. Zeroing
    that padding along with the rest would run the consent text underneath the
    terms block."""
    assert '.consent-body { padding: 0 0 200px 0; }' in _lh_render(_ON)


def test_logo_hidden_draws_nothing_rather_than_the_initials_box():
    assert 'dashed' not in _lh_render(show={'logo': False})


def test_doctor_name_toggle():
    assert 'Dr R Sharma' in _lh_render()
    assert 'Dr R Sharma' not in _lh_render(show={'doctor_name': False})


def test_clinic_name_toggle_on_consent():
    assert 'Royal Smile Dental Care' in _lh_render()
    assert 'Royal Smile Dental Care' not in _lh_render(show={'clinic_name': False})


def test_unticking_everything_leaves_no_clinic_on_the_consent():
    from domains.infrastructure.services.pdf_fields import FIELD_KEYS

    html = _lh_render(show={k: False for k in FIELD_KEYS})
    for leak in ('Royal Smile Dental Care', '12 MG Road', '4441112222',
                 'hi@royalsmile.in', 'Smile with confidence', 'MH-DEN-4471'):
        assert leak not in html, f'consent still prints {leak!r} with every box unticked'
    # The form itself has to survive: this is the document's legal substance.
    assert 'Terms &amp; Conditions' in html and 'Asha Mehta' in html
