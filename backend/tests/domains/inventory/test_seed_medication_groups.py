"""The default prescription sets every clinic starts with."""
from models import MedicationGroup
from domains.inventory.seed_medication_groups import (
    add_missing_sets, seed_clinic_medication_groups,
)
from domains.inventory.starter_medication_sets import STARTER_SETS

# These shipped before and are already in some clinics' lists. Renaming one
# would hand those clinics a near-duplicate beside the set they already have.
SHIPPED_NAMES = {'After extraction', 'Root canal, between visits', 'Pain only, no antibiotic',
                 'Gum infection', 'Ulcers and soreness'}


def _names(db, clinic_id):
    return {g.name for g in db.query(MedicationGroup).filter_by(clinic_id=clinic_id)}


def test_seeds_every_default_once(db_session, test_clinic):
    assert seed_clinic_medication_groups(db_session, test_clinic.id) == len(STARTER_SETS)
    assert seed_clinic_medication_groups(db_session, test_clinic.id) == 0
    assert len(_names(db_session, test_clinic.id)) == len(STARTER_SETS)


def test_a_deleted_set_stays_deleted(db_session, test_clinic):
    seed_clinic_medication_groups(db_session, test_clinic.id)
    gone = db_session.query(MedicationGroup).filter_by(
        clinic_id=test_clinic.id, name='After scaling and cleaning').first()
    db_session.delete(gone)
    db_session.commit()

    seed_clinic_medication_groups(db_session, test_clinic.id)
    assert 'After scaling and cleaning' not in _names(db_session, test_clinic.id)


def test_the_button_brings_one_back_on_purpose(db_session, test_clinic):
    seed_clinic_medication_groups(db_session, test_clinic.id)
    # An ORM delete, the way the endpoint does it: a bulk query delete skips the
    # cascade and leaves the set's lines pointing at a row that is gone.
    db_session.delete(db_session.query(MedicationGroup).filter_by(
        clinic_id=test_clinic.id, name='Dry socket').first())
    db_session.commit()
    assert add_missing_sets(db_session, test_clinic.id) == ['Dry socket']


def test_previously_shipped_names_are_unchanged():
    assert SHIPPED_NAMES <= {s['name'] for s in STARTER_SETS}


def test_amoxicillin_500_is_always_three_times_a_day():
    """500mg twice a day is under the usual regimen; twice a day is for 875mg."""
    for s in STARTER_SETS:
        for i in s['items']:
            if i['medicine_name'] == 'Amoxicillin 500mg':
                assert i['dosage'] == '1-1-1', s['name']


def test_the_child_set_is_dosed_by_weight():
    child = [s for s in STARTER_SETS if s['audience'] == 'child']
    assert child
    for s in child:
        for i in s['items']:
            assert 'kg' in (i['notes'] or ''), 'a child dose must be weight-based'
