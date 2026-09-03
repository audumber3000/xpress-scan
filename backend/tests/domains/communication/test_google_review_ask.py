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
from sqlalchemy.pool import StaticPool

from domains.notification.services import google_review_service as grs
from models import Base, Clinic, GooglePlaceLink, NotificationLog


@pytest.fixture()
def db():
    # StaticPool and check_same_thread, because TestClient serves the request on
    # another thread and the default sqlite pool would hand it a second, empty
    # in-memory database.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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


def test_a_real_place_id_becomes_googles_own_short_link(db):
    """The pair below is verified against Google: the short code and the place
    id are two encodings of one listing, and g.page resolves it to the review
    form. Both carry the same CID, which is the whole reason this is derivable.
    """
    cid = _clinic_id(db)
    db.add(GooglePlaceLink(clinic_id=cid, place_id="ChIJcd-nDQCx3DsRBltDijTePng"))
    db.commit()

    assert grs.review_link(db, cid) == "https://g.page/r/CQZbQ4o03j54EBM/review"


def test_the_short_code_is_not_the_place_id(db):
    """Guards the mistake this replaced. Substituting the place id straight into
    the g.page path gives a dead link that redirects to a blank google.com, so
    the code must be re-encoded rather than swapped in.
    """
    assert grs.gpage_code("ChIJcd-nDQCx3DsRBltDijTePng") != "ChIJcd-nDQCx3DsRBltDijTePng"


@pytest.mark.parametrize("place_id", ["ChIJabc123", "not-base64!!", "", "ChIJ"])
def test_an_undecodable_place_id_keeps_the_long_url(db, place_id):
    """A truncated, hand-typed or future-format id must not lose the clinic its
    link. gpage_code returns None and the caller falls back to writereview,
    which has always worked.
    """
    assert grs.gpage_code(place_id) is None


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


# ── The link a patient actually taps ─────────────────────────────────────────
#
# WhatsApp opens links in its own embedded browser, which carries none of the
# patient's Google session. The wrapper at /r/{clinic_id} was built to bounce
# them out of it, and still exists so links already sent keep working, but new
# sends carry Google's own URL: a link on the clinic's API host reads as
# tracking and does not get tapped, and an unopened message beats no sign-in
# prompt by nothing at all.

def test_the_patient_gets_the_wrapper_not_the_google_url(db, monkeypatch):
    """Measured in prod, not a preference: sending the g.page URL in the body
    left every message at 'sent' with nothing delivered, while the wrapper on
    our own domain reached 'read'. WhatsApp accepted the redirect domain and
    dropped it. The patient still ends up on g.page, because /r redirects
    there."""
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    cid = _clinic_id(db)
    db.add(GooglePlaceLink(clinic_id=cid, place_id="ChIJcd-nDQCx3DsRBltDijTePng"))
    db.commit()

    assert grs.share_link(db, cid) == f"https://api.example.com/r/{cid}"
    # And the clinic's own preview is still Google's short link.
    assert grs.review_link(db, cid) == "https://g.page/r/CQZbQ4o03j54EBM/review"


def test_no_listing_means_no_link_to_share(db):
    assert grs.share_link(db, _clinic_id(db)) == ""


def test_an_undecodable_place_id_still_shares_a_working_link(db, monkeypatch):
    """A clinic whose id will not decode must still be able to ask. The wrapper
    is the same either way; what changes is where /r sends them."""
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    cid = _clinic_id(db)
    db.add(GooglePlaceLink(clinic_id=cid, place_id="ChIJabc123"))
    db.commit()

    assert grs.share_link(db, cid) == f"https://api.example.com/r/{cid}"
    assert grs.review_link(db, cid) == (
        "https://search.google.com/local/writereview?placeid=ChIJabc123"
    )


def test_the_redirect_page_carries_an_escape_and_a_way_out_by_hand(db):
    """Android is escaped with an intent URL; iOS has no reliable escape left,
    so it must at least be told what to tap."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from database import get_db
    from domains.google_business.routes import review_redirect

    cid = _clinic_id(db)
    db.add(GooglePlaceLink(clinic_id=cid, place_id="ChIJabc123"))
    db.commit()

    app = FastAPI()
    app.include_router(review_redirect.router, prefix="/r")
    app.dependency_overrides[get_db] = lambda: db
    page = TestClient(app).get(f"/r/{cid}").text

    assert "intent://search.google.com" in page and "scheme=https" in page
    assert "S.browser_fallback_url=" in page          # a device with no browser
    assert "Open in Safari" in page                   # the iOS instruction
    assert "<noscript>" in page                       # and one with no JS at all
    assert "Review Review Clinic" in page             # says whose listing it is


def test_the_redirect_page_does_not_break_when_the_listing_goes_away(db):
    """Disconnected between sending the message and the patient tapping it."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from database import get_db
    from domains.google_business.routes import review_redirect

    app = FastAPI()
    app.include_router(review_redirect.router, prefix="/r")
    app.dependency_overrides[get_db] = lambda: db
    res = TestClient(app).get(f"/r/{_clinic_id(db)}", follow_redirects=False)

    assert res.status_code in (302, 307)
