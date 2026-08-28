from core.app_secret import get_jwt_secret

"""The clinic's master password.

Six digits that stand between a staff member and the deletes nothing can undo:
a patient and everything attached to them, a paid bill, a payment already
receipted. Those used to be flatly refused, which sounds safe until the day a
clinic genuinely has to remove a duplicate patient who was billed by mistake and
the only answer the software has is "no". So the block becomes a door with a
lock on it: still shut by default, openable by someone who holds the code, and
every opening written to the audit log.

Deliberately NOT a role check. Permissions answer "is this person allowed to
work here"; the master password answers "does the person at the keyboard right
now have the owner's blessing for this particular thing". A receptionist who
knows the code can remove a wrongly-created patient at 9pm without ringing the
owner; the owner's own logged-in laptop, left open on the front desk, still
can't. Roles alone give you neither.

Every clinic starts on 123456 so nothing is locked out on day one, and Control
Center nags until that is changed.

The verified code is exchanged for a short-lived token rather than being resent
with each delete, so the digits cross the wire once and the destructive endpoint
never has to handle lockout accounting of its own.
"""
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# What a clinic gets before anyone has set one. Documented, not secret — the
# point is that the clinic can always get in, and that Control Center keeps
# saying "this is still the default" until they pick their own.
DEFAULT_MASTER_PASSWORD = "123456"

PASSWORD_LENGTH = 6
# PBKDF2 rather than the bare SHA256 used for account passwords elsewhere: the
# whole keyspace here is a million codes, so a fast hash is a lookup table. At
# 200k iterations a full sweep of that space costs real machine time, which is
# the only thing standing between a leaked database dump and every clinic's code.
PBKDF2_ROUNDS = 200_000

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
# Long enough to finish the delete you just confirmed, short enough that a token
# left in a tab is worthless by the time anyone finds it.
TOKEN_TTL_SECONDS = 300
TOKEN_HEADER = "X-Master-Token"
_TOKEN_SCOPE = "master_password"


def _jwt_secret() -> str:
    return get_jwt_secret()


def hash_password(clinic_id: int, password: str) -> str:
    """Salted with the clinic id, so two clinics on the same code do not share a
    hash and one leaked pairing does not unlock the other."""
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), f"molarplus:mp:{clinic_id}".encode(), PBKDF2_ROUNDS
    ).hex()


def _matches(clinic, password: str) -> bool:
    """Constant-time comparison against the clinic's code, or against the
    factory default when it has never been changed."""
    stored = getattr(clinic, "master_password_hash", None)
    if not stored:
        return hmac.compare_digest(password, DEFAULT_MASTER_PASSWORD)
    return hmac.compare_digest(hash_password(clinic.id, password), stored)


def is_default(clinic) -> bool:
    """True while the clinic is still on 123456 — whether because nobody has
    changed it, or because somebody changed it back to the default."""
    return _matches(clinic, DEFAULT_MASTER_PASSWORD)


def validate_new_password(password: str) -> str:
    """Six digits, nothing else. Rejected here rather than in the schema so the
    message says what is wrong instead of quoting a regex."""
    pw = (password or "").strip()
    if not pw.isdigit() or len(pw) != PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"The master password must be exactly {PASSWORD_LENGTH} digits.",
        )
    return pw


def locked_for(clinic) -> Optional[int]:
    """Seconds still to wait, or None when the code is accepting attempts."""
    until = getattr(clinic, "master_password_locked_until", None)
    if not until:
        return None
    remaining = (until - datetime.utcnow()).total_seconds()
    return int(remaining) if remaining > 0 else None


def verify_password(db, clinic, password: str) -> None:
    """Check the code, counting failures. Returns on success, raises otherwise.

    The caller commits: the attempt counter has to survive even when the
    surrounding request ends in an error, or the lockout is trivially reset by
    letting each guess fail.
    """
    wait = locked_for(clinic)
    if wait is not None:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many wrong attempts. Try again in "
                f"{max(1, round(wait / 60))} minute(s), or ask the clinic owner."
            ),
        )

    if not _matches(clinic, (password or "").strip()):
        clinic.master_password_attempts = (clinic.master_password_attempts or 0) + 1
        left = MAX_ATTEMPTS - clinic.master_password_attempts
        if left <= 0:
            clinic.master_password_locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            clinic.master_password_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=429,
                detail=f"Too many wrong attempts. The master password is locked for {LOCKOUT_MINUTES} minutes.",
            )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"That master password is not right. {left} attempt(s) left.",
        )

    # A correct code clears the slate — an honest typo earlier in the day should
    # not carry over towards a lockout.
    clinic.master_password_attempts = 0
    clinic.master_password_locked_until = None
    db.commit()


def set_password(db, clinic, password: str) -> None:
    """Store a new code and reset the throttle."""
    clinic.master_password_hash = hash_password(clinic.id, validate_new_password(password))
    clinic.master_password_updated_at = datetime.utcnow()
    clinic.master_password_attempts = 0
    clinic.master_password_locked_until = None


def issue_token(user) -> tuple[str, int]:
    """A short-lived pass for one destructive action, bound to the user and
    clinic that earned it."""
    payload = {
        "scope": _TOKEN_SCOPE,
        "uid": user.id,
        "cid": user.clinic_id,
        "exp": datetime.utcnow() + timedelta(seconds=TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256"), TOKEN_TTL_SECONDS


def require_master_token(request: Request, current_user) -> None:
    """Gate a destructive endpoint on a token from `/security/master-password/verify`.

    Called inside the handler rather than declared as a dependency: these routes
    already carry their own permission dependency, and this has to run against
    the user that one resolved.
    """
    raw = request.headers.get(TOKEN_HEADER) if request else None
    if not raw:
        raise HTTPException(
            status_code=403,
            detail="This needs the clinic's master password. Confirm it and try again.",
        )
    try:
        payload = jwt.decode(raw, _jwt_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=403,
            detail="That master password confirmation has expired. Please enter it again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Master password confirmation is not valid.")

    # Bound to both, so a token minted in one clinic cannot authorise a delete
    # in another that the same user happens to belong to.
    if (
        payload.get("scope") != _TOKEN_SCOPE
        or payload.get("uid") != current_user.id
        or payload.get("cid") != current_user.clinic_id
    ):
        raise HTTPException(status_code=403, detail="Master password confirmation is not valid.")
