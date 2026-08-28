"""
A NULL column must never be able to refuse a request.

Four separate incidents on the sign-in path have had the same shape: a response
model rejected a row that already existed, and turned a data quirk into a 500 on
login for one specific person, on every attempt, with no way for them to fix it.
Each was fixed for the one field involved, which is why there was a next one.

The fourth was found by starting the server against a real database rather than
by any test, and in that database 3 of 18 users had a NULL `sync_status` and 2
had NULL `permissions`. Every one of those accounts was unable to sign in.

So these tests are written against the RULE rather than against the fields that
happen to have caused trouble: every non-required field of every response model
must survive being None. A new column added later is covered without anybody
remembering to come back here.
"""
from datetime import datetime

import pytest

from core.dtos import ClinicResponseDTO, UserCreateDTO, UserResponseDTO


def _all_null_row(model, **required):
    """A stand-in for a SQLAlchemy row where every optional column is NULL."""
    attrs = {name: None for name in model.model_fields}
    attrs.update(required)
    return type("Row", (), attrs)()


NOW = datetime(2026, 8, 27, 12, 0, 0)


class TestUserResponseSurvivesNulls:
    def test_every_optional_field_can_be_null(self):
        """The general rule, not a list of the fields that have bitten so far."""
        row = _all_null_row(UserResponseDTO, id=1, created_at=NOW, updated_at=NOW, clinics=[])
        dto = UserResponseDTO.model_validate(row, from_attributes=True)

        for name, field in UserResponseDTO.model_fields.items():
            if field.is_required():
                continue
            value = getattr(dto, name)
            if field.annotation is not None and "Optional" in str(field.annotation):
                continue  # genuinely nullable, None is the right answer
            assert value is not None, f"{name} came back None and would fail serialisation"

    @pytest.mark.parametrize(
        "field, expected",
        [
            ("sync_status", "local"),   # the fourth incident
            ("permissions", {}),
            ("is_active", True),
            ("first_name", ""),
            ("last_name", ""),
            ("name", ""),
            ("role", ""),
        ],
    )
    def test_named_columns_fall_back_to_their_default(self, field, expected):
        row = _all_null_row(UserResponseDTO, id=1, created_at=NOW, updated_at=NOW, clinics=[])
        dto = UserResponseDTO.model_validate(row, from_attributes=True)
        assert getattr(dto, field) == expected

    def test_a_null_timestamp_does_not_refuse_the_row(self):
        """Two super_admin rows in production have a NULL updated_at.

        These fields were required, so those accounts returned a 500 on every
        single sign-in. Nothing in the web or mobile app reads a timestamp off
        the user object, so refusing the whole row bought nobody anything.
        """
        row = _all_null_row(UserResponseDTO, id=1, created_at=NOW, clinics=[])
        dto = UserResponseDTO.model_validate(row, from_attributes=True)
        assert dto.updated_at is None
        assert dto.id == 1

    def test_a_missing_id_is_still_refused(self):
        """Where the line sits. Without an id the object means nothing and no
        caller can do anything with it, so that one should still fail."""
        row = _all_null_row(UserResponseDTO, created_at=NOW, updated_at=NOW, clinics=[])
        with pytest.raises(Exception):
            UserResponseDTO.model_validate(row, from_attributes=True)

    def test_a_genuinely_nullable_field_stays_none(self):
        """The rule fills in defaults; it does not invent values for Optionals."""
        row = _all_null_row(UserResponseDTO, id=1, created_at=NOW, updated_at=NOW, clinics=[])
        dto = UserResponseDTO.model_validate(row, from_attributes=True)
        assert dto.username is None
        assert dto.clinic_id is None
        assert dto.phone is None

    def test_a_role_this_build_has_not_heard_of_still_serialises(self):
        """It is a real row somebody is signed in as. Refusing to describe it
        locks that person out until a deploy."""
        dto = UserResponseDTO(
            id=1, created_at=NOW, updated_at=NOW,
            first_name="A", last_name="B", name="A B", role="hygienist_v2",
        )
        assert dto.role == "hygienist_v2"


class TestClinicResponseSurvivesNulls:
    """Never seen in the wild yet, and that is the point: this model has the
    same eleven-defaulted-fields shape, and login returns it alongside the user."""

    def test_every_optional_field_can_be_null(self):
        row = _all_null_row(ClinicResponseDTO, id=1, name="Sunshine Dental",
                            created_at=NOW, updated_at=NOW)
        dto = ClinicResponseDTO.model_validate(row, from_attributes=True)
        assert dto.status == "active"
        assert dto.sync_status == "local"
        assert dto.country == "IN"
        assert dto.currency_code == "INR"
        assert dto.number_of_chairs == 1


class TestWritePathStaysStrict:
    """The relaxation is for responses only. Rejecting bad input is the whole
    job of a write model, and loosening it would let the bad rows in that the
    response models are having to tolerate."""

    def test_a_blank_name_is_still_refused_on_create(self):
        with pytest.raises(Exception):
            UserCreateDTO(email="a@b.com", first_name="", last_name="B",
                          role="doctor", password="12345678")

    def test_an_unknown_role_is_still_refused_on_create(self):
        with pytest.raises(Exception):
            UserCreateDTO(email="a@b.com", first_name="A", last_name="B",
                          role="not_a_real_role", password="12345678")

    def test_a_short_password_is_still_refused(self):
        with pytest.raises(Exception):
            UserCreateDTO(email="a@b.com", first_name="A", last_name="B",
                          role="doctor", password="short")
