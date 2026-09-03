"""The Google review ask has to be able to find the clinic's listing.

It could not. The invoice path resolved the review link through a
`ClinicGooglePlace` model that is defined nowhere in models.py, inside a bare
`except Exception: pass`, so the import raised on every single call and the link
came back empty. Every clinic looked unlinked, every ask logged itself as
skipped, and in five months of production 37 connected clinics produced four
sent asks.

The link now comes from google_place_links, which is the table Integrations →
Google actually writes, and both the automatic ask and the manual one on the
patient file read it through the same service.
"""
import datetime as dt

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from domains.notification.services import google_review_service as grs
from models import Base, Clinic, GooglePlaceLink, NotificationLog


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    session.add(Clinic(name="Review Clinic", email="r@c.com",
                       specialization="dental", phone="02212345678"))
    session.commit()
    return session


def _clinic_id(db):
    return db.query(Clinic).first().id


# ── The link ─────────────────────────────────────────────────────────────────

def test_link_comes_from_the_linked_listing(db):
    cid = _clinic_id(db)
    db.add(GooglePlaceLink(clinic_id=cid, place_id="ChIJabc123", place_name="Review Clinic"))
    db.commit()

    assert grs.review_link(db, cid) == (
        "https://search.google.com/local/writereview?placeid=ChIJabc123"
    )


def test_link_falls_back_to_the_place_id_on_the_clinic(db):
    """Onboarding writes it here when the listing is picked during signup."""
    cid = _clinic_id(db)
    db.query(Clinic).filter(Clinic.id == cid).update({"google_place_id": "ChIJonboarding"})
    db.commit()

    assert "ChIJonboarding" in grs.review_link(db, cid)


def test_no_listing_means_no_link(db):
    assert grs.review_link(db, _clinic_id(db)) == ""


# ── The memory ───────────────────────────────────────────────────────────────

def _log(db, cid, recipient, status, days_ago):
    when = dt.datetime.utcnow() - dt.timedelta(days=days_ago)
    db.add(NotificationLog(
        clinic_id=cid, channel="whatsapp", recipient=recipient,
        event_type="google_review", template_name="google_review",
        status=status, created_at=when, updated_at=when,
    ))
    db.commit()


def test_a_skipped_ask_does_not_count_as_having_asked(db):
    """Otherwise connecting a listing puts every patient inside a cooldown for
    asks that never went out."""
    cid = _clinic_id(db)
    _log(db, cid, "9876543210", "skipped", days_ago=2)

    assert grs.last_asked_at(db, cid, "9876543210") is None
    assert grs.within_cooldown(grs.last_asked_at(db, cid, "9876543210")) is False


def test_a_recent_send_is_inside_the_cooldown(db):
    cid = _clinic_id(db)
    _log(db, cid, "9876543210", "sent", days_ago=10)

    assert grs.within_cooldown(grs.last_asked_at(db, cid, "9876543210")) is True


def test_an_old_send_is_outside_it(db):
    cid = _clinic_id(db)
    _log(db, cid, "9876543210", "sent", days_ago=grs.COOLDOWN_DAYS + 1)

    assert grs.last_asked_at(db, cid, "9876543210") is not None
    assert grs.within_cooldown(grs.last_asked_at(db, cid, "9876543210")) is False


def test_the_cooldown_is_per_recipient(db):
    cid = _clinic_id(db)
    _log(db, cid, "9876543210", "sent", days_ago=1)

    assert grs.within_cooldown(grs.last_asked_at(db, cid, "9999999999")) is False
