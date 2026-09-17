"""What has been paid, printed where the bill adds up.

The receipt ends its summary with "Total Paid So Far" and a highlighted
"Balance Due, as on <date>". The invoice now ends the same way when money has
been paid against it — as rows of its own totals table, not as a separate panel.
An earlier version printed a bordered box listing the instalments, which on the
classic layout sat above the treatment table; these tests keep it gone.
"""
import datetime
import re
from types import SimpleNamespace as NS

import pytest

from domains.finance.invoice_pdf_engine import generate_invoice_html
from domains.finance.invoice_templates.payment_block import balance_rows, payment_summary

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
              tax_label='GST No.', document_doctors=None, timezone='Asia/Kolkata')


def _invoice(payments=(), total=2100.0):
    from domains.infrastructure.services.preview_samples import sample_invoice
    inv = sample_invoice()
    inv.total = total
    inv.payments = list(payments)
    return inv


def _cfg(variant):
    return NS(primary_color='#2a276e', footer_text='', logo_url=None,
              template_id=variant, config_json=None)


def _html(variant, payments):
    return generate_invoice_html(_invoice(payments), _clinic(), _cfg(variant))


def _text(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))


# ─── The sum ─────────────────────────────────────────────────────────────────

def test_it_adds_the_instalments_up():
    assert payment_summary(_invoice([_payment(300, 1), _payment(200, 10)])) == (500.0, 1600.0, 2)


def test_a_bill_with_no_payments_has_nothing_to_add():
    assert payment_summary(_invoice([])) is None
    assert balance_rows(_invoice([]), _clinic()) is None


def test_a_zero_payment_is_not_a_payment():
    assert payment_summary(_invoice([_payment(0, 1)])) is None


def test_overpayment_never_shows_a_negative_balance():
    b = balance_rows(_invoice([_payment(3000, 1)]), _clinic())
    assert b.due == 0.0 and b.settled


def test_the_balance_is_dated_in_the_clinics_own_today():
    b = balance_rows(_invoice([_payment(500, 1)]), _clinic())
    assert re.fullmatch(r'\d{2} [A-Z][a-z]+ \d{4}', b.as_on)


# ─── On every layout ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_paid_and_balance_are_rows_of_the_totals(variant):
    text = _text(_html(variant, [_payment(500, 14)])).lower()
    for label in ('paid so far', 'balance due', 'as on'):
        assert label in text, (variant, label)
    assert '500.00' in text and '1,600.00' in text


@pytest.mark.parametrize('variant', VARIANTS)
def test_they_come_after_the_total_and_in_the_receipts_order(variant):
    text = _text(_html(variant, [_payment(500, 14)])).lower()
    # The total's own label differs by layout; its amount does not.
    at_total = text.rindex('2,100.00')
    at_paid = text.index('paid so far')
    at_balance = text.index('balance due')
    assert at_total < at_paid < at_balance, variant


@pytest.mark.parametrize('variant', VARIANTS)
def test_the_balance_is_the_highlighted_row_not_the_total(variant):
    html = _html(variant, [_payment(500, 14)])
    grand_rows = re.findall(r'<tr class="grand(?:-total)?">(.*?)</tr>', html, re.S)
    assert len(grand_rows) == 1, variant
    assert 'balance due' in grand_rows[0].lower()
    assert '1,600.00' in grand_rows[0]


@pytest.mark.parametrize('variant', VARIANTS)
def test_there_is_no_separate_box_any_more(variant):
    html = _html(variant, [_payment(300, 1), _payment(200, 10)])
    # Words only the old box printed. (Not its border style: Bold uses a
    # left rule of its own in the header.)
    for gone in ('Part paid', 'payments received', 'Paid in full'):
        assert gone not in html, (variant, gone)


def test_on_classic_nothing_is_added_above_the_treatment_table():
    html = _html('classic', [_payment(500, 14)])
    above_items = html.split('<table class="items-table">', 1)[0]
    assert 'Paid So Far' not in above_items
    assert 'Balance Due' not in above_items


@pytest.mark.parametrize('variant', VARIANTS)
def test_an_unpaid_bill_is_unchanged(variant):
    html = _html(variant, [])
    text = _text(html).lower()
    assert 'paid so far' not in text and 'balance due' not in text
    # ...and its total keeps the highlight.
    grand_rows = re.findall(r'<tr class="grand(?:-total)?">(.*?)</tr>', html, re.S)
    assert len(grand_rows) == 1 and '2,100.00' in grand_rows[0]
