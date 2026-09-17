"""What has been paid, printed on the bill itself.

An invoice stated the treatment cost and nothing else, so a patient who had paid
two of three instalments was handed a document showing the full amount with no
sign of what they had already given the clinic. The per-payment receipt knew;
the bill did not.
"""
import datetime
from types import SimpleNamespace as NS

import pytest

from domains.finance.invoice_pdf_engine import generate_invoice_html
from domains.finance.invoice_templates.payment_block import (
    payment_summary, render_payment_block,
)

VARIANTS = ['classic', 'modern', 'plain', 'bold', 'banded', 'corporate', 'mono']


def _payment(amount, day, method='UPI'):
    return NS(amount=amount, paid_on=datetime.date(2026, 9, day), method=method,
              created_at=None, reference=None, note=None)


def _clinic():
    return NS(id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
              phone='4441112222', email='hi@royalsmile.in', tagline='Smile',
              license_number='MH-DEN-4471', gst_number='27ABCDE1234F1Z5',
              logo_url=None, primary_color='#2a276e', doctor_name='Dr R Sharma',
              doctor_qualifications='BDS', currency_symbol='₹', country='IN',
              tax_label='GST No.', document_doctors=None)


def _invoice(payments=(), total=5000.0):
    from domains.infrastructure.services.preview_samples import sample_invoice
    inv = sample_invoice()
    inv.total = total
    inv.payments = list(payments)
    return inv


def _cfg(variant):
    return NS(primary_color='#2a276e', footer_text='', logo_url=None,
              template_id=variant, config_json=None)


# ─── The sum itself ──────────────────────────────────────────────────────────

def test_it_adds_the_instalments_up():
    assert payment_summary(_invoice([_payment(2000, 1), _payment(1500, 10)])) == (3500.0, 1500.0, 2)


def test_a_bill_with_no_payments_has_no_summary():
    """The total already IS the amount due. "Paid 0.00" under it says nothing."""
    assert payment_summary(_invoice([])) is None
    assert render_payment_block(_invoice([])) == ''


def test_a_zero_payment_is_not_a_payment():
    assert payment_summary(_invoice([_payment(0, 1)])) is None


def test_overpayment_never_shows_a_negative_balance():
    paid, due, _ = payment_summary(_invoice([_payment(6000, 1)], total=5000))
    assert paid == 6000.0
    assert due == 0.0


def test_a_settled_bill_says_so():
    html = render_payment_block(_invoice([_payment(5000, 1)], total=5000))
    assert 'Paid in full' in html
    assert 'Part paid' not in html


def test_a_part_paid_bill_counts_the_payments():
    html = render_payment_block(_invoice([_payment(2000, 1), _payment(1500, 10)]))
    assert 'Part paid: 2 payments received' in html


def test_one_payment_is_not_pluralised():
    assert '1 payment received' in render_payment_block(_invoice([_payment(2000, 1)]))


# ─── On every layout ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_every_variant_prints_paid_and_due(variant):
    html = generate_invoice_html(
        _invoice([_payment(2000, 1), _payment(1500, 10)]), _clinic(), _cfg(variant))
    assert 'Paid to date' in html
    assert 'Balance due' in html
    assert '3,500.00' in html   # paid
    assert '1,500.00' in html   # due


@pytest.mark.parametrize('variant', VARIANTS)
def test_an_unpaid_bill_is_unchanged(variant):
    """Strictly additive: a bill with no payments renders exactly as it did."""
    html = generate_invoice_html(_invoice([]), _clinic(), _cfg(variant))
    assert 'Paid to date' not in html
    assert 'Balance due' not in html
