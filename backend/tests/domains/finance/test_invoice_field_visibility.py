"""What the show/hide toggles actually do to an invoice.

The golden tests already prove the default path is byte-identical. These prove
the flags do the thing they claim, on both variants, and — the part that is easy
to get wrong — that hiding a field never leaves debris behind: no orphan
separator, no empty styled block, no column of figures that stops adding up.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from domains.finance.invoice_pdf_engine import generate_invoice_html
from tests.domains.finance.test_invoice_pdf_golden import _sample_clinic, _sample_invoice

VARIANTS = ['classic', 'modern']

# Distinctive on purpose: classic hardcodes "This is a computer-generated
# invoice..." into its terms, so a natural-sounding footer can't be told apart
# from boilerplate that is supposed to stay.
FOOTER = 'ZZ-CONFIGURABLE-FOOTER-ZZ'


def cfg(variant, **hidden):
    """A config for `variant` with the named fields switched off."""
    return SimpleNamespace(
        template_id=variant,
        primary_color='#FF9800',
        footer_text=FOOTER,
        logo_url=None,
        config_json={'show': {k: False for k in hidden}} if hidden else None,
    )


def render(variant, **hidden):
    return generate_invoice_html(_sample_invoice(), _sample_clinic(), cfg(variant, **hidden))


# ── Each flag hides its field, and only its field ────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
@pytest.mark.parametrize('flag,needle', [
    ('address',        '12 Marine Drive, Mumbai 400020'),
    ('contact',        '+91 22 4000 1234'),
    ('tax_number',     '27ABCDE1234F1Z5'),
    ('tagline',        'Orthodontic Care'),
    ('license_number', 'MH/DC/12345'),
    ('footer',         FOOTER),
])
def test_flag_removes_its_field(variant, flag, needle):
    assert needle in render(variant), 'fixture should show it by default'
    assert needle not in render(variant, **{flag: False})


@pytest.mark.parametrize('variant', VARIANTS)
def test_hiding_contact_keeps_the_address(variant):
    """They share a letterhead line on modern — hiding one must not take the
    other with it."""
    html = render(variant, contact=False)
    assert '12 Marine Drive, Mumbai 400020' in html
    assert '+91 22 4000 1234' not in html


@pytest.mark.parametrize('variant', VARIANTS)
def test_hiding_a_field_leaves_no_orphan_separator(variant):
    """Modern joins doctor / tagline / address into one div. Blanking a part
    used to leave a dangling ' · ' hanging in the letterhead."""
    for hidden in ({'address': False}, {'tagline': False}, {'contact': False},
                   {'address': False, 'tagline': False, 'contact': False}):
        html = render(variant, **hidden)
        assert '·  ·' not in html
        assert '> ·' not in html and '· <' not in html
        assert 'Tel:  ' not in html


@pytest.mark.parametrize('variant', VARIANTS)
def test_hiding_the_signature_removes_the_whole_block(variant):
    """Not just the image — the ruled line and caption go too, or the page ends
    with a stray horizontal rule."""
    html = render(variant, signature=False)
    assert 'Authorized Signatory' not in html   # classic
    assert 'Authorised Signatory' not in html   # modern
    # The wrapper too, not just the caption — the CSS rules stay behind either
    # way, so assert on the emitted markup rather than the class name.
    assert '<div class="signature-box">' not in html
    assert '<div class="sig">' not in html


# ── Discount: the totals must still reconcile ────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_discount_shown_by_default(variant):
    html = render(variant)
    assert 'Discount' in html
    assert '6,000.00' in html   # pre-discount subtotal
    assert '500.00' in html     # the concession


@pytest.mark.parametrize('variant', VARIANTS)
def test_hiding_the_discount_nets_it_into_the_subtotal(variant):
    """The concession disappears from the page, and Subtotal becomes the
    post-discount figure so Subtotal + tax still equals the Grand Total. Leaving
    the gross subtotal would show the patient arithmetic that doesn't work."""
    html = render(variant, discount=False)

    assert 'Discount' not in html
    assert '6,000.00' not in html, 'gross subtotal must not survive'
    assert '5,500.00' in html, 'subtotal should be net of the discount'
    assert '6,490.00' in html, 'grand total is unchanged'


@pytest.mark.parametrize('variant', VARIANTS)
def test_hiding_the_discount_also_hides_the_post_issue_breakdown(variant):
    """The itemised 'granted after this invoice was issued' block names the
    staff member who approved it — exactly what a clinic hiding discounts does
    not want on the patient's copy."""
    invoice = _sample_invoice()
    invoice.post_issue_discounts = [SimpleNamespace(
        value=100.0, discount_type='amount', amount=100.0,
        reason='Goodwill', applied_at=None,
        user=SimpleNamespace(name='Dr. R. Sharma'),
    )]
    shown = generate_invoice_html(invoice, _sample_clinic(), cfg(variant))
    hidden = generate_invoice_html(invoice, _sample_clinic(), cfg(variant, discount=False))

    assert 'Goodwill' in shown
    assert 'Goodwill' not in hidden


# ── Nothing appears that wasn't asked for ────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_a_blank_clinic_field_stays_absent_when_the_flag_is_on(variant):
    """A flag may only ever hide. Turning one on must not print an empty
    'Reg No:' or a bare tagline div for a clinic that never filled it in."""
    clinic = _sample_clinic()
    clinic.tagline = ''
    clinic.license_number = ''
    clinic.address = ''
    clinic.gst_number = ''

    html = generate_invoice_html(_sample_invoice(), clinic, cfg(variant))

    assert 'Reg No:' not in html
    assert 'class="tagline"></div>' not in html
    assert 'GSTIN:' not in html


# ── The phantom-field regression ─────────────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_a_clinic_with_no_tagline_prints_no_tagline(variant):
    """`clinics.tagline` did not exist as a column for a long time, so
    `getattr(clinic, 'tagline', 'Comprehensive Dental & Orthodontic Care')`
    always fell through to its default — every clinic's invoice claimed that
    strapline whether or not it was true. No test caught it because every
    fixture sets a tagline. This is that test."""
    clinic = _sample_clinic()
    clinic.tagline = None

    html = generate_invoice_html(_sample_invoice(), clinic, cfg(variant))

    assert 'Comprehensive Dental' not in html
    assert 'None' not in html.split('<style>')[0] + html.split('</style>')[-1]


@pytest.mark.parametrize('variant', VARIANTS)
def test_the_licence_line_reads_the_real_column(variant):
    """Renderers used to ask for `clinic.reg_number`, which is not a column, so
    the 'Reg No:' line never once printed in production. It reads
    `license_number` — the field Clinic Details actually collects — now."""
    clinic = _sample_clinic()
    clinic.license_number = 'KA/DC/99887'

    html = generate_invoice_html(_sample_invoice(), clinic, cfg(variant))
    assert 'KA/DC/99887' in html
