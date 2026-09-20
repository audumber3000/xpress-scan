"""The link-to-invoice QR code on the rendered bill.

The rule these protect above all others: a clinic that never switched the QR on
gets exactly the document it always got. The golden tests pin that byte for
byte; these pin the behaviour around the switch itself.
"""
import re
from types import SimpleNamespace as NS

import pytest

from domains.finance.invoice_pdf_engine import generate_invoice_html
from domains.infrastructure.services.pdf_fields import resolve_qr_enabled, sanitize_config_json
from domains.infrastructure.services.preview_samples import sample_invoice

VARIANTS = ['classic', 'modern', 'plain', 'bold', 'banded', 'corporate', 'mono']
QR_IMG = re.compile(r'<img src="data:image/png;base64,[A-Za-z0-9+/=]+"')


def _clinic():
    return NS(id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
              phone='4441112222', email='hi@royalsmile.in', tagline='Smile',
              license_number='MH-DEN-4471', gst_number='27ABCDE1234F1Z5',
              logo_url=None, primary_color='#2a276e', doctor_name='Dr R Sharma',
              doctor_qualifications='BDS', currency_symbol='₹', country='IN',
              tax_label='GST No.', document_doctors=None, timezone='Asia/Kolkata')


def _cfg(variant, qr=None, footer='Thank you for visiting.'):
    return NS(primary_color='#2a276e', footer_text=footer, logo_url=None,
              template_id=variant, config_json=({'qr': qr} if qr is not None else None))


def _invoice(token='TESTtoken0123456789abc'):
    inv = sample_invoice()
    inv.public_token = token
    return inv


@pytest.mark.parametrize('variant', VARIANTS)
def test_no_qr_unless_the_clinic_switched_it_on(variant):
    html = generate_invoice_html(_invoice(), _clinic(), _cfg(variant))
    assert 'Scan to view this invoice' not in html
    assert not QR_IMG.search(html)


@pytest.mark.parametrize('variant', VARIANTS)
def test_the_qr_prints_when_switched_on(variant):
    html = generate_invoice_html(_invoice(), _clinic(), _cfg(variant, {'enabled': True}))
    assert 'Scan to view this invoice' in html
    assert QR_IMG.search(html)
    # The clinic's own footer line survives alongside it.
    assert 'Thank you for visiting.' in html


@pytest.mark.parametrize('variant', VARIANTS)
def test_a_qr_prints_even_when_the_footer_is_hidden(variant):
    html = generate_invoice_html(_invoice(), _clinic(), _cfg(variant, {'enabled': True}, footer=''))
    assert QR_IMG.search(html)


@pytest.mark.parametrize('variant', VARIANTS)
def test_no_token_means_no_code_never_a_dead_one(variant):
    """Tokens are minted before rendering. A render that somehow runs without
    one must print nothing, not a code that scans to a 404."""
    html = generate_invoice_html(_invoice(token=None), _clinic(), _cfg(variant, {'enabled': True}))
    assert not QR_IMG.search(html)


@pytest.mark.parametrize('value, expected', [
    (True, True), ('yes', True), ('on', True), (1, True),
    (False, False), ('banana', False), (None, False), ('', False),
])
def test_only_an_unambiguous_yes_turns_it_on(value, expected):
    assert resolve_qr_enabled(NS(config_json={'qr': {'enabled': value}})) is expected


@pytest.mark.parametrize('config_json', [None, {}, {'qr': 'on'}, {'qr': []}, {'show': {'logo': True}}])
def test_anything_malformed_or_absent_is_off(config_json):
    assert resolve_qr_enabled(NS(config_json=config_json)) is False


def test_saving_keeps_the_setting():
    """Without this the toggle would be dropped on save and silently never work."""
    saved = sanitize_config_json({'show': {'logo': True}, 'qr': {'enabled': True}})
    assert saved['qr'] == {'enabled': True}


def test_the_code_points_at_the_web_app(monkeypatch):
    from domains.finance.invoice_link import public_invoice_url
    monkeypatch.setenv('FRONTEND_URL', 'https://app.molarplus.com/')
    assert public_invoice_url('abc') == 'https://app.molarplus.com/i/abc'


def test_the_fallback_is_the_app_not_the_marketing_site(monkeypatch):
    """molarplus.com is the marketing site and 404s /i/<token>. A missing
    FRONTEND_URL must not silently print codes that go nowhere."""
    from domains.finance.invoice_link import public_invoice_url
    monkeypatch.delenv('FRONTEND_URL', raising=False)
    assert public_invoice_url('abc') == 'https://app.molarplus.com/i/abc'
