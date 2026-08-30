"""The dermatology case paper's findings survive the trip to the database.

`derm_findings` is one JSON column holding a nested clinical record: skin
profile, a list of lesions each with a dozen fields, scalp and hair findings,
severity indices, investigations and the plan. It is deliberately not twenty
typed columns, which buys the form room to grow and costs exactly one thing —
nothing at the schema level stops a bad write. So the round trip is asserted
here instead.

The case that matters most is the partial update. The doctor changes the
diagnosis and nothing else; the request carries no derm_findings at all. If the
route treated that as "set it to null", an afternoon of examination notes would
vanish on the way to saving one word.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, CasePaper, Clinic, Patient
from schemas import CasePaperCreate, CasePaperUpdate


FINDINGS = {
    "profile": {"fitzpatrick": "IV", "skin_type": "Combination"},
    "history": {
        "duration_value": "8", "duration_unit": "months",
        "onset": "Gradual", "course": "Progressive",
        "symptoms": ["Itching"], "itch_severity": 6,
        "aggravating": ["Sun exposure", "Sweating"],
        "past_treatments": ["Topical steroid (self-prescribed)"],
        "treatment_response": "Improved then relapsed",
        "menstrual_status": "Regular cycles",
    },
    "lesions": [
        {
            "id": "L1", "site": "Cheeks", "morphology": "patch",
            "colour": "Brown", "secondary": ["Hyperpigmentation"],
            "configuration": "Confluent", "distribution": "Symmetrical",
            "border": "Ill defined", "palpation": ["Non-tender"],
            "size_mm": "40", "size_mm_2": "30", "abcde": [],
            "notes": "Malar, spares the philtrum",
        },
        {
            "id": "L2", "site": "Upper back", "morphology": "papule",
            "colour": "Black", "secondary": [], "configuration": "Discrete",
            "distribution": "Localised", "border": "Irregular",
            "palpation": ["Firm"], "size_mm": "8", "size_mm_2": "7",
            "abcde": ["A", "B", "C"], "notes": "",
        },
    ],
    "hair": {
        "is_relevant": True, "complaints": ["Diffuse hair fall"],
        "scale": "ludwig", "stage": "II",
        "pull_test": "Positive", "pull_test_count": "9",
        "scalp_findings": ["Miniaturised hairs"],
        "shaft_findings": ["Variability in diameter"],
        "trichoscopy_notes": "Anisotrichosis, mild peripilar sign",
    },
    "severity": {
        "scales": {"melasma_pattern": "malar", "melasma_depth": "mixed"},
        "scores": {"masi": "14.2"},
    },
    "investigations": {
        "ordered": ["Wood's lamp", "Thyroid profile"],
        "findings": "Partial enhancement",
    },
    "plan": {
        "procedures": ["Q-switched Nd:YAG", "PRP (scalp)"],
        "advice": ["Broad-spectrum sunscreen, reapply every 3 hours"],
    },
    "differential": "PIH, lichen planus pigmentosus",
}


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def clinic(db):
    c = Clinic(name="Skin & Hair", email="s@c.com", specialization="dermatology",
               case_paper_type="general")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def patient(db, clinic):
    p = Patient(clinic_id=clinic.id, name="Meera", phone="9000000001")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _write(db, clinic, patient, findings=None):
    paper = CasePaper(
        clinic_id=clinic.id, patient_id=patient.id, date=dt.datetime(2026, 8, 30),
        status="In Progress", diagnosis="Melasma, mixed type",
        derm_findings=findings,
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return paper


def test_the_whole_record_survives_a_round_trip(db, clinic, patient):
    paper = _write(db, clinic, patient, FINDINGS)
    db.expire_all()

    got = db.query(CasePaper).filter(CasePaper.id == paper.id).first().derm_findings
    assert got == FINDINGS


def test_every_lesion_field_comes_back(db, clinic, patient):
    """A lesion is the part with the most fields and the most to lose."""
    paper = _write(db, clinic, patient, FINDINGS)
    db.expire_all()

    lesions = db.query(CasePaper).filter(CasePaper.id == paper.id).first().derm_findings["lesions"]
    assert len(lesions) == 2

    malar = lesions[0]
    assert malar["site"] == "Cheeks"
    assert malar["morphology"] == "patch"
    assert malar["size_mm"] == "40" and malar["size_mm_2"] == "30"
    assert malar["secondary"] == ["Hyperpigmentation"]

    mole = lesions[1]
    assert mole["abcde"] == ["A", "B", "C"]


def test_hair_and_severity_survive(db, clinic, patient):
    paper = _write(db, clinic, patient, FINDINGS)
    db.expire_all()
    f = db.query(CasePaper).filter(CasePaper.id == paper.id).first().derm_findings

    assert f["hair"]["scale"] == "ludwig"
    assert f["hair"]["stage"] == "II"
    assert f["hair"]["pull_test_count"] == "9"
    assert f["severity"]["scores"]["masi"] == "14.2"
    assert f["severity"]["scales"]["melasma_depth"] == "mixed"


def test_a_dental_case_paper_has_no_derm_findings(db, clinic, patient):
    """Null, not an empty object. A dental paper has nothing to say here and
    should not carry a skeleton of derm keys around."""
    paper = _write(db, clinic, patient, None)
    db.expire_all()
    assert db.query(CasePaper).filter(CasePaper.id == paper.id).first().derm_findings is None


# ── The DTOs, which is where a partial update is decided ─────────────────────

def test_the_create_dto_carries_the_findings():
    dto = CasePaperCreate(
        patient_id=1, date=dt.datetime(2026, 8, 30), derm_findings=FINDINGS,
    )
    assert dto.model_dump()["derm_findings"]["profile"]["fitzpatrick"] == "IV"


def test_the_create_dto_defaults_to_none():
    dto = CasePaperCreate(patient_id=1, date=dt.datetime(2026, 8, 30))
    assert dto.derm_findings is None


def test_a_partial_update_does_not_mention_the_findings(db, clinic, patient):
    """The regression that would cost a whole examination.

    The route applies `model_dump(exclude_unset=True)`, so a request that
    changes only the diagnosis must not carry a derm_findings key at all. If it
    did, it would carry None, and the update loop would write that over a
    recorded examination.
    """
    update = CasePaperUpdate(diagnosis="Melasma, confirmed")
    sent = update.model_dump(exclude_unset=True)

    assert sent == {"diagnosis": "Melasma, confirmed"}
    assert "derm_findings" not in sent

    # And prove it end to end against a stored paper, the way the route does.
    paper = _write(db, clinic, patient, FINDINGS)
    for key, value in sent.items():
        setattr(paper, key, value)
    db.commit()
    db.expire_all()

    fresh = db.query(CasePaper).filter(CasePaper.id == paper.id).first()
    assert fresh.diagnosis == "Melasma, confirmed"
    assert fresh.derm_findings == FINDINGS


def test_findings_can_be_replaced_wholesale(db, clinic, patient):
    """Adding a lesion sends the whole object back, which must overwrite."""
    paper = _write(db, clinic, patient, FINDINGS)

    grown = {**FINDINGS, "lesions": FINDINGS["lesions"] + [
        {"id": "L3", "site": "Shins", "morphology": "plaque", "colour": "Erythematous",
         "secondary": ["Scale"], "configuration": "Discrete", "distribution": "Extensor",
         "border": "Well defined", "palpation": [], "size_mm": "25", "size_mm_2": "20",
         "abcde": [], "notes": ""},
    ]}
    update = CasePaperUpdate(derm_findings=grown)
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(paper, key, value)
    db.commit()
    db.expire_all()

    fresh = db.query(CasePaper).filter(CasePaper.id == paper.id).first()
    assert len(fresh.derm_findings["lesions"]) == 3
    assert fresh.derm_findings["lesions"][2]["site"] == "Shins"


def test_a_paper_written_before_the_column_existed_still_reads(db, clinic, patient):
    """Old case papers have no findings and must not blow up any reader."""
    paper = _write(db, clinic, patient, None)
    db.expire_all()
    fresh = db.query(CasePaper).filter(CasePaper.id == paper.id).first()
    # The frontend runs this through withDermDefaults; the contract from here
    # is simply that it is falsy rather than a broken shape.
    assert not fresh.derm_findings
