"""The letters after a doctor's name.

Small, bold, on the line under the name — which is how a printed prescription
pad sets them, and what a clinic recognises as correct.

The rule that needed testing more than the rendering: the letters travel with
whichever doctor was resolved. A document takes its doctor from the appointment
when there is one and falls back to the clinic otherwise, and qualifications
that resolve on their own path are how an owner's MDS ends up printed under a
visiting associate's name.
"""
from types import SimpleNamespace as NS

import pytest

from domains.finance.invoice_templates import INVOICE_VARIANTS
from domains.infrastructure.services.pdf_fields import FIELD_KEYS
from domains.infrastructure.services.preview_samples import (
    preview_clinic, sample_invoice, sample_patient, sample_prescription_request,
)
from domains.medical.services.prescription_service import PrescriptionService

QUALS = 'BDS, MDS (Orthodontics)'
INVOICE_VARIANT_IDS = sorted(INVOICE_VARIANTS)
RX_VARIANTS = ['plain', 'classic', 'compact', 'letterhead', 'accent']


def _clinic(quals=QUALS, doctor='Dr R Sharma'):
    return preview_clinic(NS(
        id=1, name='Sharma Dental Clinic', address='5521 Maliwada', phone='4441112222',
        email='hi@sharma.in', tagline='Smile', license_number='MH-1', logo_url=None,
        primary_color='#2a276e', currency_symbol='₹', country='IN', gst_number='27ABC',
    ), doctor_name=doctor, doctor_qualifications=quals)


def _cfg(template_id, show=None):
    return NS(primary_color='#2a276e', footer_text='', logo_url=None,
              template_id=template_id, config_json=({'show': show} if show else None))


def _invoice(variant, show=None, clinic=None):
    return INVOICE_VARIANTS[variant]['render'](
        sample_invoice(), clinic or _clinic(), _cfg(variant, show))


def _rx(variant, show=None, clinic=None, doctor=None):
    return PrescriptionService(None).render_prescription_html(
        sample_patient(), clinic or _clinic(), sample_prescription_request(),
        config_override=_cfg(variant, show), doctor=doctor)


# ── Rendering ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_every_invoice_variant_prints_them(variant):
    assert QUALS in _invoice(variant)


@pytest.mark.parametrize("variant", RX_VARIANTS)
def test_every_prescription_variant_prints_them(variant):
    assert QUALS in _rx(variant)


def test_consent_prints_them():
    from domains.consent.consent_templates import resolve_variant
    html = resolve_variant('classic')['render'](
        clinic=_clinic(), patient_name='Asha Mehta', patient_id='PT-42',
        template_name='Extraction Consent', content='<p>I consent.</p>',
        signature_base64='', config=_cfg('classic'),
    )
    assert QUALS in html


@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_they_are_set_small_and_bold(variant):
    """Not a design flourish: they are a subordinate line under the name, and
    at the name's own weight they read as a second person."""
    html = _invoice(variant)
    i = html.index(QUALS)
    block = html[max(0, i - 200):i]
    assert 'font-weight:700' in block
    assert 'font-size:9' in block


# ── The toggle ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_the_toggle_hides_them_on_invoices(variant):
    assert QUALS not in _invoice(variant, {'doctor_qualifications': False})


@pytest.mark.parametrize("variant", RX_VARIANTS)
def test_the_toggle_hides_them_on_prescriptions(variant):
    assert QUALS not in _rx(variant, {'doctor_qualifications': False})


@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_they_default_to_shown(variant):
    """Every flag in this module defaults to shown, so a clinic that fills the
    field in gets it on the document without hunting for a switch."""
    assert QUALS in _invoice(variant, {})


@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_hiding_the_doctor_hides_the_letters_too(variant):
    """"BDS, MDS" floating under no name at all is not a thing anybody asked
    for, so the name's flag governs both."""
    assert QUALS not in _invoice(variant, {'doctor_name': False})


@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_a_clinic_that_has_not_filled_them_in_prints_nothing_extra(variant):
    """The field is new, so almost every clinic has it empty. None of them
    should see a stray bold line, an empty element or a dangling comma."""
    html = _invoice(variant, clinic=_clinic(quals=''))
    assert 'font-weight:700;color:#6B7280' not in html


@pytest.mark.parametrize("variant", INVOICE_VARIANT_IDS)
def test_letterhead_mode_drops_them_with_the_rest_of_the_header(variant):
    cfg = NS(primary_color='#2a276e', footer_text='', logo_url=None, template_id=variant,
             config_json={'letterhead': {'enabled': True, 'top_mm': 45, 'bottom_mm': 20,
                                         'left_mm': 30, 'right_mm': 28}})
    html = INVOICE_VARIANTS[variant]['render'](sample_invoice(), _clinic(), cfg)
    # The signature block survives letterhead mode, and the letters go with the
    # name there — but the clinic's printed header must not be duplicated.
    assert html.count(QUALS) <= 1


# ── They follow the doctor, not the clinic ──────────────────────────────────

def test_the_prescribing_doctors_letters_win_over_the_clinics():
    """The whole reason this is resolved alongside the name rather than
    separately."""
    associate = NS(name='Dr A Kulkarni', qualifications='BDS', signature_url=None)
    html = _rx('classic', doctor=associate)
    assert 'BDS' in html
    assert 'MDS (Orthodontics)' not in html


def test_an_invoice_takes_them_from_the_appointments_doctor():
    invoice = sample_invoice()
    invoice.appointment = NS(
        doctor=NS(name='Dr A Kulkarni', qualifications='BDS', signature_url=None))
    html = INVOICE_VARIANTS['classic']['render'](invoice, _clinic(), _cfg('classic'))
    assert 'Dr A Kulkarni' in html
    assert 'MDS (Orthodontics)' not in html


def test_unticking_everything_leaves_no_letters_anywhere():
    for variant in INVOICE_VARIANT_IDS:
        html = _invoice(variant, {k: False for k in FIELD_KEYS})
        assert QUALS not in html, variant
