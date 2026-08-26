"""Security — the clinic's recovery contact (phone + email), each verified via
OTP, plus the master password that gates deletes nothing can undo. Both OTP
channels ride the existing Nexus path (MSG91 for WhatsApp, ZeptoMail for email).

Owner-only, with one deliberate exception: `POST /master-password/verify` is
open to any signed-in member of the clinic. That is the whole point of a master
password — a receptionist who has been told the code can push through a delete
their role alone would never allow, and one who has not been told it cannot.
"""
import csv
import hashlib
import os
import io
import logging
import requests
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from database import get_db
from models import AuditLog, Clinic, NotificationLog, OtpVerification, User
from core.auth_utils import get_current_user, require_clinic_owner
from core.phone import normalize_phone
from core.nexus_notify import notify
from core.audit import ACTION_LABELS, record_audit, MASTER_PASSWORD_SET, SECURITY_UPDATED
from core import master_password as mp
from sqlalchemy import func, or_

logger = logging.getLogger(__name__)
router = APIRouter()

OTP_TTL_MIN = 10
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SEC = 45

# ── Signup verification limits ───────────────────────────────────────────────
# This step BLOCKS a brand-new clinic out of the whole product, so it is tuned
# to be forgiving where the settings-screen flow is tight.
#
# SIGNUP_ACTIVE_CODES is the important one. A resend used to burn the previous
# code, which meant that with two messages on a phone exactly one of them worked
# and the older one answered "Incorrect code" — indistinguishable, from the
# customer's side, from the product being broken. WhatsApp template delivery is
# not ordered and not prompt, so the message somebody opens is very often not
# the newest one. Keeping the last few generations alive costs nothing (three
# live codes out of a million is not a brute-force surface) and removes the
# single sharpest edge in the flow: every code you were actually sent works.
SIGNUP_ACTIVE_CODES = 3
# Wrong guesses allowed before every live code is torn up. Higher than
# MAX_ATTEMPTS because a person juggling three real messages will mistype.
SIGNUP_MAX_ATTEMPTS = 10
# Ceiling on sends per clinic per hour. The cooldown paces a human; this stops
# a loop — a client that re-sends on every mount, a stuck retry — from turning
# into a hundred WhatsApp messages and a hundred rupees of MSG91.
SIGNUP_MAX_SENDS_PER_HOUR = 8

# Development escape hatch for signup verification.
#
# Nexus is a separate service and is not part of the local compose stack, so on
# a developer machine BOTH OTP channels fail and signup cannot be completed at
# all. With this set, a signup code that could not be delivered is written to
# the backend log instead and the request succeeds.
#
# The code is NEVER returned in the HTTP response, only logged, so switching
# this on by accident cannot leak a code to a browser. It also only ever
# applies when real delivery has already failed, so it can never mask a working
# Nexus. Must not be set in production.
OTP_DEV_ECHO = os.getenv("OTP_DEV_ECHO", "").lower() in ("1", "true", "yes")

# What a code is good for. A send only invalidates earlier codes with the same
# purpose, so verifying the recovery phone and changing the master password can
# be in flight together without one eating the other's code.
PURPOSE_CONTACT = "contact_verification"
PURPOSE_MASTER_PASSWORD = "master_password"
# Verifying both contacts at the end of signup, with ONE code sent to both.
# Filed separately so a signup code and a master-password code can be in flight
# together without one invalidating the other.
PURPOSE_SIGNUP = "signup_verification"


def _hash_code(code: str, clinic_id: int, target: str) -> str:
    # Salted with clinic + target so a leaked hash can't be reversed via a
    # rainbow table of the 1M six-digit codes. Codes are short-lived + capped too.
    return hashlib.sha256(f"{code}:{clinic_id}:{target}".encode()).hexdigest()


def _too_many(detail: str, retry_after: int) -> HTTPException:
    """A 429 that says WHEN, not just no.

    `retry_after` rides in the body as well as the header because the clients
    render a live countdown from it. A rate limit a screen cannot count down
    from just looks like a failure, and the customer's answer to a failure is
    to press the button again.
    """
    seconds = max(1, int(retry_after))
    return HTTPException(
        status_code=429,
        detail=detail,
        headers={"Retry-After": str(seconds), "X-Retry-After-Seconds": str(seconds)},
    )


# ── Schemas ──────────────────────────────────────────────────────────────────
class SecurityOut(BaseModel):
    security_phone: Optional[str] = None
    security_email: Optional[str] = None
    security_phone_verified: bool = False
    security_email_verified: bool = False


class SecurityUpdate(BaseModel):
    security_phone: Optional[str] = None
    security_email: Optional[str] = None


class OtpSendRequest(BaseModel):
    channel: str = Field(..., pattern="^(whatsapp|email)$")


class OtpVerifyRequest(BaseModel):
    channel: str = Field(..., pattern="^(whatsapp|email)$")
    code: str = Field(..., min_length=4, max_length=8)


def _clinic(db, current_user: User) -> Clinic:
    c = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return c


def _serialize(c: Clinic) -> SecurityOut:
    return SecurityOut(
        security_phone=c.security_phone,
        security_email=c.security_email,
        security_phone_verified=bool(c.security_phone_verified),
        security_email_verified=bool(c.security_email_verified),
    )


def _target_for(c: Clinic, channel: str) -> Optional[str]:
    return c.security_phone if channel == "whatsapp" else c.security_email


# ── Routes ───────────────────────────────────────────────────────────────────
@router.get("", response_model=SecurityOut)
def get_security(db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    return _serialize(_clinic(db, current_user))


@router.put("", response_model=SecurityOut)
def update_security(payload: SecurityUpdate, request: Request, db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    """Set the recovery phone/email. Changing a value clears its verified flag,
    so it must be re-verified."""
    c = _clinic(db, current_user)
    data = payload.model_dump(exclude_unset=True)
    changed = []
    if "security_phone" in data:
        new = (data["security_phone"] or "").strip() or None
        if new != c.security_phone:
            c.security_phone = new
            c.security_phone_verified = False
            changed.append("recovery phone")
    if "security_email" in data:
        new = (data["security_email"] or "").strip() or None
        if new != c.security_email:
            c.security_email = new
            c.security_email_verified = False
            changed.append("recovery email")
    # The recovery contact is how an account is taken back. Changing it is one
    # of the few actions that can hand a clinic to someone else, so it belongs
    # in the log even though nothing clinical moved. The new value is not
    # recorded, only that it changed: the log is read by staff and should not
    # itself leak the recovery address.
    if changed:
        record_audit(
            db, current_user, SECURITY_UPDATED,
            "Changed " + " and ".join(changed),
            request=request, entity_type='clinic', entity_id=c.id,
        )
    db.commit()
    db.refresh(c)
    return _serialize(c)


def _deliver_otp(db, c: Clinic, channel: str, target: str, code: str) -> Optional[str]:
    """Send one code down one channel. Returns an error string, or None on success.

    Reports instead of raising because the signup flow sends the SAME code to
    both the phone and the email, and one dead channel must not take the other
    down with it. `_issue_otp` turns a returned error back into its 502, so the
    single-channel callers behave exactly as before.

    BOTH channels go through Nexus. The backend has no email provider of its own
    in production — no ZOHO_* variables reach the container — so calling
    EmailService directly could only ever fail with "ZOHO_FROM_EMAIL environment
    variable not set", which is exactly what prod was logging. Nexus owns
    ZeptoMail and MSG91 and both otp_verification templates.
    """
    if channel == "email":
        recipient, log_channel = target, "email"
        destination = {"to_email": recipient}
    else:
        recipient = normalize_phone(target, getattr(c, "country", None))
        log_channel = "whatsapp"
        destination = {"to_phone": recipient}

    # The row is created up front so MSG91's delivery webhook has something to
    # update. Submission succeeding only means the provider accepted it — an
    # unapproved or wrong-language Meta template is still accepted, then fails
    # on delivery, which is exactly the case that looked like "nothing happened".
    log = NotificationLog(
        clinic_id=c.id, channel=log_channel, recipient=recipient,
        event_type="otp_verification", status="queued",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    error = None
    try:
        resp = requests.post(
            f"{os.getenv('NEXUS_SERVICES_URL', 'http://localhost:8001')}"
            f"/api/v1/notifications/send-event",
            json={
                "event_type": "otp_verification",
                "channel": log_channel,
                **destination,
                "to_name": c.name or "",
                "template_data": {
                    "otp": code,
                    "clinic_name": c.name or "",
                    "expires_in_minutes": OTP_TTL_MIN,
                },
                "log_id": log.id,
                "callback_url": (
                    f"{os.getenv('MAIN_BACKEND_URL', 'http://localhost:8000')}"
                    f"/api/v1/notification-admin/logs/{log.id}"
                ),
            },
            timeout=15,
        )
        if resp.status_code >= 400:
            error = f"{resp.status_code}: {resp.text[:200]}"
        else:
            body = resp.json() if resp.content else {}
            if isinstance(body, dict) and body.get("success") is False:
                error = str(body.get("error") or body.get("message") or "provider rejected the message")
    except Exception as exc:
        error = str(exc)

    # Recorded either way, so a failed OTP shows up in Notifications → Message
    # Logs next to everything else instead of vanishing.
    try:
        log.status = "failed" if error else "sent"
        log.error_message = error
        db.commit()
    except Exception:
        db.rollback()

    return error


def _issue_otp(db, c: Clinic, channel: str, purpose: str) -> dict:
    """Mint a code, send it, and report whether it actually left the building.

    Shared by recovery-contact verification and by a master password change —
    same code, same template, same delivery accounting; only the purpose the
    code is filed under differs.
    """
    target = _target_for(c, channel)
    if not target:
        field = "phone" if channel == "whatsapp" else "email"
        raise HTTPException(status_code=400, detail=f"Add a security {field} first.")

    # Rate-limit resends. Deliberately looks at the latest row whether or not it
    # was consumed: a send burns the previous code, so filtering on
    # `consumed == False` meant the act of sending cleared its own cooldown and
    # the limit only ever caught the very first repeat.
    recent = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.clinic_id == c.id,
            OtpVerification.channel == channel,
            OtpVerification.target == target,
            OtpVerification.purpose == purpose,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )
    if recent:
        waited = (datetime.utcnow() - recent.created_at).total_seconds()
        if waited < RESEND_COOLDOWN_SEC:
            raise _too_many(
                "Please wait a moment before requesting another code.",
                RESEND_COOLDOWN_SEC - waited,
            )

    # Invalidate any earlier unconsumed codes for this target — one active at a time.
    db.query(OtpVerification).filter(
        OtpVerification.clinic_id == c.id,
        OtpVerification.channel == channel,
        OtpVerification.target == target,
        OtpVerification.purpose == purpose,
        OtpVerification.consumed == False,
    ).update({"consumed": True})

    code = f"{secrets.randbelow(10 ** 6):06d}"
    db.add(OtpVerification(
        clinic_id=c.id, channel=channel, target=target, purpose=purpose,
        code_hash=_hash_code(code, c.id, target),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MIN),
    ))
    db.commit()

    # Delivery is checked, not fired and forgotten. `notify()` is documented to
    # never raise and `_fire` ignores Nexus's response entirely, so the old code
    # reported "code sent" whether or not anything left the building — and an
    # unapproved WhatsApp template failed invisibly. An OTP nobody receives, with
    # a UI that says it was sent, is the worst of both.
    error = _deliver_otp(db, c, channel, target, code)
    if error:
        logger.warning(f"OTP send failed ({channel}) for clinic {c.id}: {error}")
        raise HTTPException(
            status_code=502,
            detail="Couldn't send the code. Check Notifications → Message Logs for the reason.",
        )

    return {"sent": True, "expires_in": OTP_TTL_MIN * 60}


def _consume_otp(db, c: Clinic, channel: str, purpose: str, code: str) -> None:
    """Burn the active code for this purpose, or raise saying why not."""
    target = _target_for(c, channel)
    if not target:
        raise HTTPException(status_code=400, detail="Nothing to verify — set the contact first.")

    otp = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.clinic_id == c.id,
            OtpVerification.channel == channel,
            OtpVerification.target == target,
            OtpVerification.purpose == purpose,
            OtpVerification.consumed == False,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="No active code. Send a new one.")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="That code expired. Send a new one.")
    if (otp.attempts or 0) >= MAX_ATTEMPTS:
        otp.consumed = True
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Send a new code.")

    if _hash_code((code or "").strip(), c.id, target) != otp.code_hash:
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect code. Try again.")

    otp.consumed = True
    db.commit()


@router.post("/otp/send")
def send_otp(payload: OtpSendRequest, db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    return _issue_otp(db, _clinic(db, current_user), payload.channel, PURPOSE_CONTACT)


@router.post("/otp/verify")
def verify_otp(payload: OtpVerifyRequest, db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    c = _clinic(db, current_user)
    _consume_otp(db, c, payload.channel, PURPOSE_CONTACT, payload.code)
    if payload.channel == "whatsapp":
        c.security_phone_verified = True
    else:
        c.security_email_verified = True
    db.commit()
    return {"verified": True}


# ── Signup verification ──────────────────────────────────────────────────────
# The last step of onboarding: prove the clinic owns the phone and the email it
# just typed in. ONE six-digit code goes to both, and they type it once.
#
# Two rows are written, one per channel, because the code hash is salted with
# its target. Verifying either row verifies both contacts: the point is that the
# person holding the phone is the person reading the email, and making them do
# the dance twice proves nothing extra.

class SignupOtpSend(BaseModel):
    phone: str = Field(..., min_length=4, max_length=20)
    email: str = Field(..., min_length=5, max_length=160)


class SignupOtpVerify(BaseModel):
    code: str = Field(..., min_length=4, max_length=8)


def _live_signup_rows(db, clinic_id: int):
    """Every signup code still usable, newest first.

    Note the absence of an expiry filter: an expired row is still needed by the
    caller so it can say "that code expired" instead of "no active code". They
    are different sentences to the person reading them — one means wait for the
    next message, the other means press resend.
    """
    return (
        db.query(OtpVerification)
        .filter(
            OtpVerification.clinic_id == clinic_id,
            OtpVerification.purpose == PURPOSE_SIGNUP,
            OtpVerification.consumed == False,
        )
        .order_by(OtpVerification.created_at.desc())
        .all()
    )


def _signup_send_limits(db, clinic_id: int, contacts_changed: bool) -> None:
    """Pace the sends, or raise the 429 that says how long to wait.

    Two limits, doing two different jobs. The cooldown paces a person pressing
    resend. The hourly ceiling is the one that matters operationally: it bounds
    what a client stuck in a loop can cost, and until it existed this endpoint
    had no limit at all while every other OTP path had one.

    A contact edit skips the cooldown on purpose. Somebody who just fixed a typo
    in their own phone number should not be told to wait 45 seconds to find out
    whether the fix worked; they still count against the hourly ceiling, so the
    loop protection holds either way.
    """
    now = datetime.utcnow()

    window_start = now - timedelta(hours=1)
    sends_this_hour = (
        db.query(func.count(OtpVerification.id))
        .filter(
            OtpVerification.clinic_id == clinic_id,
            OtpVerification.purpose == PURPOSE_SIGNUP,
            OtpVerification.channel == "whatsapp",  # one row per send, not per channel
            OtpVerification.created_at >= window_start,
        )
        .scalar()
    ) or 0

    if sends_this_hour >= SIGNUP_MAX_SENDS_PER_HOUR:
        oldest_in_window = (
            db.query(OtpVerification.created_at)
            .filter(
                OtpVerification.clinic_id == clinic_id,
                OtpVerification.purpose == PURPOSE_SIGNUP,
                OtpVerification.channel == "whatsapp",
                OtpVerification.created_at >= window_start,
            )
            .order_by(OtpVerification.created_at.asc())
            .first()
        )
        frees_up = (oldest_in_window[0] + timedelta(hours=1) - now).total_seconds() if oldest_in_window else 3600
        raise _too_many(
            "That is a lot of codes for one clinic. Any of the codes we already "
            "sent you still works. If none of them arrived, message support and "
            "we will verify you ourselves.",
            frees_up,
        )

    if contacts_changed:
        return

    latest = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.clinic_id == clinic_id,
            OtpVerification.purpose == PURPOSE_SIGNUP,
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )
    if latest:
        waited = (now - latest.created_at).total_seconds()
        if waited < RESEND_COOLDOWN_SEC:
            raise _too_many(
                "We just sent you a code. Give it a few seconds to arrive.",
                RESEND_COOLDOWN_SEC - waited,
            )


@router.post("/signup-otp/send")
def send_signup_otp(
    payload: SignupOtpSend,
    db=Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """Save the contacts, then send one code to both.

    Returns per-channel delivery status rather than a 502, because this screen
    blocks the end of signup. If WhatsApp is rejected by Meta but the email goes
    out, the customer can still finish; refusing the whole request because one
    provider is unhappy would wall a brand-new clinic out of the product on
    their first day.

    Resending does NOT invalidate the code before it. See SIGNUP_ACTIVE_CODES:
    the last few codes all stay live until they expire, so whichever message the
    customer happens to open is one that works.
    """
    c = _clinic(db, current_user)

    # Already done. Not an error: a client whose verify succeeded but whose
    # follow-up refresh failed will land back here, and sending it a fresh code
    # to type would be asking it to redo work that is finished.
    if c.security_phone_verified or c.security_email_verified:
        return {
            "sent": False,
            "already_verified": True,
            "delivery": {},
            "reached": [],
            "phone": c.security_phone,
            "email": c.security_email,
        }

    phone = (payload.phone or "").strip()
    email = (payload.email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="That email address does not look right.")

    contacts_changed = phone != c.security_phone or email != c.security_email

    _signup_send_limits(db, c.id, contacts_changed)

    # Changing a contact clears its verified flag, same as the settings screen.
    if phone != c.security_phone:
        c.security_phone = phone
        c.security_phone_verified = False
    if email != c.security_email:
        c.security_email = email
        c.security_email_verified = False
    db.commit()

    # Snapshot what was already live, so the retirement pass below knows what
    # counts as "previous" once the new pair is in.
    previous = _live_signup_rows(db, c.id)

    code = f"{secrets.randbelow(10 ** 6):06d}"
    targets = {"whatsapp": phone, "email": email}
    for channel, target in targets.items():
        db.add(OtpVerification(
            clinic_id=c.id, channel=channel, target=target, purpose=PURPOSE_SIGNUP,
            code_hash=_hash_code(code, c.id, target),
            expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MIN),
        ))
    db.commit()

    # Retire what is no longer wanted, AFTER the new code exists so a crash in
    # between can never leave the clinic with nothing to type.
    if contacts_changed:
        # Correcting a typo voids every outstanding code, both channels of it.
        # Retiring only the row for the contact that changed would leave the old
        # generation half-alive, which is a state nobody can reason about: the
        # code sitting on a number they have just disowned would still be
        # accepted through its email twin. A replacement was minted just above,
        # so nothing is lost by tearing up the old one.
        retired = previous
    else:
        # A plain resend keeps the last few generations usable. This is the
        # whole point of SIGNUP_ACTIVE_CODES: whichever message they open works.
        retired = previous[(SIGNUP_ACTIVE_CODES - 1) * len(targets):]

    if retired:
        for row in retired:
            row.consumed = True
        db.commit()

    delivery = {}
    for channel, target in targets.items():
        error = _deliver_otp(db, c, channel, target, code)
        delivery[channel] = {"sent": error is None, "error": error}
        if error:
            logger.warning(f"signup OTP {channel} failed for clinic {c.id}: {error}")

    reached = [ch for ch, r in delivery.items() if r["sent"]]

    if not reached and OTP_DEV_ECHO:
        # Nothing left the building, but this machine has no Nexus. Put the code
        # where a developer can read it and let signup continue.
        logger.warning(
            "OTP_DEV_ECHO is on and delivery failed. Signup code for clinic %s is %s",
            c.id, code,
        )
        return {
            "sent": True,
            "delivery": delivery,
            "reached": ["log"],
            "dev_echo": True,
            "expires_in": OTP_TTL_MIN * 60,
            "resend_in": RESEND_COOLDOWN_SEC,
            "phone": phone,
            "email": email,
        }

    if not reached:
        # Both dead. The codes stay valid in case delivery catches up, but the
        # screen needs to know it should offer a way to reach a human.
        raise HTTPException(
            status_code=502,
            detail="We could not send the code to your phone or your email. Please check both, or contact support.",
        )

    return {
        "sent": True,
        "delivery": delivery,
        "reached": reached,
        "expires_in": OTP_TTL_MIN * 60,
        # The cooldown is the server's to state, not the client's to assume. A
        # screen that gets torn down and rebuilt loses its own countdown, and a
        # countdown that restarts at zero is how this endpoint got hammered.
        "resend_in": RESEND_COOLDOWN_SEC,
        "phone": phone,
        "email": email,
    }


@router.post("/signup-otp/verify")
def verify_signup_otp(
    payload: SignupOtpVerify,
    db=Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """Any of the live codes, either channel's row, both contacts verified."""
    c = _clinic(db, current_user)
    code = (payload.code or "").strip()

    # Already through. Returning success rather than "no active code" is what
    # makes this endpoint safe to retry: a verify that committed and then lost
    # its response — a dropped connection, a backgrounded app — must not leave
    # the customer staring at an error on a step that is actually finished.
    if c.security_phone_verified or c.security_email_verified:
        return {
            "verified": True,
            "already_verified": True,
            "security_phone_verified": bool(c.security_phone_verified),
            "security_email_verified": bool(c.security_email_verified),
        }

    now = datetime.utcnow()
    rows = _live_signup_rows(db, c.id)

    if not rows:
        raise HTTPException(status_code=400, detail="No active code. Send a new one.")

    usable = [r for r in rows if r.expires_at >= now and (r.attempts or 0) < SIGNUP_MAX_ATTEMPTS]
    if not usable:
        if all(r.expires_at < now for r in rows):
            raise HTTPException(status_code=400, detail="That code expired. Send a new one.")
        # Attempt budget spent. Burn what is left so the next send starts clean,
        # and say how long until they can ask for one.
        for r in rows:
            r.consumed = True
        db.commit()
        newest = max(r.created_at for r in rows)
        raise _too_many(
            "Too many incorrect tries. Send a new code and use the newest message.",
            RESEND_COOLDOWN_SEC - (now - newest).total_seconds(),
        )

    matched = next(
        (r for r in usable if _hash_code(code, c.id, r.target) == r.code_hash),
        None,
    )
    if not matched:
        # Counted against every usable row, so the cap cannot be sidestepped by
        # guessing against one channel and then the other, nor by keeping three
        # generations alive.
        for r in usable:
            r.attempts = (r.attempts or 0) + 1
        db.commit()
        # The freshest row is the one with room left, so it sets what remains.
        left = max(0, SIGNUP_MAX_ATTEMPTS - min((r.attempts or 0) for r in usable))
        if left == 0:
            detail = "Incorrect code. That was the last try, so send a new code."
        elif left <= 2:
            detail = f"Incorrect code. {left} more {'try' if left == 1 else 'tries'} before you need a new code."
        else:
            detail = "Incorrect code. Try again."
        raise HTTPException(status_code=400, detail=detail)

    # Every live code is spent by one success, including the older generations
    # this customer never used.
    for r in rows:
        r.consumed = True
    c.security_phone_verified = True
    c.security_email_verified = True
    db.commit()

    return {
        "verified": True,
        "security_phone_verified": True,
        "security_email_verified": True,
    }


# ── Master password ──────────────────────────────────────────────────────────
# The six digits asked for before a delete that cannot be undone. Reading and
# changing it is the owner's business; confirming it is everyone's.

class MasterPasswordOut(BaseModel):
    is_default: bool
    updated_at: Optional[str] = None
    # So the change flow can say "we'll text 98765…" instead of failing at the
    # last step because no recovery phone was ever set.
    phone: Optional[str] = None


class MasterPasswordSet(BaseModel):
    code: str = Field(..., min_length=4, max_length=8, description="WhatsApp OTP")
    # Length and digits-only are checked by validate_new_password, not here, so
    # a wrong length is answered in plain words rather than Pydantic's
    # "String should have at least 6 characters".
    new_password: str = Field(..., min_length=1, max_length=12)


class MasterPasswordVerify(BaseModel):
    password: str = Field(..., min_length=1, max_length=12)


@router.get("/master-password", response_model=MasterPasswordOut)
def get_master_password(db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    c = _clinic(db, current_user)
    return MasterPasswordOut(
        is_default=mp.is_default(c),
        updated_at=c.master_password_updated_at.isoformat() if c.master_password_updated_at else None,
        phone=c.security_phone,
    )


@router.post("/master-password/otp")
def send_master_password_otp(db=Depends(get_db), current_user: User = Depends(require_clinic_owner)):
    """Text a code to the recovery phone before letting the master password move.

    WhatsApp only, and only to the number already on file. Knowing the current
    master password is not enough to change it — otherwise anyone who had been
    told the code once could quietly lock the owner out of their own clinic.
    """
    c = _clinic(db, current_user)
    if not c.security_phone:
        raise HTTPException(
            status_code=400,
            detail="Add a recovery phone above first. That is where the code goes.",
        )
    return _issue_otp(db, c, "whatsapp", PURPOSE_MASTER_PASSWORD)


@router.put("/master-password")
def set_master_password(
    payload: MasterPasswordSet, request: Request,
    db=Depends(get_db), current_user: User = Depends(require_clinic_owner),
):
    c = _clinic(db, current_user)
    new_password = mp.validate_new_password(payload.new_password)
    _consume_otp(db, c, "whatsapp", PURPOSE_MASTER_PASSWORD, payload.code)

    # The code reached the phone and came back, which is the same proof the
    # Verify button asks for. Marking it verified here saves the owner doing
    # the identical dance twice.
    c.security_phone_verified = True
    mp.set_password(db, c, new_password)
    record_audit(
        db, current_user, MASTER_PASSWORD_SET,
        "Changed the clinic's master password",
        request=request, entity_type='clinic', entity_id=c.id,
    )

    # The master password gates deleting patients, paid bills and payments, so a
    # change to it belongs in front of the owner rather than only in the audit
    # log. No actor exclusion: an owner who did NOT do this is exactly who needs
    # to see it, and an owner who did gets a harmless confirmation.
    from domains.notification.services.notification_center_service import (
        notify, OWNER, SEVERITY_CRITICAL,
    )
    notify(
        db,
        clinic_id=c.id,
        event_type="master_password_changed",
        severity=SEVERITY_CRITICAL,
        audience=OWNER,
        title="Master password changed",
        body=f"Changed by {current_user.name or current_user.email}. "
             "If this was not you, change it again straight away.",
        link="/admin/security",
        entity_type="clinic",
        entity_id=c.id,
    )

    db.commit()
    return {"updated": True, "is_default": mp.is_default(c)}


@router.post("/master-password/verify")
def verify_master_password(
    payload: MasterPasswordVerify,
    db=Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Exchange the master password for a short-lived pass for one delete.

    Open to every role on purpose — see the module docstring. Wrong guesses are
    counted against the clinic and lock the code for a while.
    """
    c = _clinic(db, current_user)
    mp.verify_password(db, c, payload.password)
    token, ttl = mp.issue_token(current_user)
    return {"token": token, "expires_in": ttl}


# ── Audit log ────────────────────────────────────────────────────────────────
# Who changed what, from where. Read-only by design: there is no endpoint that
# edits or deletes a row, because a trail somebody can tidy up isn't one.

def _audit_query(db, clinic_id, action=None, user_id=None, search=None,
                 date_from=None, date_to=None):
    """The filters, in one place, so the list, the count and the CSV export can
    never disagree about which rows they're describing."""
    from core.clinic_time import clinic_day_bounds_utc

    q = db.query(AuditLog).filter(AuditLog.clinic_id == clinic_id)
    if action:
        # A bare prefix like "patient" matches every patient.* action.
        q = q.filter(AuditLog.action.like(f"{action}%") if '.' not in action
                     else AuditLog.action == action)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if search and len(search.strip()) >= 2:
        like = f"%{search.strip()}%"
        q = q.filter(or_(AuditLog.summary.ilike(like), AuditLog.actor_name.ilike(like)))

    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if date_from:
        start, _ = clinic_day_bounds_utc(clinic, date_from)
        q = q.filter(AuditLog.created_at >= start)
    if date_to:
        _, end = clinic_day_bounds_utc(clinic, date_to)
        q = q.filter(AuditLog.created_at < end)
    return q


def _available_actions(db, clinic_id):
    """The action filters worth offering this clinic."""
    present = [
        a for (a,) in db.query(AuditLog.action)
        .filter(AuditLog.clinic_id == clinic_id)
        .distinct().all() if a
    ]
    # Ordered by the catalogue so the dropdown reads consistently, with
    # anything unrecognised appended rather than dropped: an action we forgot
    # to label still has to be filterable.
    known = [a for a in ACTION_LABELS if a in present]
    extra = sorted(a for a in present if a not in ACTION_LABELS)
    return ([{"value": a, "label": ACTION_LABELS[a]} for a in known]
            + [{"value": a, "label": a.replace('.', ' ').replace('_', ' ').capitalize()} for a in extra])


def _serialise(row):
    return {
        "id": row.id,
        "action": row.action,
        "action_label": ACTION_LABELS.get(row.action, row.action.replace('.', ' ').title()),
        "summary": row.summary,
        "actor_name": row.actor_name or "Unknown",
        "actor_role": row.actor_role,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/audit-log")
def list_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD, clinic tz"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD, clinic tz"),
    db=Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """Consequential actions taken in this clinic, newest first."""
    q = _audit_query(db, current_user.clinic_id, action, user_id, search, date_from, date_to)
    total = q.with_entities(func.count(AuditLog.id)).scalar() or 0
    rows = (
        q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * per_page).limit(per_page).all()
    )
    return {
        "total": int(total),
        "page": page,
        "per_page": per_page,
        "logs": [_serialise(r) for r in rows],
        # Derived from what this clinic has actually recorded, not from the
        # full catalogue of constants. The static list offered filters for
        # eight actions that were declared and never written, so an owner
        # filtering by "Device blocked" saw an empty table and concluded
        # nothing had happened, when in truth nothing was ever recorded. A
        # filter that cannot return a row is worse than an absent one.
        #
        # Self-maintaining: a newly wired action appears here the first time
        # it fires, with no list to remember to update.
        "actions": _available_actions(db, current_user.clinic_id),
    }


@router.get("/audit-log/export")
def export_audit_log(
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db=Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """The same filtered rows as a CSV, for handing to an accountant or keeping
    outside the app. Timestamps are rendered in the clinic's own timezone —
    a UTC column would have to be mentally converted on every line."""
    from core.clinic_time import clinic_tzinfo
    from zoneinfo import ZoneInfo

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    tz = clinic_tzinfo(clinic)

    rows = (
        _audit_query(db, current_user.clinic_id, action, user_id, search, date_from, date_to)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(20000).all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date & time", "Staff member", "Role", "Action", "Details", "IP address", "Device"])
    for r in rows:
        local = (
            r.created_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz).strftime("%Y-%m-%d %H:%M:%S")
            if r.created_at else ""
        )
        writer.writerow([
            local,
            r.actor_name or "Unknown",
            (r.actor_role or "").replace('_', ' ').title(),
            ACTION_LABELS.get(r.action, r.action),
            r.summary or "",
            r.ip_address or "",
            r.user_agent or "",
        ])

    span = f"{date_from or 'all'}_to_{date_to or 'now'}"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit-log_{span}.csv"'},
    )
