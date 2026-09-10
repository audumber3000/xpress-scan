"""The support panels: four per-account reads the CRM renders and forgets.

docs/INTEGRATION_API.md § Support panels has the reasoning. In short: every
endpoint in `reads.py` is *copied* into the CRM, because a copy is what makes
filtering, sorting, charts and cross-product totals possible. Nothing here is
copied. The CRM opens a tab, asks the product, renders the answer, and stores
none of it.

That is what lets these carry data the sync feeds may not. Operator names,
contact details and device fingerprints are the entire point of the operators
panel, and replicating them into a Twenty workspace that support staff across
five product lines can read would create a data-protection problem the sync has
no reason to create. A panel that renders and forgets does not create it.

So the rule each of these keeps is about what it leaves out:

    operators   no ip_address, no coordinates — `location` is a place name
    messaging   no recipient; every one of them is a patient
    profile     the account's own setup, which is not personal data at all
    events      account-level event codes only, by allowlist

The allowlist in `events` is the one to be careful with. MolarPlus's
`activity_logs` records `patient_added` and `prescription_saved` alongside
`login`, and those rows name the patient in `description`. A denylist would
leak the first new end-customer event type somebody adds; an allowlist fails
closed, and a missing event is a bug report rather than a breach.
"""
import datetime
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core import plans
from database import get_db
from models import (ActivityLog, AuditLog, Clinic, GooglePlaceLink,
                    NotificationLog, NotificationPreference,
                    NotificationWallet, Subscription, User, UserDevice,
                    user_clinics)

from . import org, shapes, vocab
from .auth import Caller, require_read
from .wire import ContractError, utcnow

router = APIRouter()

DEFAULT_MESSAGING_WINDOW_DAYS = 30
RECENT_MESSAGE_LIMIT = 20
DEFAULT_EVENT_LIMIT = 50
MAX_EVENT_LIMIT = 200
SESSIONS_PER_OPERATOR = 15

# How many raw sign-in rows to consider before attributing them to people.
# `activity_logs` has no user_id — see `_sessions` — so attribution is done in
# Python over a bounded window rather than in SQL over the whole table.
SESSION_SCAN_LIMIT = 400


def _account(db: Session, account_id: str) -> Clinic:
    """The account's own clinic row, or a 404 in the contract's envelope.

    Deliberately not `reads._load_account`: that one carries the group roll-up
    join every list endpoint needs, and no panel needs it.
    """
    clinic_id = org.parse_account_id(account_id)
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise ContractError(404, "account_not_found",
                            "No account with id {}".format(account_id),
                            {"account_id": account_id})
    return clinic


def _currency(clinic: Clinic) -> str:
    return (clinic.currency_code or "INR").upper()


# ── Operators ────────────────────────────────────────────────────────────────

def _members(db: Session, group: List[int]) -> List[Tuple[User, Optional[int]]]:
    """Everyone with a login at this account, and the site they belong to.

    Two paths into the same answer, because MolarPlus has two. `users.clinic_id`
    is the user's current clinic and is what the retired console read; the
    `user_clinics` association is how a person who works at more than one branch
    is actually recorded. Reading only the first loses every multi-branch staff
    member, and a support panel that cannot see the receptionist somebody is
    calling about is worse than no panel.
    """
    direct = db.query(User, User.clinic_id).filter(User.clinic_id.in_(group))
    linked = (
        db.query(User, user_clinics.c.clinic_id)
        .join(user_clinics, user_clinics.c.user_id == User.id)
        .filter(user_clinics.c.clinic_id.in_(group))
    )

    seen: Dict[int, Tuple[User, Optional[int]]] = {}
    for user, clinic_id in list(direct.all()) + list(linked.all()):
        if user.id not in seen:
            seen[user.id] = (user, clinic_id)
    return sorted(seen.values(), key=lambda pair: (pair[0].name or "").lower())


_SIGN_IN_EVENTS = ("login", "user_login", "sign_in")
_SIGN_OUT_EVENTS = ("logout", "user_logout", "sign_out")

# `audit_logs.action` -> the contract's session kinds.
#
# This is the authoritative source and `activity_logs` is the fallback, which
# is the opposite of what the retired console assumed. The console scanned
# `activity_logs` for the word "login" and matched an email inside the free-text
# description; against the real database that finds nothing at all, because
# sign-ins are not written there. They are written here — with a `user_id`, so
# attribution is a foreign key rather than a substring search.
_AUDIT_SESSION_KINDS = {
    "auth.login": "sign_in",
    "auth.logout": "sign_out",
    # The row a support call is usually about. Somebody who cannot get in
    # generates these and nothing else, so a panel that showed only successful
    # sign-ins would be blank exactly when it is needed.
    "auth.login_failed": "sign_in_failed",
}


def _factor_from_text(*parts) -> str:
    """Which kind of device a log line is describing, or `other`.

    Never a guess at the most likely platform: `other` is a truthful answer and
    "mobile" would be a fabricated one.
    """
    text = " ".join(p or "" for p in parts).lower()
    if "android" in text:
        return "mobile"
    if any(token in text for token in ("ios", "iphone", "ipad")):
        return "mobile"
    if any(token in text for token in ("desktop", "windows", "macos", "linux")):
        return "desktop"
    if any(token in text for token in ("web", "browser")):
        return "web"
    return "other"


def _sessions(db: Session, group: List[int],
              users: List[User]) -> Dict[int, List[dict]]:
    """Recent sign-ins, sign-outs and failed attempts, newest first.

    Two sources, in order of trustworthiness:

    1. `audit_logs`, which carries `user_id` and `action`. Exact attribution.
    2. `activity_logs`, which carries neither and has to be matched on
       `actor_name` or an email inside the description. Kept because older rows
       predate the audit table, and dropped the moment a user cannot be
       identified — "somebody signed in" is not something anybody can act on,
       and it reads as a security finding rather than as missing data.

    A failed attempt has no `user_id` (nobody was authenticated), so it is
    attributed by actor name alone. That is the one case where the weaker
    signal is the only one there is, and losing it would hide the exact row the
    caller is ringing about.
    """
    by_user: Dict[int, List[dict]] = {}
    if not users:
        return by_user

    by_id = {u.id: u for u in users}
    by_name = dict((u.name.strip().lower(), u.id) for u in users if u.name)
    by_email = dict((u.email.strip().lower(), u.id) for u in users if u.email)

    def add(user_id, entry):
        bucket = by_user.setdefault(user_id, [])
        if len(bucket) < SESSIONS_PER_OPERATOR:
            bucket.append(entry)

    audits = (
        db.query(AuditLog)
        .filter(AuditLog.clinic_id.in_(group))
        .filter(AuditLog.action.in_(tuple(_AUDIT_SESSION_KINDS)))
        .order_by(AuditLog.created_at.desc())
        .limit(SESSION_SCAN_LIMIT)
        .all()
    )
    for row in audits:
        user_id = row.user_id if row.user_id in by_id else None
        if user_id is None:
            user_id = by_name.get((row.actor_name or "").strip().lower())
        if user_id is None:
            continue
        add(user_id, shapes.operator_session(
            row, _AUDIT_SESSION_KINDS[row.action],
            _factor_from_text(row.user_agent, row.summary),
        ))

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.clinic_id.in_(group))
        .filter(ActivityLog.event_type.in_(_SIGN_IN_EVENTS + _SIGN_OUT_EVENTS))
        .order_by(ActivityLog.created_at.desc())
        .limit(SESSION_SCAN_LIMIT)
        .all()
    )
    for row in logs:
        user_id = by_name.get((row.actor_name or "").strip().lower())
        if user_id is None:
            description = (row.description or "").lower()
            for email, candidate in by_email.items():
                if email in description:
                    user_id = candidate
                    break
        if user_id is None:
            continue
        kind = "sign_in" if (row.event_type or "") in _SIGN_IN_EVENTS else "sign_out"
        add(user_id, shapes.operator_session(
            row, kind, _factor_from_text(row.description, row.actor_name)))

    # Merged from two tables, so the ordering each query guaranteed no longer
    # holds across the pair.
    for bucket in by_user.values():
        bucket.sort(key=lambda entry: entry["at"] or "", reverse=True)
    return by_user


def _seat_limit(db: Session, clinic: Clinic) -> Optional[int]:
    """How many logins this account is entitled to, or None for unlimited.

    Read off the subscription row, not `clinics.subscription_plan`, and that is
    not a detail. Both columns hold "the plan" and they legitimately disagree —
    `core/plans.py` documents it: the subscription says what they bought, the
    clinic column is rewritten by the auto-downgrade. The Subscription record
    the CRM already shows on this same page derives `staff_limit` from the
    subscription row, so reading the other column here would put two different
    seat limits on one screen. That is the exact bug `plans.effective_plan`
    exists to have stopped.

    Falls back to the clinic column only when there is no subscription at all,
    where the two cannot disagree because there is only one of them.
    """
    row = (
        db.query(Subscription)
        .filter(Subscription.clinic_id == clinic.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    plan_name = row.plan_name if row is not None else clinic.subscription_plan
    return plans.limit(plan_name, "staff")


@router.get("/accounts/{account_id}/operators", tags=["panels"],
            operation_id="getAccountOperators")
def get_account_operators(account_id: str, db: Session = Depends(get_db),
                          caller: Caller = Depends(require_read)):
    """The people at this account who use the product."""
    clinic = _account(db, account_id)
    group = org.group_ids(db, clinic.id)
    members = _members(db, group)
    users = [user for user, _ in members]

    devices_by_user: Dict[int, List[UserDevice]] = {}
    totals = dict((factor, 0) for factor in vocab.DEVICE_FORM_FACTORS)
    if users:
        rows = (
            db.query(UserDevice)
            .filter(UserDevice.user_id.in_([u.id for u in users]))
            .order_by(UserDevice.last_seen.desc().nullslast())
            .all()
        )
        for device in rows:
            devices_by_user.setdefault(device.user_id, []).append(device)
            totals[vocab.form_factor(device.device_type, device.device_platform)] += 1

    sessions = _sessions(db, group, users)

    operators = [
        shapes.operator(user, devices_by_user.get(user.id, []),
                        sessions.get(user.id, []), branch_clinic_id)
        for user, branch_clinic_id in members
    ]

    return shapes.account_operators(
        account_id, operators, totals, _seat_limit(db, clinic), utcnow(),
    )


# ── Messaging ────────────────────────────────────────────────────────────────

@router.get("/accounts/{account_id}/messaging", tags=["panels"],
            operation_id="getAccountMessaging")
def get_account_messaging(
    account_id: str,
    window_days: int = Query(DEFAULT_MESSAGING_WINDOW_DAYS, ge=1, le=365),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """Outbound messaging the product sends on this account's behalf."""
    clinic = _account(db, account_id)
    group = org.group_ids(db, clinic.id)
    currency = _currency(clinic)
    now = utcnow()
    since = now - datetime.timedelta(days=window_days)

    # Grouped in SQL rather than counted in Python: a busy clinic sends tens of
    # thousands of these a month, and the panel needs four numbers from them.
    rows = (
        db.query(
            NotificationLog.channel,
            NotificationLog.status,
            func.count(NotificationLog.id).label("count"),
            func.coalesce(func.sum(NotificationLog.cost), 0.0).label("cost"),
        )
        .filter(NotificationLog.clinic_id.in_(group))
        .filter(NotificationLog.created_at >= since)
        .group_by(NotificationLog.channel, NotificationLog.status)
        .all()
    )

    per_channel: Dict[str, Dict[str, float]] = {}
    for channel, status, count, cost in rows:
        key = vocab.message_channel(channel)
        bucket = per_channel.setdefault(key, {"sent": 0, "failed": 0, "cost": 0.0})
        bucket["sent"] += int(count)
        if vocab.message_status(status) == "failed":
            bucket["failed"] += int(count)
        bucket["cost"] += float(cost or 0.0)

    by_channel = [
        shapes.messaging_channel_stats(channel, values["sent"], values["failed"],
                                       values["cost"], currency)
        for channel, values in sorted(per_channel.items(),
                                      key=lambda item: -item[1]["sent"])
    ]
    totals = (
        sum(v["sent"] for v in per_channel.values()),
        sum(v["failed"] for v in per_channel.values()),
        sum(v["cost"] for v in per_channel.values()),
    )

    # The wallet hangs off the account's own clinic row, not the group: a
    # branch does not top up separately, and summing branch wallets would
    # double-count a balance the customer only has once.
    wallet = (
        db.query(NotificationWallet)
        .filter(NotificationWallet.clinic_id == clinic.id)
        .first()
    )

    preferences = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.clinic_id == clinic.id)
        .order_by(NotificationPreference.event_type)
        .all()
    )

    recent = (
        db.query(NotificationLog)
        .filter(NotificationLog.clinic_id.in_(group))
        .order_by(NotificationLog.created_at.desc())
        .limit(RECENT_MESSAGE_LIMIT)
        .all()
    )

    return shapes.account_messaging(
        account_id, window_days, totals, by_channel, wallet,
        [shapes.messaging_preference(p) for p in preferences],
        [shapes.message_record(r, currency) for r in recent],
        currency, now,
    )


# ── Profile ──────────────────────────────────────────────────────────────────

# What "finished setting up" means for a MolarPlus account, and the name each
# field carries in the contract. The product chooses this list — a product with
# no licence requirement simply never reports one missing — but every entry has
# to be something the customer can actually fix from inside the app, or the
# panel turns into a list of complaints nobody can act on.
_PROFILE_CHECKS = (
    ("logo", lambda c: bool(c.logo_url)),
    ("tagline", lambda c: bool(c.tagline)),
    ("categories", lambda c: bool(c.specialization)),
    ("address", lambda c: bool(c.address or c.address_line1)),
    ("phone", lambda c: bool(c.phone)),
    ("email", lambda c: bool(c.email)),
    ("tax_id", lambda c: bool(c.tax_id or c.gst_number)),
    ("licence_number", lambda c: bool(c.license_number)),
)


@router.get("/accounts/{account_id}/profile", tags=["panels"],
            operation_id="getAccountProfile")
def get_account_profile(account_id: str, db: Session = Depends(get_db),
                        caller: Caller = Depends(require_read)):
    """How completely this account has set itself up, and how it is seen."""
    clinic = _account(db, account_id)
    group = org.group_ids(db, clinic.id)

    missing = [name for name, filled in _PROFILE_CHECKS if not filled(clinic)]
    completeness = {
        "score": round((len(_PROFILE_CHECKS) - len(missing)) / len(_PROFILE_CHECKS), 4),
        "missing": missing,
    }

    seats = (
        db.query(func.coalesce(func.sum(Clinic.number_of_chairs), 0))
        .filter(Clinic.id.in_(group))
        .scalar()
    )
    operator_count = (
        db.query(func.count(func.distinct(User.id)))
        .outerjoin(user_clinics, user_clinics.c.user_id == User.id)
        .filter(or_(User.clinic_id.in_(group), user_clinics.c.clinic_id.in_(group)))
        .scalar()
    )
    capacity = {
        "sites": len(group),
        "seats": int(seats or 0),
        "operator_count": int(operator_count or 0),
    }

    place = (
        db.query(GooglePlaceLink)
        .filter(GooglePlaceLink.clinic_id.in_(group))
        .order_by(GooglePlaceLink.total_review_count.desc().nullslast())
        .first()
    )

    return shapes.account_profile(account_id, clinic, completeness, capacity,
                                  place, utcnow())


# ── Events ───────────────────────────────────────────────────────────────────

# The allowlist. Every `audit_logs.action` prefix that describes something
# happening to the *account* rather than to one of its patients, and the
# category it reports as.
#
# Read this as a security control, not a display preference. `audit_logs` also
# carries `patient.deleted` and `invoice.finalised`, whose `summary` names the
# patient — and the contract's hard rule is that no end-customer record leaves
# the product. A denylist would let the next event type somebody adds through
# by default; this fails closed instead, and a missing event is a bug report
# rather than a disclosure.
_EVENT_ALLOWLIST = {
    "auth": "access",
    "user": "staffing",
    "staff": "staffing",
    "device": "access",
    "clinic": "configuration",
    "branch": "configuration",
    "settings": "configuration",
    "subscription": "billing",
    "plan": "billing",
    "payment": "billing",
    "wallet": "billing",
    "integration": "configuration",
    "support": "support",
}


def _categorise(action: str) -> Optional[str]:
    """The category for an audit action, or None to drop the row entirely."""
    prefix = (action or "").split(".", 1)[0].strip().lower()
    return _EVENT_ALLOWLIST.get(prefix)


@router.get("/accounts/{account_id}/events", tags=["panels"],
            operation_id="getAccountEvents")
def get_account_events(
    account_id: str,
    limit: int = Query(DEFAULT_EVENT_LIMIT, ge=1, le=MAX_EVENT_LIMIT),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """What has happened to this account inside the product."""
    clinic = _account(db, account_id)
    group = org.group_ids(db, clinic.id)
    now = utcnow()

    # Over-fetch, because the allowlist rejects rows after the query: a page of
    # patient events would otherwise come back as an empty panel.
    scan = min(limit * 4, MAX_EVENT_LIMIT * 4)

    events = []

    audits = (
        db.query(AuditLog)
        .filter(AuditLog.clinic_id.in_(group))
        .order_by(AuditLog.created_at.desc())
        .limit(scan)
        .all()
    )
    for row in audits:
        category = _categorise(row.action)
        if category is None:
            continue
        events.append((
            row.created_at,
            shapes.account_event(
                "audit:{}".format(row.id), row.created_at, row.action, category,
                row.summary or row.action,
                row.actor_name,
                vocab.operator_role(row.actor_role) if row.actor_role else None,
                row.clinic_id,
            ),
        ))

    # Sign-ins live in `activity_logs`, which `audit_logs` does not duplicate.
    # Filtered by event type rather than by the allowlist above: this table's
    # `description` is free text written for the clinic's own feed, and the
    # only rows on it that are safe to forward are the ones that name a member
    # of staff instead of a patient.
    logins = (
        db.query(ActivityLog)
        .filter(ActivityLog.clinic_id.in_(group))
        .filter(ActivityLog.event_type.in_(_SIGN_IN_EVENTS + _SIGN_OUT_EVENTS))
        .order_by(ActivityLog.created_at.desc())
        .limit(scan)
        .all()
    )
    for row in logins:
        kind = "sign_in" if (row.event_type or "") in _SIGN_IN_EVENTS else "sign_out"
        events.append((
            row.created_at,
            shapes.account_event(
                "activity:{}".format(row.id), row.created_at,
                "auth.{}".format(kind), "access",
                row.description or kind.replace("_", " ").capitalize(),
                row.actor_name, None, row.clinic_id,
            ),
        ))

    events.sort(key=lambda pair: pair[0] or datetime.datetime.min, reverse=True)
    has_more = len(events) > limit
    return shapes.account_events(account_id, [e for _, e in events[:limit]],
                                 has_more, now)
