"""Signing a phone in by scanning a QR on the web.

The web shows a QR (the header menu, for yourself; the staff panel, for
somebody you manage). The phone app scans it on its sign-in screen and is in:
no email, no password. That is the whole feature, and most of this file is the
reasons it is safe.

  * The QR carries a one-time code, never a password or a session token. The
    code is 256 random bits; only its SHA-256 is stored.
  * It lives two minutes and works once. The web panel quietly replaces it while
    it stays open, and showing a new one retires the last.
  * Only somebody allowed to manage staff can show one for anybody else, and
    only for a role they could assign themselves. A manager can never mint a
    sign-in for the owner.
  * Redeeming goes through the same checks as a password login: deactivated
    accounts, blocked devices, failed-attempt limits, the audit trail, and a
    session bound to the phone so it can be cut off later.
  * The screen that showed the code learns which phone used it, and can block
    that phone in one tap if it was not who it should have been.
"""
import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.audit import (
    DEVICE_BLOCKED, LOGIN_BLOCKED, LOGIN_SUCCEEDED, PHONE_LOGIN_ISSUED, record_audit,
)
from core.auth_utils import get_current_user, has_permission
from core.dependencies import get_auth_service
from core.dtos import AuthResponseDTO
from core.login_throttle import client_ip, lockout_message, throttle
from core.roles import assignable_by, label_for
from database import get_db
from domains.auth.routes.auth_clean import build_auth_response
from models import PhoneLoginCode, User, UserDevice

router = APIRouter()

CODE_TTL_SECONDS = 120
# The app registers this scheme, so the phone's own camera app can open a
# scanned code straight into MolarPlus as well as the in-app scanner.
QR_PREFIX = "molarplus://login?code="
# One bucket for every redeem attempt from an address. The codes cannot be
# guessed, so this is about noise, not brute force.
THROTTLE_KEY = "phone-qr"


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _qr_data_uri(text: str) -> str:
    """The QR as an SVG data URI. `qrcode` is already a dependency (the WhatsApp
    pairing screen uses it); the SVG factory needs nothing else installed."""
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(text, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf)
    return "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _now() -> datetime:
    return datetime.utcnow()


# ── showing a code (signed in) ────────────────────────────────────────────

class IssueRequest(BaseModel):
    # Omit, or send your own id, for yourself. Anybody else's needs staff rights.
    user_id: Optional[int] = None


@router.post("/code")
def issue_code(
    payload: IssueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = current_user
    for_someone_else = payload.user_id is not None and payload.user_id != current_user.id
    if for_someone_else:
        if not has_permission(current_user, "edit", "users"):
            raise HTTPException(status_code=403, detail="You don't have permission to set up phones for staff.")
        target = db.query(User).filter(
            User.id == payload.user_id,
            User.clinic_id == current_user.clinic_id,
        ).first()
        if not target:
            raise HTTPException(status_code=404, detail="Staff member not found.")
        # The same seniority rule as handing out a role: a manager who could
        # show a code for the owner could sign in as the owner.
        allowed = {r["value"] for r in assignable_by(getattr(current_user, "role", None))}
        if target.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"You can't set up a phone for a {label_for(target.role)} account. They can do it from their own menu.",
            )

    if not target.is_active:
        raise HTTPException(status_code=400, detail="This account is deactivated, so it can't sign in on a phone.")
    if not target.clinic_id:
        raise HTTPException(status_code=400, detail="This account isn't linked to a clinic yet.")

    now = _now()
    # One live code per person per screen. The panel replaces its code every
    # two minutes; without this every replaced code would stay valid until its
    # own expiry, and a screen left open would leave a trail of them behind.
    db.query(PhoneLoginCode).filter(
        PhoneLoginCode.user_id == target.id,
        PhoneLoginCode.issued_by == current_user.id,
        PhoneLoginCode.used_at.is_(None),
        PhoneLoginCode.expires_at > now,
    ).update({PhoneLoginCode.expires_at: now}, synchronize_session=False)

    code = secrets.token_urlsafe(32)
    row = PhoneLoginCode(
        code_hash=_hash(code),
        user_id=target.id,
        clinic_id=target.clinic_id,
        issued_by=current_user.id,
        created_at=now,
        expires_at=now + timedelta(seconds=CODE_TTL_SECONDS),
    )
    db.add(row)
    if for_someone_else:
        record_audit(
            db, current_user, PHONE_LOGIN_ISSUED,
            f"Showed a phone login QR for {target.name or target.email}",
            request=request, entity_type="user", entity_id=target.id,
        )
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "qr": _qr_data_uri(QR_PREFIX + code),
        "expires_in": CODE_TTL_SECONDS,
        "for_name": target.name,
    }


@router.get("/code/{code_id}")
def code_status(
    code_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Whether the code on screen has been used, and by which phone. Only the
    person who showed it can ask."""
    row = db.query(PhoneLoginCode).filter(
        PhoneLoginCode.id == code_id,
        PhoneLoginCode.issued_by == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Code not found.")
    if row.used_at:
        device = db.query(UserDevice).filter(UserDevice.id == row.used_device_id).first() if row.used_device_id else None
        return {
            "status": "used",
            "used_at": row.used_at.isoformat() + "Z",
            "device_name": row.used_device_name,
            "blocked": bool(device is not None and not device.is_active),
        }
    remaining = int((row.expires_at - _now()).total_seconds())
    if remaining <= 0:
        return {"status": "expired"}
    return {"status": "waiting", "expires_in": remaining}


@router.post("/code/{code_id}/block")
def block_phone(
    code_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """"Not them?" Blocks exactly the phone that used this code.

    Blocking is what ends a session here: tokens are bound to their device and
    the device is checked on every request. The phone is signed out at once and
    cannot sign in again until the owner unblocks it under Devices.
    """
    row = db.query(PhoneLoginCode).filter(
        PhoneLoginCode.id == code_id,
        PhoneLoginCode.issued_by == current_user.id,
    ).first()
    if not row or not row.used_at or not row.used_device_id:
        raise HTTPException(status_code=404, detail="No phone has used this code.")
    device = db.query(UserDevice).filter(UserDevice.id == row.used_device_id).first()
    if not device or device.user_id != row.user_id:
        raise HTTPException(status_code=404, detail="That phone is no longer on record.")
    target = db.query(User).filter(User.id == row.user_id).first()

    device.is_active = False
    record_audit(
        db, current_user, DEVICE_BLOCKED,
        f"Blocked {row.used_device_name or 'a phone'}, which signed in as "
        f"{(target.name or target.email) if target else 'a staff member'} with a QR code",
        request=request, entity_type="device", entity_id=device.id,
    )
    db.commit()
    return {"blocked": True}


# ── using a code (the phone, not signed in) ───────────────────────────────

class RedeemRequest(BaseModel):
    # The code, or the whole scanned text: the prefix is stripped here so the
    # app never has to parse it right.
    code: str
    device: Optional[Dict[str, Any]] = None


@router.post("/redeem", response_model=AuthResponseDTO)
def redeem_code(
    payload: RedeemRequest,
    request: Request,
    auth_service=Depends(get_auth_service),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    cooling = throttle.check(THROTTLE_KEY, ip)
    if cooling:
        seconds, reason = cooling
        raise HTTPException(
            status_code=429,
            detail=lockout_message(seconds, reason),
            headers={"Retry-After": str(seconds), "X-Retry-After-Seconds": str(seconds)},
        )

    code = (payload.code or "").strip()
    if code.startswith(QR_PREFIX):
        code = code[len(QR_PREFIX):]

    # Locked for the length of this request, so two phones scanning the same
    # code at the same instant cannot both get in.
    row = db.query(PhoneLoginCode).filter(PhoneLoginCode.code_hash == _hash(code)).with_for_update().first()
    now = _now()
    if not row:
        throttle.record_failure(THROTTLE_KEY, ip)
        raise HTTPException(status_code=400, detail="This QR code isn't valid. Show a new one on the web and scan again.")
    if row.used_at:
        raise HTTPException(status_code=400, detail="This QR code has already been used. Show a new one on the web and scan again.")
    if row.expires_at <= now:
        raise HTTPException(status_code=400, detail="This QR code has expired. Show a new one on the web and scan again.")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Ask your clinic owner to restore your access.",
        )

    # Always a device, so the session is always one that can be cut off.
    device_data = dict(payload.device or {})
    device_data.setdefault("device_type", "mobile")
    device_data.setdefault("device_name", "Mobile App")
    device_info = auth_service.detect_device_info(request, device_data)
    device = auth_service.register_device(user.id, device_info)
    blocked = auth_service.device_block_reason(device, device_info["device_type"])
    if blocked:
        record_audit(
            db, user, LOGIN_BLOCKED,
            f"QR sign-in blocked on {device_info.get('device_type') or 'a device'}: {blocked}",
            request=request, entity_type="user", entity_id=user.id, commit=True,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)

    row.used_at = now
    row.used_device_id = device.id
    row.used_device_name = device.device_name or device_info.get("device_name")
    throttle.record_success(THROTTLE_KEY, ip)

    issuer = db.query(User).filter(User.id == row.issued_by).first()
    shown_by = f", shown by {issuer.name or issuer.email}" if issuer and issuer.id != user.id else ""
    record_audit(
        db, user, LOGIN_SUCCEEDED,
        f"Signed in on {row.used_device_name or 'a phone'} with a QR code{shown_by}",
        request=request, entity_type="user", entity_id=user.id,
    )
    db.commit()

    token = auth_service.create_jwt_token(user.id, device.id)
    return build_auth_response(db, user, token, message="Signed in with QR code")
