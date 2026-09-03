"""Where the Google review ask gets its link, and its memory of who it asked.

Two callers need to agree on this: the automatic ask that fires when a payment
lands, and the manual one behind the WhatsApp menu on the patient file. They
have to resolve the same link and honour the same cooldown, or a clinic gets
asked-twice patients and no way to explain why.
"""
import base64
import datetime as dt
import os
from typing import Optional

from sqlalchemy.orm import Session

# How long before the same patient may be asked for a Google review again.
# Ninety days rather than never, because a patient treated twice a year can
# reasonably be asked twice; and rather than per-invoice, because a course of
# treatment billed in three parts is still one experience to review.
COOLDOWN_DAYS = 90


def gpage_code(place_id: str) -> Optional[str]:
    """The g.page short code for a Places API place id, or None if it will not
    decode.

    A place id is base64url over a small protobuf holding the listing's two
    64-bit feature ids:

        0a <len> 09 <fid-high:8> 11 <cid:8>

    The g.page short link carries only the second of those, the CID, wrapped in
    its own two-field message:

        09 <cid:8> 10 13

    So the short code is not the place id and cannot be substituted for it —
    g.page/r/<place id>/review resolves to a blank google.com — but it is
    derivable from it, because both encode the same CID. Verified byte-exact
    against a known pair, and the five oldest linked clinics in prod all
    resolve to a real review form.

    Returns None rather than raising on anything that does not match the shape:
    a truncated id, a hand-typed one, or a future format change. Every caller
    falls back to the long writereview URL, which has always worked.
    """
    if not place_id:
        return None
    try:
        raw = base64.urlsafe_b64decode(place_id + "=" * (-len(place_id) % 4))
    except Exception:
        return None
    if len(raw) < 20 or raw[0] != 0x0A or raw[2] != 0x09 or raw[11] != 0x11:
        return None
    body = bytes([0x09]) + raw[12:20] + bytes([0x10, 0x13])
    return base64.urlsafe_b64encode(body).decode().rstrip("=")


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
    # Google's own short form when we can build it: it is what a clinic sees in
    # its Business Profile, it is short enough to read in a WhatsApp message,
    # and it carries Google's review-solicitation attribution. It resolves to
    # the same writereview form, so nothing downstream changes behaviour.
    code = gpage_code(place_id)
    if code:
        return f"https://g.page/r/{code}/review"
    return f"https://search.google.com/local/writereview?placeid={place_id}"


def share_link(db: Session, clinic_id: int) -> str:
    """The link to put in a message to a patient, or "" if nothing is connected.

    Google's own URL, sent as-is. The template puts this in the message body as
    {{3}}, so the patient reads it rather than tapping a button: a link on the
    clinic's API host looks like tracking and does not get tapped, and a review
    nobody opens is worth less than one behind a sign-in prompt.

    This used to point at /r/{clinic_id}, a page that bounces the patient out of
    WhatsApp's embedded browser into the real one, because that browser may not
    carry their Google session. That page still exists and every link already
    sent still works, so nothing in a patient's chat history breaks. New sends
    go straight to Google.

    Reverted to the wrapper on 2026-09-03 after prod stopped delivering. Sending
    the g.page URL in the body was tried and measured: every send after the
    19:03 deploy sat at 'sent' and none reached 'delivered' or 'read', while the
    hour before it went to 'read' on the same template and the same number.
    MSG91 accepted each one and issued a message id, and no FAILED callback ever
    arrived, so WhatsApp took the message and dropped it rather than rejecting
    it. A redirect domain in a template body is the only thing that changed.

    The patient still lands on Google's own short link, because /r redirects to
    review_link() — which is the g.page URL. Only the string in the message body
    went back to a domain WhatsApp will carry.
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
