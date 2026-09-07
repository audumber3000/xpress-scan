"""The bulk read endpoints: what the CRM's sync orchestrator pulls.

Reads are bulk and incremental; the product never pushes into Twenty. Every
list endpoint here is cursor-paginated on `(changed_at, id)` and accepts
`updated_since`, and every one of them is a page of aggregates and account
metadata — never an end-customer record.

Shape of a page, on all five:

    {"data": [...], "next_cursor": "...", "has_more": true}
"""
import datetime
import logging
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, inspect, or_
from sqlalchemy.orm import Session, aliased

from database import get_db
from models import Clinic, Subscription, SubscriptionPayment, User

from .leads import GrowthLead

from . import aggregates, org, shapes
from .auth import Caller, require_read
from .wire import (ContractError, DEFAULT_LIMIT, MAX_LIMIT, apply_keyset,
                   envelope, parse_rfc3339, utcnow)

log = logging.getLogger("integration.reads")

router = APIRouter()

PRODUCT_CODE = "molarplus"
CONTRACT_VERSION = "1.0"

OWNER_ROLE = "clinic_owner"


def _limit(limit: int) -> int:
    return max(1, min(limit, MAX_LIMIT))


def _changed(updated_at_col, created_at_col):
    """The sort key: a row's last change, never NULL.

    NULL on either side of the keyset row comparison makes it neither true nor
    false, so the second page of any table with a null timestamp would come
    back empty. Every list endpoint coalesces down to a fixed epoch for that
    reason.
    """
    return func.coalesce(updated_at_col, created_at_col, org.EPOCH)


# ── Capability discovery ─────────────────────────────────────────────────────

@router.get("/meta", tags=["meta"], operation_id="getMeta")
def get_meta(caller: Caller = Depends(require_read)):
    """What this implementation can actually do.

    The orchestrator calls this on startup and skips what is false rather than
    failing on a 404. `product_code` must equal the `code` on the CRM's Product
    record — asserting it on every run is what catches a config entry pointed
    at the wrong host.
    """
    return {
        "product_code": PRODUCT_CODE,
        "contract_version": CONTRACT_VERSION,
        "capabilities": {
            "accounts": True,
            "branches": True,
            "subscriptions": True,
            "payments": True,
            "stats": True,
            "leads": True,
            "tickets": False,          # Phase 4
            "update_contact": True,
            "change_plan": True,
            "suspend": True,
            # MolarPlus hard-deletes. There is no soft-delete column to read, so
            # a departed account cannot appear in an incremental response with
            # `deleted: true` — the CRM must reconcile against a full snapshot
            # to notice one has gone. See integration/shapes.py.
            "deletions": False,
        },
        "reporting_currency": "INR",
    }


# ── Accounts ─────────────────────────────────────────────────────────────────

def _account_query(db: Session):
    """Accounts, with the group roll-ups the contract needs on each one.

    `changed_at` is the newest change across the whole group, not the parent
    clinic's own timestamp, so renaming a branch brings its account back in an
    incremental pull. `branch_count` is the group's size, the account's own row
    included — a single-site clinic genuinely is both an account and its only
    branch.
    """
    member = aliased(Clinic)
    roll = (
        db.query(
            Clinic.id.label("account_clinic_id"),
            func.max(_changed(member.updated_at, member.created_at)).label("changed_at"),
            func.count(func.distinct(member.id)).label("branch_count"),
        )
        .join(member, org.member_join(member))
        .filter(org.is_account_root())
        .group_by(Clinic.id)
        .subquery()
    )
    return (
        db.query(Clinic, roll.c.changed_at, roll.c.branch_count)
        .join(roll, roll.c.account_clinic_id == Clinic.id),
        roll,
    )


def _group_map(db: Session, account_ids: List[int]) -> Dict[int, List[int]]:
    """Account clinic id → every clinic id in its group, itself included."""
    groups = dict((aid, [aid]) for aid in account_ids)
    if not account_ids:
        return groups
    rows = (
        db.query(Clinic.id, Clinic.parent_clinic_id)
        .filter(Clinic.parent_clinic_id.in_(account_ids))
        .all()
    )
    for clinic_id, parent_id in rows:
        if parent_id and parent_id != clinic_id and parent_id in groups:
            groups[parent_id].append(clinic_id)
    return groups


def _trial_flags(db: Session, groups: Dict[int, List[int]]) -> Dict[int, bool]:
    """Which accounts are on a trial.

    `clinics` says nothing about trials — MolarPlus keeps that on the
    subscription — so the account's status cannot be read off its own row. The
    CRM needs `trial` separated from `active` to chart trial→paid conversion at
    all, which is a metric the old console did not have.
    """
    member_ids = [cid for ids in groups.values() for cid in ids]
    if not member_ids:
        return {}
    trial_clinics = set(
        row[0] for row in
        db.query(Subscription.clinic_id)
        .filter(Subscription.clinic_id.in_(member_ids))
        .filter(Subscription.is_trial.is_(True))
        .all()
    )
    return dict(
        (account_id, any(cid in trial_clinics for cid in ids))
        for account_id, ids in groups.items()
    )


def _owners(db: Session, account_ids: List[int]) -> Dict[int, User]:
    """The active owner at each account clinic, lowest id wins.

    A clinic can have several rows with the owner role after an ownership
    handover. Picking deterministically matters more than picking correctly:
    the CRM upserts this as a Person, and an owner that alternates between two
    people on successive syncs produces a Person record that flickers.
    """
    if not account_ids:
        return {}
    found = {}
    rows = (
        db.query(User)
        .filter(User.clinic_id.in_(account_ids))
        .filter(User.role == OWNER_ROLE)
        .filter(User.is_active.is_(True))
        .order_by(User.id.asc())
        .all()
    )
    for user in rows:
        found.setdefault(user.clinic_id, user)
    return found


def _serialise_accounts(db: Session, rows: List[Tuple]) -> List[dict]:
    account_ids = [clinic.id for clinic, _, _ in rows]
    groups = _group_map(db, account_ids)
    trials = _trial_flags(db, groups)
    owners = _owners(db, account_ids)
    return [
        shapes.account(clinic, changed_at, branch_count,
                       is_trial=trials.get(clinic.id, False),
                       owner=owners.get(clinic.id))
        for clinic, changed_at, branch_count in rows
    ]


@router.get("/accounts", tags=["accounts"], operation_id="listAccounts")
def list_accounts(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    query, roll = _account_query(db)
    if since is not None:
        # Inclusive on purpose. An exclusive bound loses every record sharing
        # the timestamp of the last one the caller saw.
        query = query.filter(roll.c.changed_at >= since)
    query = apply_keyset(query, roll.c.changed_at, Clinic.id, cursor)
    rows = query.limit(limit + 1).all()

    return envelope(
        rows, limit,
        lambda visible: _serialise_accounts(db, visible),
        lambda row: (row[1], row[0].id),
    )


def _load_account(db: Session, account_id: str) -> Tuple:
    clinic_id = org.parse_account_id(account_id)
    query, roll = _account_query(db)
    row = query.filter(Clinic.id == clinic_id).first()
    if row is None:
        raise ContractError(404, "account_not_found",
                            "No account with id {}".format(account_id),
                            {"account_id": account_id})
    return row


@router.get("/accounts/{account_id}", tags=["accounts"], operation_id="getAccount")
def get_account(account_id: str, db: Session = Depends(get_db),
                caller: Caller = Depends(require_read)):
    """One account. Actions re-read state through here after a write, so the
    CRM reflects a change immediately instead of waiting for the next sync."""
    return _serialise_accounts(db, [_load_account(db, account_id)])[0]


@router.get("/accounts/{account_id}/stats", tags=["accounts"], operation_id="getAccountStats")
def get_account_stats(account_id: str, db: Session = Depends(get_db),
                      caller: Caller = Depends(require_read)):
    """Account-level aggregates — the roll-up of every branch.

    Counts and sums only. `monthly_gmv` is what the account bills its own
    patients, which is an account-health signal and never a ClinoHealth revenue
    figure; ClinoHealth's revenue is `subscriptions[].mrr`.
    """
    clinic, _, _ = _load_account(db, account_id)
    group = org.group_ids(db, clinic.id)
    now = utcnow()
    metrics = aggregates.for_clinics(db, group, now)
    currency_of = dict(
        db.query(Clinic.id, Clinic.currency_code).filter(Clinic.id.in_(group)).all()
    )
    account_currency = (clinic.currency_code or "INR").upper()
    totals = aggregates.roll_up(
        metrics, group,
        dict((k, (v or "INR").upper()) for k, v in currency_of.items()),
        account_currency, account_id,
    )
    return shapes.account_stats(account_id, totals, account_currency, now)


# ── Branches ─────────────────────────────────────────────────────────────────

@router.get("/branches", tags=["accounts"], operation_id="listBranches")
def list_branches(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """The sites an account runs. In MolarPlus every clinic row is one.

    The per-site numbers live here and the account-level ones are their
    roll-up, deliberately: a group whose total appointments look healthy can
    still have one branch that stopped using the product a month ago, and only
    the branch rows show it.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    changed = _changed(Clinic.updated_at, Clinic.created_at)

    query = db.query(Clinic)
    if account_id:
        query = query.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        query = query.filter(changed >= since)
    query = apply_keyset(query, changed, Clinic.id, cursor)
    rows = query.limit(limit + 1).all()
    visible = rows[:limit]

    # A branch's account is its parent — unless that parent no longer exists,
    # in which case the row is an account in its own right. Resolving it here
    # rather than trusting `parent_clinic_id` blindly is what stops an orphan
    # being attributed to an account that is not there.
    parent_ids = set(
        c.parent_clinic_id for c in visible
        if c.parent_clinic_id and c.parent_clinic_id != c.id
    )
    live_parents = set(
        row[0] for row in db.query(Clinic.id).filter(Clinic.id.in_(parent_ids)).all()
    ) if parent_ids else set()

    metrics = aggregates.for_clinics(db, [c.id for c in visible])

    def serialise(page_rows):
        return [
            shapes.branch(
                clinic,
                clinic.parent_clinic_id if clinic.parent_clinic_id in live_parents else clinic.id,
                metrics[clinic.id],
            )
            for clinic in page_rows
        ]

    return envelope(
        rows, limit, serialise,
        lambda clinic: (_sort_value(clinic.updated_at, clinic.created_at), clinic.id),
    )


def _sort_value(updated_at, created_at):
    return updated_at or created_at or org.EPOCH


# ── Subscriptions ────────────────────────────────────────────────────────────

@router.get("/subscriptions", tags=["billing"], operation_id="listSubscriptions")
def list_subscriptions(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """What accounts pay ClinoHealth.

    Every subscription held by any clinic in a group is reported against the
    group's account, not just the parent's. Under the parent-clinic shim a
    branch can still carry its own subscription row from before it joined the
    group, and dropping those would delete real MRR from the CRM's totals.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    changed = _changed(Subscription.updated_at, Subscription.created_at)

    if cursor is None:
        _warn_unattributable(db)

    query = db.query(Subscription, Clinic).join(Clinic, Subscription.clinic_id == Clinic.id)
    if account_id:
        query = query.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        query = query.filter(changed >= since)
    query = apply_keyset(query, changed, Subscription.id, cursor)
    rows = query.limit(limit + 1).all()
    visible = rows[:limit]

    account_of = _account_clinic_ids(db, [clinic for _, clinic in visible])

    return envelope(
        rows, limit,
        lambda page_rows: [
            shapes.subscription(sub, account_of[clinic.id], clinic)
            for sub, clinic in page_rows
        ],
        lambda row: (_sort_value(row[0].updated_at, row[0].created_at), row[0].id),
    )


def _warn_unattributable(db: Session) -> None:
    """Subscriptions with no clinic cannot be attributed to an account.

    `subscriptions.clinic_id` is nullable, so the join that gives a
    subscription its account also silently drops these. Silently losing MRR is
    worse than reporting it late, so the first page of every sync run counts
    them and says so.
    """
    orphans = db.query(func.count(Subscription.id)).filter(Subscription.clinic_id.is_(None)).scalar()
    if orphans:
        log.warning(
            "%s subscription(s) have no clinic_id and are absent from "
            "/integration/subscriptions; their MRR is missing from the CRM.", orphans,
        )


def _account_clinic_ids(db: Session, clinics: List[Clinic]) -> Dict[int, int]:
    """Clinic id → the clinic id of the account it belongs to."""
    parent_ids = set(
        c.parent_clinic_id for c in clinics
        if c.parent_clinic_id and c.parent_clinic_id != c.id
    )
    live = set(
        row[0] for row in db.query(Clinic.id).filter(Clinic.id.in_(parent_ids)).all()
    ) if parent_ids else set()
    return dict(
        (c.id, c.parent_clinic_id if c.parent_clinic_id in live else c.id)
        for c in clinics
    )


# ── Payments ─────────────────────────────────────────────────────────────────

@router.get("/payments", tags=["billing"], operation_id="listPayments")
def list_payments(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    paid_after: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """Settled money. Nothing in the old console ever read this table.

    `subscription_payments` has no `updated_at`, so the sort key and the
    reported `updated_at` are both `COALESCE(paid_at, created_at)`. A refund
    recorded later does not move it and will not appear in an incremental pull
    — that is what the nightly full snapshot is for.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    after = parse_rfc3339(paid_after, "paid_after")
    changed = func.coalesce(SubscriptionPayment.paid_at, SubscriptionPayment.created_at, org.EPOCH)

    query = (
        db.query(SubscriptionPayment, Clinic)
        .join(Clinic, SubscriptionPayment.clinic_id == Clinic.id)
    )
    if account_id:
        query = query.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        query = query.filter(changed >= since)
    if after is not None:
        query = query.filter(SubscriptionPayment.paid_at >= after)
    query = apply_keyset(query, changed, SubscriptionPayment.id, cursor)
    rows = query.limit(limit + 1).all()
    visible = rows[:limit]

    account_of = _account_clinic_ids(db, [clinic for _, clinic in visible])

    return envelope(
        rows, limit,
        lambda page_rows: [shapes.payment(pay, account_of[clinic.id]) for pay, clinic in page_rows],
        lambda row: (_sort_value(row[0].paid_at, row[0].created_at), row[0].id),
    )


# ── Tickets (Phase 4) ────────────────────────────────────────────────────────

# ── Leads ────────────────────────────────────────────────────────────────────

@router.get("/leads", tags=["sales"], operation_id="listLeads")
def list_leads(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """The sales pipeline: prospects, trials and the deals that closed.

    Unlike every other list here, a lead usually has no account. Most of these
    people have not signed up, so `account_id` is null until a clinic exists —
    which is precisely why the CRM keeps leads as Opportunities rather than
    Companies, and why a won lead and the account it becomes are matched by the
    sync rather than by a foreign key that cannot exist yet.

    `growth_leads` is created lazily by the console (`routes/growth.py` calls
    `create_all` on first use), so a product that has never opened the growth
    screens has no table at all. That is reported as an empty page rather than
    a 500: no leads and no pipeline are the same answer to the orchestrator.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    changed = _changed(GrowthLead.updated_at, GrowthLead.created_at)

    if not inspect(db.bind).has_table(GrowthLead.__tablename__):
        return {"data": [], "next_cursor": None, "has_more": False}

    query = db.query(GrowthLead)
    if since is not None:
        query = query.filter(changed >= since)
    query = apply_keyset(query, changed, GrowthLead.id, cursor)
    rows = query.limit(limit + 1).all()

    clinics = db.query(Clinic).filter(
        Clinic.id.in_([r.clinic_id for r in rows[:limit] if r.clinic_id])
    ).all() if any(r.clinic_id for r in rows[:limit]) else []
    account_of = _account_clinic_ids(db, clinics)

    return envelope(
        rows, limit,
        lambda page_rows: [
            shapes.lead(row, account_of.get(row.clinic_id)) for row in page_rows
        ],
        lambda row: (_sort_value(row.updated_at, row.created_at), row.id),
    )


@router.get("/tickets", tags=["support"], operation_id="listTickets")
def list_tickets(caller: Caller = Depends(require_read)):
    """Not built yet — `GET /meta` declares `"tickets": false`.

    Declared rather than absent so a caller that ignored `/meta` gets a
    contract-shaped answer naming the reason, instead of a bare 404 that reads
    like a wrong base URL.
    """
    raise ContractError(
        501, "not_implemented",
        "Ticket sync is Phase 4. GET /integration/v1/meta declares "
        "capabilities.tickets = false.",
    )
