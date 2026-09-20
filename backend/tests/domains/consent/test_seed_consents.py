"""The default consent forms every clinic starts with."""
import re

from models import ConsentTemplate
from domains.consent.seed_consents import seed_clinic_consents
from domains.consent.starter_templates import STARTER_TEMPLATES


def test_seeds_every_form_once(db_session, test_clinic):
    assert seed_clinic_consents(db_session, test_clinic.id) == len(STARTER_TEMPLATES)
    assert seed_clinic_consents(db_session, test_clinic.id) == 0


def test_a_deleted_form_stays_deleted(db_session, test_clinic):
    seed_clinic_consents(db_session, test_clinic.id)
    row = db_session.query(ConsentTemplate).filter_by(clinic_id=test_clinic.id).first()
    name = row.name
    db_session.delete(row)
    db_session.commit()
    seed_clinic_consents(db_session, test_clinic.id)
    assert db_session.query(ConsentTemplate).filter_by(
        clinic_id=test_clinic.id, name=name).count() == 0


def test_no_form_body_contains_html():
    """The renderer escapes the body and wraps each line in <p>. A tag in here
    is printed on the patient's form as literal text, which is what the old
    starter templates did."""
    for t in STARTER_TEMPLATES:
        assert not re.search(r'<[a-zA-Z/]', t['content']), t['name']


def test_no_form_asserts_the_patient_reads_english():
    for t in STARTER_TEMPLATES:
        assert 'English' not in t['content'], t['name']
