"""
Where a clinic stands with its plan, and what that means it can do.

Three ways a plan can run out, and they are not the same event to the person on
the other end:

  * a **trial ended** — they were trying Pro, nobody ever asked them for money,
    and the right tone is an invitation
  * a **renewal failed** — they were paying us and something broke, quite
    possibly our own payment flow, and the right tone is an apology with a
    fast way to reach a human
  * an **introductory period ended** — we put them on Plus at no charge when
    the plans changed, and the right tone is a reminder of something they were
    told in advance

Deliberately never called a "free period": there is no Free plan any more, and
saying "your free period" invites the reader to think there is one they could go
back to. They are on Plus, and Plus is coming up for renewal.

Collapsing those into one "expired" state is how a paying customer whose card
bounced gets told to "start a trial". Each state carries its own words.

Every state that interrupts somebody carries a WhatsApp route to support,
because the two states that block are exactly the moments where being stuck
with no way to reach a person is worst.

## What blocks

Only creating NEW records: a new patient, a new appointment, a new invoice or
payment. Reading, editing and completing existing work is never blocked. A
clinic must always be able to open its own patient records and finish treating
the person in the chair, and holding medical records hostage over a subscription
is not a thing this product will do.

## The grant is not enforced by default

`ENFORCE_GRANT_END` is off. Every existing clinic is migrated onto Plus with the
same `current_end`, so switching it on blocks every one of them at the same
midnight, none of them having ever been invoiced. That is a deliberate business
decision with a support cost attached, not a default.
"""
import datetime as dt
import os
from typing import Optional

from core import plans

OK = "ok"
RENEWAL_DUE = "renewal_due"     # paying, running out shortly
GRANT_DUE = "grant_due"         # introductory period running out shortly
TRIAL_ENDED = "trial_ended"
LAPSED = "lapsed"               # was paying, did not renew
GRANT_ENDED = "grant_ended"

# How long before the end we start saying something in the header.
WARN_DAYS = 3

ENFORCE_GRANT_END = os.getenv("ENFORCE_GRANT_END", "").lower() in ("1", "true", "yes")

# States that stop new records being created.
_BLOCKING = {TRIAL_ENDED, LAPSED}


def _kind(sub) -> str:
    """Which of the three kinds of plan this is: trial, grant, or bought."""
    provider = (getattr(sub, "provider", None) or "").lower()
    if provider == "migration":
        return "grant"
    if provider == "trial" or getattr(sub, "is_trial", False):
        return "trial"
    return "paid"


def evaluate(sub, now: Optional[dt.datetime] = None) -> dict:
    """What state is this subscription in, and what does it entitle them to?

    `sub` may be None, which is a clinic that has never had a subscription row.
    That is not a lapsed anything: they are on the entry plan and nothing is
    wrong, so it reports OK.
    """
    now = now or dt.datetime.utcnow()

    if sub is None:
        return _payload(OK, None, sub)

    end = getattr(sub, "current_end", None)
    if end is None:
        # No end date means nothing to run out. Treated as fine rather than as
        # a problem: a support-granted plan with no expiry is a real state.
        return _payload(OK, None, sub)

    kind = _kind(sub)
    remaining = (end - now).total_seconds() / 86400

    if remaining <= 0:
        state = {"trial": TRIAL_ENDED, "grant": GRANT_ENDED, "paid": LAPSED}[kind]
        return _payload(state, 0, sub)

    if remaining <= WARN_DAYS:
        # A trial counting down is not a warning: it is doing exactly what it
        # said it would, and the Subscription page already shows the countdown.
        if kind == "trial":
            return _payload(OK, int(remaining) + 1, sub)
        state = GRANT_DUE if kind == "grant" else RENEWAL_DUE
        return _payload(state, max(1, int(remaining) + 1), sub)

    return _payload(OK, int(remaining) + 1, sub)


def blocks(state: str) -> bool:
    """Does this state stop new records being created?"""
    if state == GRANT_ENDED:
        return ENFORCE_GRANT_END
    return state in _BLOCKING


def _payload(state: str, days_left: Optional[int], sub) -> dict:
    lapsed_plan = plans.label(getattr(sub, "plan_name", None)) if sub is not None else plans.label(None)
    entry = plans.PLANS[plans.DEFAULT_PLAN]["label"]

    copy = {
        OK: None,
        RENEWAL_DUE: {
            "tone": "warning",
            "title": "Your plan renews in {days}",
            "message": (
                "Keep an eye on it so nothing is interrupted. If the payment does not go "
                "through we will tell you, and you can always message us."
            ),
            "cta": "Manage plan",
        },
        GRANT_DUE: {
            "tone": "warning",
            "title": "Your {plan} plan is due for renewal in {days}",
            "message": (
                "Your introductory period on {plan} ends then. Choose how you would like to "
                "continue, or message us if you need more time."
            ),
            "cta": "Choose a plan",
        },
        TRIAL_ENDED: {
            "tone": "info",
            "title": "Your {lapsed} trial has ended",
            "message": (
                "Nothing has been deleted and all your records are still here. Choose a plan "
                "to add new patients and appointments again."
            ),
            "cta": "Choose a plan",
        },
        LAPSED: {
            "tone": "critical",
            "title": "We could not renew your {lapsed} plan",
            "message": (
                "This is usually a card that expired or a payment that did not clear, and it "
                "is quick to sort out. Nothing has been deleted. If you think this is wrong, "
                "message us and we will fix it before you pay anything."
            ),
            "cta": "Fix payment",
        },
        GRANT_ENDED: {
            "tone": "info",
            "title": "Your {plan} plan is due for renewal",
            "message": (
                "Your introductory period on {plan} has ended. Nothing has been deleted and "
                "all your records are still here. Choose a plan to carry on."
            ),
            "cta": "Choose a plan",
        },
    }[state]

    result = {
        "state": state,
        "days_left": days_left,
        "blocks": blocks(state),
        "lapsed_plan": lapsed_plan,
    }
    if copy:
        days_text = (
            "today" if not days_left
            else f"{days_left} day{'s' if days_left != 1 else ''}"
        )
        result.update({
            "tone": copy["tone"],
            "title": copy["title"].format(days=days_text, plan=entry, lapsed=lapsed_plan),
            "message": copy["message"].format(days=days_text, plan=entry, lapsed=lapsed_plan),
            "cta": copy["cta"],
        })
    return result


def for_clinic(db, clinic) -> dict:
    """Evaluate the subscription behind a clinic, however it is attached."""
    from models import Subscription, User

    sub = (
        db.query(Subscription)
        .filter(Subscription.clinic_id == clinic.id)
        .order_by(Subscription.id.desc())
        .first()
    )
    if sub is None:
        owner = (
            db.query(User)
            .filter(
                User.clinic_id == clinic.id,
                User.role == "clinic_owner",
                User.is_active == True,  # noqa: E712
            )
            .first()
        )
        if owner:
            sub = (
                db.query(Subscription)
                .filter(Subscription.user_id == owner.id)
                .order_by(Subscription.id.desc())
                .first()
            )
    return evaluate(sub)


# ── The guard ────────────────────────────────────────────────────────────────
def require_active_plan(current_user=None, db=None):
    """FastAPI dependency: refuse to create a NEW record on a stopped plan.

    Raises 402 Payment Required with the state's own words attached, so the
    screen can say which of the three things happened rather than a generic
    "upgrade". The frontend turns this into one modal wherever it fires.

    Deliberately fails OPEN. If the subscription cannot be read for any reason,
    the clinic carries on working: a bug in billing code must never be able to
    stop a dentist recording a patient.
    """
    from fastapi import HTTPException
    from models import Clinic

    clinic_id = getattr(current_user, "clinic_id", None)
    if not clinic_id or db is None:
        return None

    try:
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if clinic is None:
            return None
        state = for_clinic(db, clinic)
    except Exception:  # pragma: no cover - see the docstring
        import logging
        logging.getLogger(__name__).exception("plan state check failed; allowing the write")
        return None

    if not state.get("blocks"):
        return state

    raise HTTPException(
        status_code=402,
        detail={
            "reason": "plan_inactive",
            "state": state["state"],
            "title": state.get("title"),
            "message": state.get("message"),
            "cta": state.get("cta"),
            "tone": state.get("tone"),
        },
    )


# ── The read-only lock ───────────────────────────────────────────────────────
#
# When a trial ends or a renewal fails the clinic becomes VIEW ONLY: it can open
# and read everything it has, and change nothing. Enforced as middleware rather
# than a dependency on each route because "every write" is the requirement, and
# a per-route guard is a list somebody forgets to add to. One place, no gaps.
#
# Paths that must keep working while locked, or the lock is a trap:
#   auth          they still have to be able to sign in and out
#   subscriptions the way out is to pay us
#   security      OTP and master password, needed to recover an account
#   support       reaching a human is the other way out
#   webhooks      the gateway telling us they paid must never be refused
_ALWAYS_ALLOWED = (
    "/api/v1/auth",
    "/api/v1/subscriptions",
    "/api/v1/security",
    "/api/v1/support",
    "/api/v1/feature-requests",
    "/api/v1/notifications",     # marking a notification read is not clinic data
    "/webhook",
)

_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}


def install_readonly_lock(app) -> None:
    """Refuse every write while the clinic's plan is stopped.

    Fails OPEN throughout. If the token cannot be read, the clinic cannot be
    found, or anything at all raises, the request proceeds: a bug in billing
    code must never be the reason a dentist cannot record a patient.
    """
    import logging
    from fastapi.responses import JSONResponse

    logger = logging.getLogger(__name__)

    @app.middleware("http")
    async def plan_readonly_lock(request, call_next):
        if request.method not in _MUTATING:
            return await call_next(request)

        path = request.url.path
        if any(path.startswith(prefix) or prefix in path for prefix in _ALWAYS_ALLOWED):
            return await call_next(request)

        try:
            import jwt
            from core.auth_utils import get_jwt_secret
            from database import SessionLocal
            from models import Clinic, User

            auth_header = request.headers.get("Authorization") or ""
            if not auth_header.startswith("Bearer "):
                return await call_next(request)

            payload = jwt.decode(auth_header.split(" ")[1], get_jwt_secret(), algorithms=["HS256"])
            user_id = payload.get("user_id")
            if not user_id:
                return await call_next(request)

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                clinic_id = getattr(user, "clinic_id", None)
                if not clinic_id:
                    return await call_next(request)
                clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
                if clinic is None:
                    return await call_next(request)
                state = for_clinic(db, clinic)
            finally:
                db.close()
        except Exception:
            logger.debug("plan lock could not evaluate; allowing the write", exc_info=True)
            return await call_next(request)

        if not state.get("blocks"):
            return await call_next(request)

        return JSONResponse(
            status_code=402,
            content={
                "detail": {
                    "reason": "plan_inactive",
                    "state": state["state"],
                    "title": state.get("title"),
                    "message": state.get("message"),
                    "cta": state.get("cta"),
                    "tone": state.get("tone"),
                }
            },
        )
