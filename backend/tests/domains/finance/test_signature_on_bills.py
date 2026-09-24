"""A doctor's uploaded signature reaches every bill and receipt.

It used to be looked up on the appointment only, so a bill raised from a case
paper, or with no visit at all, printed an empty signature line; five receipt
styles read it off the payment row, which has no such column, and never
printed one at all.
"""
from types import SimpleNamespace

import pytest

from domains.finance.invoice_templates import INVOICE_VARIANTS
from domains.finance.receipt_templates import RECEIPT_VARIANTS
from domains.finance.signing_doctor import signing_doctor
from domains.infrastructure.services.preview_samples import config_from_payload
from models import CasePaper, Invoice, User

# A 1x1 PNG, the shape the upload endpoint stores.
DOCTOR_SIG = ('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlE'
              'QVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
OWNER_SIG = DOCTOR_SIG.replace('Jggg', 'JgAA')


@pytest.fixture
def doctor(db_session, test_clinic):
    doc = User(clinic_id=test_clinic.id, email='assoc@example.com', name='Dr Associate',
               first_name='Dr', last_name='Associate',
               role='doctor', is_active=True, signature_url=DOCTOR_SIG)
    db_session.add(doc)
    db_session.commit()
    return doc


@pytest.fixture
def owner(test_user, db_session):
    test_user.signature_url = OWNER_SIG
    db_session.commit()
    return test_user


def _invoice(db, clinic, patient, **over):
    inv = Invoice(clinic_id=clinic.id, patient_id=patient.id, invoice_number='INV-SIG-1',
                  status='finalized', subtotal=500.0, total=500.0, due_amount=500.0, **over)
    db.add(inv)
    db.commit()
    return inv


def _case_paper_invoice(db, clinic, patient, doctor):
    cp = CasePaper(clinic_id=clinic.id, patient_id=patient.id, dentist_id=doctor.id)
    db.add(cp)
    db.commit()
    return _invoice(db, clinic, patient, case_paper_id=cp.id)


def _payment():
    return SimpleNamespace(amount=500.0, receipt_number='RCPT-1', receipt_paid_to_date=None,
                           receipt_balance_due=None, method='Cash', reference=None, created_at=None)


def test_case_paper_bill_is_signed_by_its_doctor(db_session, test_clinic, test_patient, owner, doctor):
    signer = signing_doctor(_case_paper_invoice(db_session, test_clinic, test_patient, doctor))
    assert signer.doctor.id == doctor.id
    assert signer.signature == DOCTOR_SIG


def test_bill_with_no_visit_is_signed_by_the_owner(db_session, test_clinic, test_patient, owner):
    signer = signing_doctor(_invoice(db_session, test_clinic, test_patient))
    assert signer.doctor is None
    assert signer.signature == OWNER_SIG


def test_treating_doctor_without_a_signature_is_not_signed_by_the_owner(
        db_session, test_clinic, test_patient, owner, doctor):
    """Somebody else's signature under the treating doctor's name is worse
    than an empty line."""
    doctor.signature_url = None
    db_session.commit()
    signer = signing_doctor(_case_paper_invoice(db_session, test_clinic, test_patient, doctor))
    assert signer.signature == ''


@pytest.mark.parametrize('variant', sorted(INVOICE_VARIANTS))
def test_every_invoice_variant_prints_it(variant, db_session, test_clinic, test_patient, doctor):
    inv = _case_paper_invoice(db_session, test_clinic, test_patient, doctor)
    cfg = config_from_payload({'template_id': variant})
    assert DOCTOR_SIG in INVOICE_VARIANTS[variant]['render'](inv, test_clinic, cfg)


@pytest.mark.parametrize('variant', sorted(RECEIPT_VARIANTS))
def test_every_receipt_variant_prints_it(variant, db_session, test_clinic, test_patient, doctor):
    inv = _case_paper_invoice(db_session, test_clinic, test_patient, doctor)
    cfg = config_from_payload({'template_id': variant})
    assert DOCTOR_SIG in RECEIPT_VARIANTS[variant]['render'](inv, _payment(), test_clinic, cfg)
