"""An account that has been cut off, and what the clinic is told about it.

Suspension is not a plan running out. A trial that ends is a sales moment with
an invitation attached (`core/plan_state.py` writes those words, and leaves the
clinic reading its own records); this is ClinoHealth saying **no**, and it ends
the session. So it blocks everything, not only writes, and the app shows one
card and nothing else.

## What it was before this module

`POST /integration/v1/accounts/{id}/suspend` set `clinics.status = 'suspended'`
on every clinic in the group, and **nothing read it**. Two scheduled jobs and
the notification sender skipped suspended clinics; login did not, the API did
not, and the app did not. An operator suspending an account from the CRM cut
off exactly nobody, and had no way of finding that out.

## The words are the product's, not the CRM's

Each reason below carries the sentence the clinic reads, so the same suspension
reads the same way whoever pressed the button and whatever they typed in a free
text box. The CRM picks a `code` from `GET /integration/v1/suspension-reasons`
and shows the operator the copy before they confirm.

Being suspended for running duplicate accounts and being suspended while we
check something are not the same message, and neither is worth writing twice.

## Every card says how to reach a person

A clinic that cannot open the app cannot open a support ticket in it either,
so WhatsApp, email and a phone number are part of the payload rather than a
link the card invents. Some suspensions will be wrong, and the cost of the ones
that are is measured in how fast somebody can say so.
"""
import datetime as dt
from typing import Optional

from core import support_contact

# The states of `clinics.status` this module acts on. `cancelled` is a clinic
# that closed down, not one we cut off, and it is deliberately not here.
SUSPENDED = "suspended"

POLICY_VIOLATION = "policy_violation"
DUPLICATE_ACCOUNTS = "duplicate_accounts"
COPYING_PLATFORM = "copying_platform"
PAYMENT_DISPUTE = "payment_dispute"
SUSPICIOUS_ACTIVITY = "suspicious_activity"
UNDER_REVIEW = "under_review"

DEFAULT_REASON = POLICY_VIOLATION

# What the clinic reads. `examples` are the specific things that lead here —
# the difference between "you broke the rules" (which invites an argument about
# which rule) and "this is what we saw" (which invites a reply).
REASONS = {
    POLICY_VIOLATION: {
        "label": "Platform policy violation",
        "title": "Your account has been suspended",
        "message": (
            "MolarPlus has suspended this clinic's account because the way it was being "
            "used breaks our platform policies. Your clinical records are safe and "
            "nothing has been deleted."
        ),
        "examples": [
            "Running more than one account for the same clinic, to extend free trials",
            "Sharing one login across clinics that are not part of the same practice",
            "Copying, reselling or rebuilding MolarPlus, or exporting it for a competing product",
            "Using the platform to send messages the recipients did not ask for",
        ],
    },
    DUPLICATE_ACCOUNTS: {
        "label": "Multiple accounts for one clinic",
        "title": "Your account has been suspended",
        "message": (
            "This clinic is running more than one MolarPlus account. Each practice gets one "
            "account and one trial; several accounts for the same clinic is a policy "
            "violation, and we have suspended this one. Your records are safe and nothing "
            "has been deleted."
        ),
        "examples": [
            "The same clinic, phone number or address signed up more than once",
            "A new account opened when a trial on an earlier one ran out",
            "One practice split across accounts to stay under a plan's branch limit",
        ],
    },
    COPYING_PLATFORM: {
        "label": "Copying the platform",
        "title": "Your account has been suspended",
        "message": (
            "This account was being used to copy MolarPlus rather than to run a clinic. "
            "That is a breach of our terms, and we have suspended it. If we have this "
            "wrong, tell us — we will look again the same day."
        ),
        "examples": [
            "Rebuilding MolarPlus's screens or features in another product",
            "Automated collection of pages, data or designs from the platform",
            "Reselling access, or opening an account on a competitor's behalf",
        ],
    },
    PAYMENT_DISPUTE: {
        "label": "Payment dispute or chargeback",
        "title": "Your account is on hold over a payment",
        "message": (
            "There is an unresolved payment on this account — usually a chargeback or a "
            "reversed transaction — so we have put it on hold while it is sorted out. "
            "Nothing has been deleted, and access comes back as soon as it is settled."
        ),
        "examples": [],
    },
    SUSPICIOUS_ACTIVITY: {
        "label": "Suspicious activity",
        "title": "Your account has been locked",
        "message": (
            "We saw activity on this account that did not look like your clinic, and we "
            "locked it to protect your patients' records. Nothing has been deleted. Talk "
            "to us and we will get you back in once we both know the account is safe."
        ),
        "examples": [
            "Sign-ins from places or devices the clinic does not use",
            "Large exports or deletions of patient records",
            "Many failed sign-in attempts in a short time",
        ],
    },
    UNDER_REVIEW: {
        "label": "Under review",
        "title": "Your account is temporarily on hold",
        "message": (
            "We have paused this account while we check something on our side. This is "
            "usually quick, nothing has been deleted, and we would rather you heard it "
            "from this screen than found the app not working."
        ),
        "examples": [],
    },
}

CODES = tuple(REASONS)


def is_reason(code: Optional[str]) -> bool:
    return (code or "") in REASONS


def catalogue() -> list:
    """The vocabulary, for the CRM's suspend screen.

    The operator picks a reason and sees the exact words the clinic will read,
    for the same reason the plan catalogue is published rather than copied: a
    second list of these sentences in the CRM is a second list to keep true.
    """
    return [dict(code=code, **REASONS[code]) for code in CODES]


def is_suspended(clinic) -> bool:
    return (getattr(clinic, "status", None) or "").lower() == SUSPENDED


def account_suspension(db, clinic):
    """The clinic whose suspension governs this one — itself, or its parent.

    A suspension is applied to every clinic in a group, so this is normally the
    clinic itself. The walk matters for a branch created *after* the account
    was suspended, which would otherwise be a working way into a suspended
    account.
    """
    if clinic is None:
        return None
    if is_suspended(clinic):
        return clinic

    from models import Clinic

    seen = set()
    node = clinic
    while node is not None and getattr(node, "id", None) not in seen:
        seen.add(node.id)
        parent_id = getattr(node, "parent_clinic_id", None)
        if not parent_id or parent_id in seen:
            return None
        node = db.query(Clinic).filter(Clinic.id == parent_id).first()
        if node is not None and is_suspended(node):
            return node
    return None


def reference(clinic) -> str:
    """What support asks for on the phone. Short, and on the card."""
    return "MP-{}".format(getattr(clinic, "id", "") or "")


def payload(clinic, note: Optional[str] = None) -> dict:
    """The whole card, decided here so every client shows the same one.

    `note` is what the operator added for this clinic specifically ("we have
    three accounts on this phone number"). It sits under the standard message
    rather than replacing it, so the policy is stated the same way every time
    and the specifics are still there.
    """
    code = getattr(clinic, "suspension_reason", None)
    if not is_reason(code):
        code = DEFAULT_REASON
    copy = REASONS[code]
    note = note if note is not None else getattr(clinic, "suspension_note", None)
    clinic_name = getattr(clinic, "name", None) or ""
    since = getattr(clinic, "suspended_at", None)

    hello = "Hi MolarPlus support, my clinic's account has been suspended and I would like it reviewed."
    details = [
        "Clinic: {}".format(clinic_name) if clinic_name else None,
        "Reference: {}".format(reference(clinic)),
    ]
    message = "\n".join([hello] + [d for d in details if d])

    return {
        "reason": "account_suspended",
        "code": code,
        "label": copy["label"],
        "title": copy["title"],
        "message": copy["message"],
        "examples": list(copy["examples"]),
        "note": (note or "").strip() or None,
        "clinic_name": clinic_name,
        "reference": reference(clinic),
        "suspended_at": since.isoformat() + "Z" if isinstance(since, dt.datetime) else None,
        "support": support_contact.as_dict(message),
        # What the clinic can do about it, said plainly. Everything that is not
        # "talk to us" would be a lie: there is no self-serve way out.
        "appeal": (
            "If you think this is a mistake, message us with your clinic name and we will "
            "look again — most of these are settled the same day."
        ),
    }


# ── The lock ─────────────────────────────────────────────────────────────────
#
# Every request, not only writes. A suspended clinic reading its dashboard while
# a card tells it the account is suspended is the same product it was told it
# could no longer use, and the "one card and nothing else" is the point.
#
# Paths that stay open, or the card is a trap:
#   auth/logout   they must be able to sign out of a dead session
#   webhooks      a gateway telling us a payment settled is not the clinic
#   health/docs   not clinic data at all
_ALWAYS_ALLOWED = (
    "/api/v1/auth/logout",
    "/webhook",
    "/health",
    "/docs",
    "/openapi.json",
)


def blocked_for_user(db, user) -> Optional[dict]:
    """The card this user should be shown instead of the app, or None.

    Pure enough to test: the middleware and the login routes both ask this, so
    signing in and using the app can never disagree about who is suspended.
    """
    from models import Clinic

    clinic_id = getattr(user, "clinic_id", None)
    if not clinic_id:
        return None
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    suspended = account_suspension(db, clinic)
    if suspended is None:
        return None
    # The account's words, about the clinic they actually signed in to: the
    # reason lives on the account, the reference on the branch in front of them.
    card = payload(suspended)
    card["reference"] = reference(clinic)
    return card


def install_suspension_lock(app) -> None:
    """Answer 403 with the card for every request from a suspended account.

    Fails OPEN, like the plan lock: if the token cannot be read or anything at
    all raises, the request proceeds. A bug here must never be the reason a
    dentist cannot open a patient's record.
    """
    import logging

    from fastapi.responses import JSONResponse

    logger = logging.getLogger(__name__)

    @app.middleware("http")
    async def suspension_lock(request, call_next):
        path = request.url.path
        if any(path.startswith(prefix) for prefix in _ALWAYS_ALLOWED):
            return await call_next(request)

        try:
            import jwt

            from core.auth_utils import get_jwt_secret
            from database import SessionLocal
            from models import User

            auth_header = request.headers.get("Authorization") or ""
            if not auth_header.startswith("Bearer "):
                return await call_next(request)

            token = jwt.decode(auth_header.split(" ")[1], get_jwt_secret(),
                               algorithms=["HS256"])
            user_id = token.get("user_id")
            if not user_id:
                return await call_next(request)

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                card = blocked_for_user(db, user) if user is not None else None
            finally:
                db.close()
        except Exception:
            logger.debug("suspension check could not run; allowing the request",
                         exc_info=True)
            return await call_next(request)

        if card is None:
            return await call_next(request)

        return JSONResponse(status_code=403, content={"detail": card})
