"""Show/hide toggles on the prescription and consent documents.

The prescription is the awkward one: it substitutes placeholders into HTML
*files*, so hiding a field means emptying a variable whose wrapper markup used
to live in the file. Get that wrong and you don't get a missing field, you get
an empty styled box — `.signature-line` carries a border-top, so a blank
signature block draws a stray rule across the page.

The consent form carries a second trap: it has two signatures. One is the
clinic's countersignature; the other is the patient's, which is the entire legal
point of the document. Only the first is a display setting.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from domains.consent.consent_templates import resolve_variant as resolve_consent
from domains.infrastructure.services.preview_samples import (
    sample_clinic, sample_consent, sample_patient, sample_prescription_request,
)

PRESCRIPTION_VARIANTS = ['classic', 'compact']


def cfg(template_id, **hidden):
    return SimpleNamespace(
        template_id=template_id, primary_color='#2a276e',
        footer_text='ZZ-FOOTER-ZZ', logo_url=None,
        config_json={'show': {k: False for k in hidden}} if hidden else None,
    )


def render_prescription(variant, **hidden):
    from domains.medical.services.prescription_service import PrescriptionService
    return PrescriptionService(None).render_prescription_html(
        sample_patient(), _clinic(), sample_prescription_request(),
        config_override=cfg(variant, **hidden),
    )


def render_consent(**hidden):
    c = sample_consent()
    return resolve_consent('classic')['render'](
        _clinic(), c['patient_name'], c['patient_id'], c['template_name'],
        c['content'], c['signature_base64'], cfg('classic', **hidden),
    )


def _clinic():
    """The preview fixture, with a licence number it doesn't ship by default."""
    clinic = sample_clinic()
    clinic.license_number = 'MH/DC/12345'
    return clinic


# ── Prescription ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize('variant', PRESCRIPTION_VARIANTS)
@pytest.mark.parametrize('flag,needle', [
    ('address', '12 Marine Drive'),
    ('contact', '+91 22 4000 1234'),
    ('tagline', 'Orthodontic Care'),
    ('footer',  'ZZ-FOOTER-ZZ'),
])
def test_prescription_flag_removes_its_field(variant, flag, needle):
    assert needle in render_prescription(variant), 'fixture should show it by default'
    assert needle not in render_prescription(variant, **{flag: False})


@pytest.mark.parametrize('variant', PRESCRIPTION_VARIANTS)
def test_hiding_the_prescription_signature_removes_the_whole_box(variant):
    """Not just the image. The wrapper was moved out of the HTML file precisely
    so the ruled line and the clinic name go with it."""
    html = render_prescription(variant, signature=False)
    assert '<div class="signature-box">' not in html
    assert 'signature-line' not in html.split('<style>')[-1].split('</style>')[-1]


@pytest.mark.parametrize('variant', PRESCRIPTION_VARIANTS)
def test_hiding_the_prescription_tagline_leaves_no_empty_div(variant):
    html = render_prescription(variant, tagline=False)
    assert '<div class="tagline"></div>' not in html
    assert '<div class="sub"></div>' not in html


@pytest.mark.parametrize('variant', PRESCRIPTION_VARIANTS)
def test_no_unsubstituted_placeholders_survive(variant):
    """The two new placeholders have to be filled on every path, shown or
    hidden — a stray `{{signature_box_html}}` would print literally."""
    for hidden in ({}, {'signature': False}, {'tagline': False}):
        html = render_prescription(variant, **hidden)
        assert '{{' not in html, f'unfilled placeholder with {hidden}'


# ── Consent ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('flag,needle', [
    ('address', '12 Marine Drive'),
    ('contact', '+91 22 4000 1234'),
    ('footer',  'ZZ-FOOTER-ZZ'),
])
def test_consent_flag_removes_its_field(flag, needle):
    assert needle in render_consent(), 'fixture should show it by default'
    assert needle not in render_consent(**{flag: False})


def test_consent_signature_flag_hides_only_the_clinic_countersignature():
    """The patient's signature is what makes a consent form a consent form. No
    display setting may remove it."""
    html = render_consent(signature=False)

    assert '<div class="signature-box">' not in html   # clinic countersignature
    assert 'Authorized Signatory' not in html
    # The patient's block survives untouched.
    assert 'Asha Mehta' in html
    assert 'data:image/png;base64' in html


def test_consent_patient_signature_survives_every_flag_being_off():
    from domains.infrastructure.services.pdf_fields import FIELD_KEYS
    html = render_consent(**{k: False for k in FIELD_KEYS})
    assert 'data:image/png;base64' in html
