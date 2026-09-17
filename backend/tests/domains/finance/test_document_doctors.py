"""The doctors named across the top of a clinic's documents.

Every renderer resolved exactly one doctor — whoever treated the patient that
day — so a two-partner practice had a letterhead our invoices, prescriptions and
consent forms could not reproduce.

The rule these tests exist to hold down is the same one that governs every other
setting in pdf_fields: **empty means unchanged**. A clinic that never fills this
in must get byte-for-byte the document it has always had, which is also what the
golden files assert. So most of what follows is about the absence of the
feature, not its presence.
"""
from types import SimpleNamespace as NS

import pytest

from domains.infrastructure.services.pdf_fields import (
    ALL_VISIBLE, MAX_DOCUMENT_DOCTORS, FieldVisibility, document_doctor_lines,
    resolve_document_doctors, sanitize_document_doctors,
)

PANEL = [
    {'name': 'Dr Anita Rao', 'qualifications': 'BDS, MDS (Ortho)'},
    {'name': 'Dr S Patel', 'qualifications': 'BDS'},
]


# ─── Sanitising what the clinic typed ────────────────────────────────────────

def test_a_clean_list_survives_intact():
    assert sanitize_document_doctors(PANEL) == PANEL


def test_a_row_with_no_name_is_dropped():
    """A blank line prints as a gap in the letterhead, so it is never stored."""
    out = sanitize_document_doctors([{'name': '  ', 'qualifications': 'BDS'}] + PANEL)
    assert out == PANEL


def test_unknown_keys_do_not_reach_the_column():
    out = sanitize_document_doctors([{'name': 'Dr A', 'colour': 'red', 'x': [1, 2, 3]}])
    assert out == [{'name': 'Dr A', 'qualifications': ''}]


def test_a_bare_string_is_taken_as_a_name():
    assert sanitize_document_doctors(['Dr A']) == [{'name': 'Dr A', 'qualifications': ''}]


def test_the_list_is_capped():
    out = sanitize_document_doctors([{'name': f'Dr {i}'} for i in range(50)])
    assert len(out) == MAX_DOCUMENT_DOCTORS


@pytest.mark.parametrize('raw', [None, [], 'Dr A', {'name': 'Dr A'}, 0, [{}], [None]])
def test_anything_unusable_is_no_panel_at_all(raw):
    """Never a guess. Nothing usable means the renderers fall back to the single
    treating doctor, which is the behaviour every clinic has today."""
    assert sanitize_document_doctors(raw) is None


def test_stored_values_are_escaped_on_the_way_out():
    clinic = NS(document_doctors=[{'name': 'Dr <script>', 'qualifications': 'B&S'}])
    out = resolve_document_doctors(clinic)
    assert out[0].name == 'Dr &lt;script&gt;'
    assert out[0].qualifications == 'B&amp;S'


# ─── Who the header ends up naming ───────────────────────────────────────────

def test_no_panel_falls_back_to_the_one_doctor():
    lines = document_doctor_lines(NS(document_doctors=None), ALL_VISIBLE,
                                  'Dr R Sharma', 'BDS')
    assert [(d.name, d.qualifications) for d in lines] == [('Dr R Sharma', 'BDS')]


def test_no_panel_and_no_doctor_names_nobody():
    assert document_doctor_lines(NS(document_doctors=None), ALL_VISIBLE, '', '') == ()


def test_a_panel_replaces_the_single_name():
    """It does not join it. The panel IS the letterhead's list of doctors, and
    adding today's treating doctor on top would name one of them twice."""
    lines = document_doctor_lines(NS(document_doctors=PANEL), ALL_VISIBLE,
                                  'Dr R Sharma', 'BDS')
    assert [d.name for d in lines] == ['Dr Anita Rao', 'Dr S Patel']
    assert 'Dr R Sharma' not in [d.name for d in lines]


def test_hiding_the_doctor_name_hides_the_whole_panel():
    lines = document_doctor_lines(NS(document_doctors=PANEL),
                                  FieldVisibility(doctor_name=False), 'Dr R', 'BDS')
    assert lines == ()


def test_hiding_qualifications_strips_them_from_every_name():
    lines = document_doctor_lines(NS(document_doctors=PANEL),
                                  FieldVisibility(doctor_qualifications=False), '', '')
    assert [d.name for d in lines] == ['Dr Anita Rao', 'Dr S Patel']
    assert {d.qualifications for d in lines} == {''}


# ─── What actually lands on each document ────────────────────────────────────

def _clinic(**over):
    base = dict(
        id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
        phone='4441112222', email='hi@royalsmile.in', tagline='Smile with confidence',
        license_number='MH-DEN-4471', gst_number='27ABCDE1234F1Z5', logo_url=None,
        primary_color='#2a276e', doctor_name='Dr R Sharma', doctor_qualifications='BDS',
        currency_symbol='₹', country='IN', tax_label='GST No.', document_doctors=None,
    )
    base.update(over)
    return NS(**base)


def _cfg(template_id):
    return NS(primary_color='#2a276e', footer_text='', logo_url=None,
              template_id=template_id, config_json=None)


def _invoice():
    from domains.infrastructure.services.preview_samples import sample_invoice
    return sample_invoice()


@pytest.mark.parametrize('variant', ['classic', 'modern'])
def test_the_invoice_letterhead_names_every_doctor(variant):
    from domains.finance.invoice_pdf_engine import generate_invoice_html
    html = generate_invoice_html(_invoice(), _clinic(document_doctors=PANEL), _cfg(variant))
    assert 'Dr Anita Rao' in html
    assert 'Dr S Patel' in html


@pytest.mark.parametrize('variant', ['classic', 'modern'])
def test_an_unconfigured_invoice_still_names_the_one_doctor(variant):
    from domains.finance.invoice_pdf_engine import generate_invoice_html
    html = generate_invoice_html(_invoice(), _clinic(), _cfg(variant))
    assert 'Dr R Sharma' in html


@pytest.mark.parametrize('variant', ['classic', 'compact', 'letterhead', 'accent'])
def test_the_prescription_letterhead_names_every_doctor(variant):
    from domains.infrastructure.services.preview_samples import (
        sample_patient, sample_prescription_request,
    )
    from domains.medical.services.prescription_service import PrescriptionService
    html = PrescriptionService(None).render_prescription_html(
        sample_patient(), _clinic(document_doctors=PANEL),
        sample_prescription_request(), config_override=_cfg(variant),
    )
    assert 'Dr Anita Rao' in html
    assert 'Dr S Patel' in html


def test_the_prescription_signature_still_names_who_actually_prescribed():
    """A letterhead listing two partners does not mean two people signed it."""
    from domains.infrastructure.services.preview_samples import (
        sample_patient, sample_prescription_request,
    )
    from domains.medical.services.prescription_service import PrescriptionService
    html = PrescriptionService(None).render_prescription_html(
        sample_patient(), _clinic(document_doctors=PANEL),
        sample_prescription_request(), config_override=_cfg('classic'),
        doctor=NS(name='Dr Visiting Locum', qualifications='BDS', signature_url=None),
    )
    signature = html.split('signature-box', 1)[1]
    assert 'Dr Visiting Locum' in signature


def test_the_consent_letterhead_names_every_doctor():
    from domains.consent.consent_templates import resolve_variant
    html = resolve_variant('classic')['render'](
        clinic=_clinic(document_doctors=PANEL),
        patient_name='Asha Mehta', patient_id=7,
        template_name='Root Canal — Informed Consent',
        content='I consent to the procedure.', signature_base64=None,
        config=_cfg('classic'),
    )
    assert 'Dr Anita Rao' in html
    assert 'Dr S Patel' in html
