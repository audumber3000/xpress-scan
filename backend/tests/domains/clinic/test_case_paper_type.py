"""The switch that turns the dental case paper into a general one.

The risk here is not the feature, it is the default. Every clinic on the system
today writes the dental paper, and this column arrives underneath all of them.
If it defaults to anything other than 'dental', or if it reads as missing on a
row that predates it, the tooth chart vanishes from working dental clinics on
the next deploy. So the default is asserted from three directions: the model,
the response DTO, and a row created before the column existed.
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.dtos import ClinicResponseDTO, ClinicUpdateDTO
from models import Base, Clinic


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_a_new_clinic_writes_the_dental_paper(db):
    c = Clinic(name="New Dental", email="n@c.com", specialization="dental")
    db.add(c)
    db.commit()
    db.refresh(c)
    assert c.case_paper_type == "dental"


def test_a_clinic_can_be_switched_to_the_general_paper(db):
    c = Clinic(name="Skin Clinic", email="s@c.com", specialization="dermatology")
    db.add(c)
    db.commit()

    c.case_paper_type = "general"
    db.commit()
    db.refresh(c)
    assert c.case_paper_type == "general"


def test_switching_does_not_touch_anything_already_written(db):
    """The switch changes what the screen asks for next, not what is on file.
    A clinic that tries the general paper and switches back must find its
    dental history and specialization exactly as they were."""
    c = Clinic(name="Both", email="b@c.com", specialization="dental",
               tagline="Family dentistry since 1998")
    db.add(c)
    db.commit()

    c.case_paper_type = "general"
    db.commit()
    c.case_paper_type = "dental"
    db.commit()
    db.refresh(c)

    assert c.specialization == "dental"
    assert c.tagline == "Family dentistry since 1998"


def test_a_row_written_before_the_column_existed_reads_as_dental(db):
    """The real shape of the risk: a clinic inserted by older code, or by the
    ALTER before its DEFAULT is applied, has NULL here. It must still get the
    tooth chart, so the DTO fills the gap rather than passing NULL through."""
    # Raw SQL, because the model's Python-side default would fill the column
    # in and there would be nothing left to test.
    db.execute(text(
        "INSERT INTO clinics (name, email, specialization, case_paper_type, "
        "created_at, updated_at) VALUES ('Legacy', 'l@c.com', 'dental', NULL, "
        "'2024-01-01 00:00:00', '2024-01-01 00:00:00')"
    ))
    db.commit()

    legacy = db.query(Clinic).filter(Clinic.name == "Legacy").first()
    assert legacy.case_paper_type is None

    dto = ClinicResponseDTO.model_validate(legacy, from_attributes=True)
    assert dto.case_paper_type == "dental"


def test_the_response_dto_defaults_to_dental():
    """Belt and braces: even with the field absent entirely."""
    dto = ClinicResponseDTO(
        id=1, name="X", created_at="2026-01-01T00:00:00", updated_at="2026-01-01T00:00:00",
    )
    assert dto.case_paper_type == "dental"


def test_the_update_dto_leaves_it_alone_unless_asked():
    """PUT /clinics/me drops None values, so a screen that does not send this
    field cannot flip a clinic's case paper as a side effect of saving a phone
    number."""
    update = ClinicUpdateDTO(phone="9876543210")
    assert update.case_paper_type is None
    assert {k: v for k, v in update.dict().items() if v is not None} == {
        "phone": "9876543210",
    }


def test_the_update_dto_carries_the_switch_when_it_is_sent():
    update = ClinicUpdateDTO(case_paper_type="general")
    sent = {k: v for k, v in update.dict().items() if v is not None}
    assert sent == {"case_paper_type": "general"}
