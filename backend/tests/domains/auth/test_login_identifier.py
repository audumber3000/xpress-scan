"""
The rule in core.login_identifier, tested against a real database.

This is the regression guard for the single worst class of bug in this product:
an account that exists but cannot be found by the screen trying to find it. A
customer in that state cannot sign in, cannot reset their password, and is told
by the app that they never registered — so they do not raise a ticket, they
just leave. Every case below is a shape that was live in production.

An in-memory SQLite database rather than the Postgres fixture in conftest, so
this runs on any machine without a server. The SQL involved is lower(trim(col))
on both sides, which behaves identically on both engines.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, User
from core.login_identifier import (
    find_user_by_email,
    find_user_by_identifier,
    normalize_email,
    normalize_identifier,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _user(db, **kw):
    kw.setdefault("first_name", "Test")
    kw.setdefault("last_name", "User")
    kw.setdefault("name", "Test User")
    kw.setdefault("role", "clinic_owner")
    kw.setdefault("is_active", True)
    u = User(**kw)
    db.add(u)
    db.commit()
    return u


class TestNormalisation:
    def test_email_is_stored_lower_cased_and_trimmed(self):
        assert normalize_email("  Dr.Sharma@Gmail.COM ") == "dr.sharma@gmail.com"

    def test_email_of_nothing_is_empty_not_an_error(self):
        assert normalize_email(None) == ""

    def test_identifier_keeps_its_case_for_display(self):
        # Lower-casing happens in the comparison, not here: this string is what
        # the audit trail records and what gets shown back to the person.
        assert normalize_identifier("  Reception1 ") == "Reception1"


class TestFindByEmail:
    def test_capital_letters_still_find_the_account(self, db):
        """The lockout. A phone keyboard capitalises the first letter, and the
        account became invisible to login AND to password reset."""
        _user(db, email="dr.sharma@gmail.com")
        assert find_user_by_email(db, "Dr.Sharma@Gmail.com") is not None

    def test_a_stored_capital_is_found_by_a_lower_case_search(self, db):
        """The other direction: rows already in production were written with
        whatever case was typed at signup, so the fix has to work on the data
        as it is, not only on data written from now on."""
        _user(db, email="Dr.Sharma@Gmail.com")
        assert find_user_by_email(db, "dr.sharma@gmail.com") is not None

    def test_a_pasted_address_with_a_trailing_space_is_found(self, db):
        _user(db, email="dr.sharma@gmail.com")
        assert find_user_by_email(db, " dr.sharma@gmail.com ") is not None

    def test_a_stored_trailing_space_is_found_too(self, db):
        _user(db, email="dr.sharma@gmail.com ")
        assert find_user_by_email(db, "dr.sharma@gmail.com") is not None

    def test_a_different_address_is_still_not_found(self, db):
        _user(db, email="dr.sharma@gmail.com")
        assert find_user_by_email(db, "someone.else@gmail.com") is None

    def test_nothing_typed_finds_nobody(self, db):
        _user(db, email="dr.sharma@gmail.com")
        assert find_user_by_email(db, "") is None
        assert find_user_by_email(db, None) is None


class TestExactWins:
    def test_the_exactly_typed_row_wins_over_its_case_variant(self, db):
        """Production can hold BOTH rows, because the uniqueness check used to
        be case-sensitive too. A purely loose lookup would return whichever the
        database handed back first, which could sign somebody into the wrong
        clinic. Exact-first makes that impossible."""
        _user(db, email="Dr@x.com", name="Capitalised")
        _user(db, email="dr@x.com", name="Lower case")

        assert find_user_by_email(db, "Dr@x.com").name == "Capitalised"
        assert find_user_by_email(db, "dr@x.com").name == "Lower case"

    def test_a_third_casing_falls_back_and_still_gets_someone(self, db):
        """Neither row matches exactly, so the loose pass runs. Which of the
        two it returns is not defined — that a duplicate pair exists at all is
        the data problem — but it must not be a lockout."""
        _user(db, email="Dr@x.com", name="Capitalised")
        _user(db, email="dr@x.com", name="Lower case")
        assert find_user_by_email(db, "DR@X.COM") is not None


class TestFindByIdentifier:
    def test_a_staff_username_is_matched_case_insensitively(self, db):
        """Staff have no email. An owner writes 'Reception1' on a sticky note
        and the receptionist types 'reception1'."""
        _user(db, username="Reception1", role="receptionist")
        assert find_user_by_identifier(db, "reception1") is not None

    def test_an_email_still_matches_through_the_identifier_path(self, db):
        _user(db, email="dr.sharma@gmail.com")
        assert find_user_by_identifier(db, "DR.SHARMA@GMAIL.COM") is not None

    def test_a_username_row_is_not_matched_by_an_unrelated_string(self, db):
        _user(db, username="reception1", role="receptionist")
        assert find_user_by_identifier(db, "reception2") is None

    def test_the_exactly_typed_username_wins(self, db):
        _user(db, username="Reception1", name="Capitalised", role="receptionist")
        _user(db, username="reception1", name="Lower case", role="receptionist")
        assert find_user_by_identifier(db, "reception1").name == "Lower case"
