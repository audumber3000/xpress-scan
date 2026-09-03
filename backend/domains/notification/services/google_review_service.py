"""Where the Google review ask gets its link, and its memory of who it asked.

Two callers need to agree on this: the automatic ask that fires when a payment
lands, and the manual one behind the WhatsApp menu on the patient file. They
have to resolve the same link and honour the same cooldown, or a clinic gets
asked-twice patients and no way to explain why.
"""
import datetime as dt
import os
from typing import Optional

from sqlalchemy.orm import Session

# How long before the same patient may be asked for a Google review again.
# Ninety days rather than never, because a patient treated twice a year can
# reasonably be asked twice; and rather than per-invoice, because a course of
# treatment billed in three parts is still one experience to review.
COOLDOWN_DAYS = 90


def review_link(db: Session, clinic_id: int) -> str:
    """The 'write a review' URL for this clinic, or "" if no listing is linked.

    Reads google_place_links, which is the table Integrations → Google actually
    writes when a clinic connects its listing. The invoice path used to query a
    `ClinicGooglePlace` model that is defined nowhere in models.py, wrapped in a
    bare `except Exception: pass` — so the import raised on every call, the link
    came back empty, and every clinic looked unlinked. 37 clinics are connected
    and the ask has gone out 4 times in five months.
    """
    from models import Clinic, GooglePlaceLink

    link = (
        db.query(GooglePlaceLink)
        .filter(GooglePlaceLink.clinic_id == clinic_id)
        .first()
    )
    place_id = link.place_id if link else None
    if not place_id:
        # Onboarding writes the place id straight onto the clinic when the
        # listing is picked there rather than in Integrations.
        place_id = (
            db.query(Clinic.google_place_id).filter(Clinic.id == clinic_id).scalar()
        )
    if not place_id:
        return ""
    return f"https://search.google.com/local/writereview?placeid={place_id}"


def share_link(db: Session, clinic_id: int) -> str:
    """The link to put in a message to a patient, or "" if nothing is connected.

    Not the Google URL itself. WhatsApp opens links in its own embedded browser,
    which carries none of the patient's Google session, so the raw URL lands
    them on a sign-in wall rather than the star picker and the review does not
    happen. This points at /r/{clinic_id}, which gets them into the real browser
    they are already signed in to. See domains/google_business/routes/
    review_redirect.py for what that page can and cannot do per platform.

    Use review_link() instead for anything the clinic itself opens: they are in
    a real browser already and the bounce would only be a wasted hop.

    The public address, for the same reason the unsubscribe link uses it: this
    is read off a phone, so an in-cluster hostname resolves for nobody.
    """
    if not review_link(db, clinic_id):
        return ""
    base = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
    return f"{base}/r/{clinic_id}"


def last_asked_at(db: Session, clinic_id: int, recipient: str) -> Optional[dt.datetime]:
    """When this recipient was last asked, or None if never.

    Keyed on the recipient rather than the patient because that is what the log
    stores, and it is also the thing that actually receives the message.

    Skipped rows do not count. They are logged for the same reason everything
    else is, but counting them meant a clinic with no listing accumulated a
    phantom "asked" against every patient, so the day it connected one, everyone
    was already inside a cooldown for asks that never went out.
    """
    from models import NotificationLog

    if not recipient:
        return None
    row = (
        db.query(NotificationLog.created_at)
        .filter(
            NotificationLog.clinic_id == clinic_id,
            NotificationLog.event_type == "google_review",
            NotificationLog.recipient == recipient,
            NotificationLog.status != "skipped",
        )
        .order_by(NotificationLog.created_at.desc())
        .first()
    )
    return row[0] if row else None


def within_cooldown(asked_at: Optional[dt.datetime]) -> bool:
    """Is that ask recent enough that we should not send another unprompted?"""
    if not asked_at:
        return False
    return asked_at >= dt.datetime.utcnow() - dt.timedelta(days=COOLDOWN_DAYS)


def log_skip(db: Session, clinic_id: int, recipient: str, reason: str) -> None:
    """Record an ask that was not made, and why.

    A clinic that never connected its listing otherwise sees nothing happen and
    nothing recorded, which is indistinguishable from the feature being broken.
    """
    from models import NotificationLog

    try:
        now = dt.datetime.utcnow()
        db.add(NotificationLog(
            clinic_id=clinic_id,
            channel="-",
            recipient=recipient or "",
            event_type="google_review",
            template_name="google_review",
            status="skipped",
            error_message=reason,
            cost=0.0,
            provider="none",
            created_at=now,
            updated_at=now,
        ))
        db.commit()
    except Exception:
        db.rollback()
