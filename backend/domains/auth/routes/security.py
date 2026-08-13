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

OTP_TTL_MIN = 5
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SEC = 45

# What a code is good for. A send only invalidates earlier codes with the same
# purpose, so verifying the recovery phone and changing the master password can
# be in flight together without one eating the other's code.
PURPOSE_CONTACT = "contact_verification"
PURPOSE_MASTER_PASSWORD = "master_password"


def _hash_code(code: str, clinic_id: int, target: str) -> str:
    # Salted with clinic + target so a leaked hash can't be reversed via a
    # rainbow table of the 1M six-digit codes. Codes are short-lived + capped too.
    return hashlib.sha256(f"{code}:{clinic_id}:{target}".encode()).hexdigest()


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

    # Rate-limit resends.
    recent = (
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
    if recent and (datetime.utcnow() - recent.created_at).total_seconds() < RESEND_COOLDOWN_SEC:
        raise HTTPException(status_code=429, detail="Please wait a moment before requesting another code.")

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
    # BOTH channels go through Nexus. The backend has no email provider of its
    # own in production — no ZOHO_* variables reach the container — so calling
    # EmailService directly could only ever fail with "ZOHO_FROM_EMAIL
    # environment variable not set", which is exactly what prod was logging.
    # Nexus owns ZeptoMail and MSG91 and both otp_verification templates.
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
    if otp.attempts >= MAX_ATTEMPTS:
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
