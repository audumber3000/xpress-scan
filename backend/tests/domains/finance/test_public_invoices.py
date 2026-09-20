"""What the QR code opens, with no login.

Held to the same rules as the public medical-history forms: the token is the
only key, and a wrong token and a switched-off clinic must be indistinguishable.
"""
import pytest

from models import Invoice, TemplateConfiguration
from domains.finance.invoice_link import ensure_public_token


@pytest.fixture
def qr_config(db_session, test_clinic):
    cfg = TemplateConfiguration(clinic_id=test_clinic.id, category='invoice',
                                template_id='classic', config_json={'qr': {'enabled': True}})
    db_session.add(cfg)
    db_session.commit()
    return cfg


def _invoice(db_session, clinic, patient, status='finalized'):
    inv = Invoice(clinic_id=clinic.id, patient_id=patient.id, invoice_number='INV-TEST-1',
                  status=status, subtotal=1000.0, total=1000.0, due_amount=400.0)
    db_session.add(inv)
    db_session.commit()
    return inv


def test_unknown_token_is_a_404(client):
    res = client.get('/api/v1/public/invoices/notARealTokenAtAll00')
    assert res.status_code == 404


def test_a_real_token_opens_the_summary(client, db_session, test_clinic, test_patient, qr_config):
    inv = _invoice(db_session, test_clinic, test_patient)
    token = ensure_public_token(db_session, inv)

    res = client.get(f'/api/v1/public/invoices/{token}')
    assert res.status_code == 200
    body = res.json()
    assert body['invoice_number'] == 'INV-TEST-1'
    assert body['due'] == 400.0
    # First name only: enough to know the bill is yours, not worth guessing for.
    assert ' ' not in body['patient_first_name']
    assert 'phone' not in {k for k in body if 'patient' in k}


def test_switching_the_qr_off_is_indistinguishable_from_a_wrong_token(
        client, db_session, test_clinic, test_patient, qr_config):
    inv = _invoice(db_session, test_clinic, test_patient)
    token = ensure_public_token(db_session, inv)

    qr_config.config_json = {'qr': {'enabled': False}}
    db_session.commit()

    off = client.get(f'/api/v1/public/invoices/{token}')
    wrong = client.get('/api/v1/public/invoices/notARealTokenAtAll00')
    assert off.status_code == wrong.status_code == 404
    assert off.json() == wrong.json()


def test_draft_invoices_are_never_exposed(client, db_session, test_clinic, test_patient, qr_config):
    inv = _invoice(db_session, test_clinic, test_patient, status='draft')
    token = ensure_public_token(db_session, inv)
    assert client.get(f'/api/v1/public/invoices/{token}').status_code == 404


def test_a_patient_bill_is_never_cached_or_indexed(client, db_session, test_clinic, test_patient, qr_config):
    inv = _invoice(db_session, test_clinic, test_patient)
    token = ensure_public_token(db_session, inv)
    res = client.get(f'/api/v1/public/invoices/{token}')
    assert 'no-store' in res.headers['cache-control']
    assert 'noindex' in res.headers['x-robots-tag']


def test_minting_is_idempotent(db_session, test_clinic, test_patient):
    inv = _invoice(db_session, test_clinic, test_patient)
    first = ensure_public_token(db_session, inv)
    assert ensure_public_token(db_session, inv) == first
    assert len(first) >= 20
