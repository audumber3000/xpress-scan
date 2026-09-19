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
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, inspect, not_, or_, select
from sqlalchemy.orm import Session, aliased

from database import get_db
from models import Clinic, Subscription, SubscriptionPayment, User

from .leads import GrowthLead

from core import plans, suspension

from . import aggregates, org, plans_view, query, shapes, vocab
from .auth import Caller, require_read
from .wire import (ContractError, DEFAULT_LIMIT, MAX_LIMIT, apply_keyset,
                   envelope, micros, money, parse_rfc3339, utcnow)

log = logging.getLogger("integration.reads")

router = APIRouter()

PRODUCT_CODE = "molarplus"
CONTRACT_VERSION = "1.0"

OWNER_ROLE = org.OWNER_ROLE


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
            "promotions": True,
            "campaigns": True,
            "write_promotions": True,
            "promotion_redemptions": True,
            # Totals and monthly series for the CRM's dashboards. See
            # integration/insights.py.
            "insights": True,
            "tickets": False,          # Phase 4
            # The support panels. Declared separately from the feeds
            # above because they fail differently: a product that
            # cannot serve /branches cannot be synced at all, while one
            # that cannot serve /operators is merely missing a tab, and
            # the CRM hides it rather than showing an error to somebody
            # with no way to fix it.
            "operators": True,
            "messaging": True,
            "profile": True,
            "events": True,
            # Per-site add-ons a support agent can grant or progress. Declared
            # because MolarPlus has answered PATCH /accounts/{id}/addons/{key}
            # since it shipped — it was simply never in the contract, so the CRM
            # had no way to know the action existed and nothing ever called it.
            "addons": True,
            "update_contact": True,
            "change_plan": True,
            "plans": True,
            "suspend": True,
            # The reasons a suspension can carry, and the words the clinic is
            # shown for each. Published for the same reason the plan catalogue
            # is: a second copy of these sentences in the CRM is a second copy
            # to keep true. See core/suspension.py.
            "suspension_reasons": True,
            "start_trial": True,
            # MolarPlus hard-deletes. There is no soft-delete column to read, so
            # a departed account cannot appear in an incremental response with
            # `deleted: true` — the CRM must reconcile against a full snapshot
            # to notice one has gone. See integration/shapes.py.
            "deletions": False,
        },
        "reporting_currency": "INR",
    }


# ── Suspension reasons ───────────────────────────────────────────────────────

@router.get("/suspension-reasons", tags=["actions"], operation_id="listSuspensionReasons")
def list_suspension_reasons(caller: Caller = Depends(require_read)):
    """Why an account may be suspended, and what the clinic is told for each.

    The CRM shows the operator these words before they confirm, so nobody cuts
    a clinic off without seeing the message that clinic will read. `code` is
    what `POST /accounts/{id}/suspend` accepts back.
    """
    return {"data": suspension.catalogue()}


# ── Plans ────────────────────────────────────────────────────────────────────

@router.get("/plans", tags=["billing"], operation_id="listPlans")
def list_plans(caller: Caller = Depends(require_read)):
    """The catalogue, so the CRM never carries a copy of the price list.

    It used to. The change-plan dialog in Twenty held a hardcoded array of
    MolarPlus's five plan codes and their limits — a third copy after
    `core/plans.py` and the mirror the retired console kept — and every one of
    them had to be edited by hand when a tier moved. The copy nobody remembered
    was the one the CRM offered.

    Derived entirely from `core.plans`, which is what actually gets charged at
    checkout, so this cannot drift from the product's own pricing by
    construction. No database is touched: the catalogue is code.

    Only what is on sale. `LEGACY_ALIASES` maps retired names onto a current
    tier for accounts still sitting on one, and those keep being reported
    through `GET /subscriptions` — but they cannot be sold, so offering them
    here would let the CRM move somebody onto a plan the product has retired.

    Cheapest first, monthly before annual, because that is the order somebody
    reads a list of options in.
    """
    catalogue = []
    for key in sorted(plans.PLANS, key=lambda k: plans.PLANS[k]["rank"]):
        entry = plans.PLANS[key]
        for cycle in ("monthly", "annual"):
            code = plans.stored_name(key, cycle)
            prices = {}
            for currency, table in entry["price"].items():
                amount = table.get(cycle)
                if amount is not None:
                    prices[currency.upper()] = money(amount, currency)
            catalogue.append({
                "code": code,
                "name": "{} {}{}".format(
                    shapes.PRODUCT_LABEL, entry["label"],
                    ", annual" if cycle == "annual" else ""),
                "tier": key,
                "billing_cycle": cycle,
                # List price per currency sold in. Billing is /payments; this
                # is only what a move would cost at the rate card.
                "price": prices or None,
                "mrr": micros(plans_view.monthly_mrr_micros(code), plans.INR),
                # None is unlimited, never zero — the same rule the
                # subscription feed follows for the same two columns.
                "branch_limit": entry["limits"].get("branches"),
                "staff_limit": entry["limits"].get("staff"),
            })
    return {"data": catalogue}


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


def _trial_flags(db: Session, groups: Dict[int, List[int]],
                 now=None) -> Dict[int, bool]:
    """Which accounts are on a trial **right now**.

    `clinics` says nothing about trials — MolarPlus keeps that on the
    subscription — so the account's status cannot be read off its own row. The
    CRM needs `trial` separated from `active` to chart trial→paid conversion at
    all, which is a metric the old console did not have.

    The "right now" is the whole of the fix this function once needed. It asked
    for `is_trial IS TRUE` and nothing else, and `is_trial` is set when a clinic
    signs up and cleared only when it pays — never when the trial merely runs
    out. So every clinic that took the seven days and did not buy stayed
    `status: trial` in the CRM indefinitely, while the product's own middleware
    was blocking them with "your trial has ended". Two screens, one clinic,
    opposite answers.

    `vocab.subscription_status(...) == "trial"` is the one definition of a live
    trial; this reaches it in SQL so the filter, the list and the account status
    cannot disagree.
    """
    member_ids = [cid for ids in groups.values() for cid in ids]
    if not member_ids:
        return {}
    trial_clinics = set(
        row[0] for row in
        db.query(Subscription.clinic_id)
        .filter(Subscription.clinic_id.in_(member_ids))
        .filter(vocab.subscription_status_filter(Subscription, ("trial",), now))
        .all()
    )
    return dict(
        (account_id, any(cid in trial_clinics for cid in ids))
        for account_id, ids in groups.items()
    )


def _owners(db: Session, account_ids: List[int]) -> Dict[int, User]:
    """See `org.owners` — shared with the contacts every list row carries."""
    return org.owners(db, account_ids)


def _serialise_accounts(db: Session, rows: List[Tuple], now=None) -> List[dict]:
    account_ids = [clinic.id for clinic, _, _ in rows]
    groups = _group_map(db, account_ids)
    trials = _trial_flags(db, groups, now)
    owners = _owners(db, account_ids)
    return [
        shapes.account(clinic, changed_at, branch_count,
                       is_trial=trials.get(clinic.id, False),
                       owner=owners.get(clinic.id))
        for clinic, changed_at, branch_count in rows
    ]


ACCOUNT_SORTS = {
    "name": Clinic.name,
    "status": Clinic.status,
    "created_at": Clinic.created_at,
}


def _on_trial(now=None):
    """Whether any clinic in this account holds a **live** trial subscription.

    The clinic row says nothing about trials — MolarPlus keeps that on the
    subscription — so `account_status` takes it as an argument. A filter has to
    reach the same fact, and an EXISTS is how it does that without a join that
    would multiply the account rows.

    Same rule as `_trial_flags`, and it has to be: this decides which accounts
    `status=trial` returns and that one decides what each row is labelled. They
    disagreed for as long as neither of them read the dates.
    """
    member = aliased(Clinic)
    return (
        select(Subscription.id)
        .join(member, Subscription.clinic_id == member.id)
        .where(org.belongs_to(member, Clinic.id))
        .where(vocab.subscription_status_filter(Subscription, ("trial",), now))
        .correlate(Clinic)
        .exists()
    )


def _account_status_filter(wanted: List[str], now=None):
    """The contract's four account states, as SQL.

    `trial` and `active` share a clinic status and are told apart by whether
    the account holds a trial subscription — and a suspended clinic on a trial
    is suspended, because it cannot use the product, which is the more urgent
    fact. Mirrors `vocab.account_status` exactly; the two disagreeing would mean
    a list whose rows are labelled something other than what was filtered for.
    """
    trial = _on_trial(now)
    active = func.lower(func.trim(Clinic.status)).in_(("active",))
    clauses = []
    for value in wanted:
        if value == "trial":
            clauses.append(and_(active, trial))
        elif value == "active":
            clauses.append(and_(active, not_(trial)))
        elif value == "suspended":
            clauses.append(func.lower(func.trim(Clinic.status)).in_(("suspended",)))
        elif value == "churned":
            # Everything else, including a status the vocabulary has never
            # seen — it falls back to `churned`, so the filter must too.
            clauses.append(not_(or_(
                active,
                func.lower(func.trim(Clinic.status)).in_(("suspended",)),
            )))
    return or_(*clauses) if clauses else or_(False)


@router.get("/accounts", tags=["accounts"], operation_id="listAccounts")
def list_accounts(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=query.MAX_PAGE_SIZE),
    status: Optional[str] = Query(None, description="Comma-separated"),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """Who the product's customers are.

    Not the CRM's account list — Twenty's Companies page is that, and it holds
    what the sales team owns. This answers the other question: what does this
    customer look like inside MolarPlus right now. The two are joined by the
    external id on the Company record.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    browse = query.Browse(q=q, sort=sort, page=page, page_size=page_size)
    # One instant for the request: whether an account is on a trial is a
    # question about now, asked once by the filter and again by every row.
    now = utcnow()
    rows_q, roll = _account_query(db)
    if since is not None:
        # Inclusive on purpose. An exclusive bound loses every record sharing
        # the timestamp of the last one the caller saw.
        rows_q = rows_q.filter(roll.c.changed_at >= since)

    statuses = query.csv(status)
    if statuses:
        rows_q = rows_q.filter(_account_status_filter(statuses, now))
    rows_q = query.search(rows_q, browse.q, (Clinic.name, Clinic.clinic_code))

    if browse.paging:
        rows_q = query.order(rows_q, browse.sort, ACCOUNT_SORTS, Clinic.name.asc())
        return query.page(rows_q, browse,
                          lambda visible: _serialise_accounts(db, visible, now))

    rows_q = apply_keyset(rows_q, roll.c.changed_at, Clinic.id, cursor)
    rows = rows_q.limit(limit + 1).all()

    return envelope(
        rows, limit,
        lambda visible: _serialise_accounts(db, visible, now),
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

def branch_sorts():
    """What a caller may order a branch list by.

    Every number the branch shape reports is here, not just the timestamps.
    "Which clinics are busiest", "which have the most patients" and "which have
    gone quiet" are the three questions anybody asks of this list, and the first
    two were unanswerable: the counts were computed in Python for whichever page
    the database had already chosen, so there was nothing to order by. Sorting a
    page by a value computed for that page ranks the rows that happened to load.

    Built per call rather than at import because the GMV window is relative to
    now — thirty days from whenever the module was imported is a window that
    slides backwards for as long as the server stays up.
    """
    return {
        "name": Clinic.name,
        "account_name": org.account_name(),
        "status": Clinic.status,
        "created_at": Clinic.created_at,
        "end_customer_count": aggregates.end_customer_count_expression(Clinic),
        "transaction_count": aggregates.transaction_count_expression(Clinic),
        "monthly_gmv": aggregates.monthly_gmv_expression(Clinic),
        # The one the "going quiet" screens order by, and the reason any of this
        # is SQL at all — a page's own numbers are computed in Python, but the
        # ORDER BY has to see every row.
        "last_activity_at": aggregates.last_activity_expression(Clinic),
    }

BRANCH_GROUPS = {
    "status": vocab.branch_status_expression(Clinic.status),
    "country": Clinic.country,
}


@router.get("/branches", tags=["accounts"], operation_id="listBranches")
def list_branches(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=query.MAX_PAGE_SIZE),
    group_by: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Comma-separated"),
    last_activity_before: Optional[str] = Query(
        None, description="Sites not used since this instant. Includes sites "
                          "that have never been used at all."),
    last_activity_after: Optional[str] = Query(
        None, description="Sites used since this instant."),
    min_end_customers: Optional[int] = Query(
        None, ge=0, description="Sites with at least this many end customers."),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """The sites an account runs. In MolarPlus every clinic row is one.

    The per-site numbers live here and the account-level ones are their
    roll-up, deliberately: a group whose total appointments look healthy can
    still have one branch that stopped using the product a month ago, and only
    the branch rows show it.

    Which is exactly what the CRM's branch screens ask, so they pass `page`,
    `sort=last_activity_at` and a `status` filter and read the answer, rather
    than holding a copy of every site to sort for themselves.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    changed = _changed(Clinic.updated_at, Clinic.created_at)
    browse = query.Browse(q=q, sort=sort, page=page, page_size=page_size,
                          group_by=group_by)

    rows_q = db.query(Clinic)
    if account_id:
        rows_q = rows_q.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        rows_q = rows_q.filter(changed >= since)
    statuses = query.csv(status)
    if statuses:
        rows_q = rows_q.filter(vocab.branch_status_filter(Clinic.status, statuses))

    # "Active" on a branch means two different things and a sales team needs
    # both. `status` is whether the product lets the site in; these are whether
    # anybody actually used it. A clinic can be perfectly `active` and not have
    # seen a patient since June, and that one is the churn risk.
    activity = aggregates.last_activity_expression(Clinic)
    quiet_since = parse_rfc3339(last_activity_before)
    if quiet_since is not None:
        # A site that has never been used satisfies "not used since" more
        # completely than any other, so NULL belongs in this answer. Leaving it
        # out would hide the quietest branches from the screen built to find
        # them.
        rows_q = rows_q.filter(or_(activity.is_(None), activity < quiet_since))
    busy_since = parse_rfc3339(last_activity_after)
    if busy_since is not None:
        rows_q = rows_q.filter(activity >= busy_since)
    if min_end_customers is not None:
        rows_q = rows_q.filter(
            aggregates.end_customer_count_expression(Clinic) >= min_end_customers)

    rows_q = query.search(rows_q, browse.q, (Clinic.name, org.account_name(),
                                             Clinic.clinic_code, Clinic.city,
                                             org.account_owner_name(), Clinic.phone,
                                             Clinic.email))

    if browse.group_by:
        return query.group(rows_q, browse.group_by, BRANCH_GROUPS)

    if browse.paging:
        rows_q = query.order(rows_q, browse.sort, branch_sorts(), Clinic.name.asc())
        return query.page(rows_q, browse, lambda page_rows: _branches(db, page_rows))

    rows_q = apply_keyset(rows_q, changed, Clinic.id, cursor)
    rows = rows_q.limit(limit + 1).all()
    return envelope(
        rows, limit, lambda page_rows: _branches(db, page_rows),
        lambda clinic: (_sort_value(clinic.updated_at, clinic.created_at), clinic.id),
    )


def _branches(db: Session, visible) -> List[Dict[str, Any]]:

    """One page of branches, with the account each belongs to and its numbers."""
    accounts = _accounts_of(db, visible)
    contacts = org.contacts(db, [account for account, _ in accounts.values()])
    metrics = aggregates.for_clinics(db, [c.id for c in visible])
    return [
        shapes.branch(clinic, *accounts[clinic.id], metrics=metrics[clinic.id],
                      contact=contacts.get(accounts[clinic.id][0]))
        for clinic in visible
    ]


def _sort_value(updated_at, created_at):
    return updated_at or created_at or org.EPOCH


# ── Subscriptions ────────────────────────────────────────────────────────────

# What a caller may sort a subscription list by, and the expression that does it.
# Contract field names on the left, so the CRM sorts by what the contract
# promised rather than by what MolarPlus happens to store a column called.
# What the response actually reports as `mrr`: list price where the
# subscription is billing, zero where it is not. Sorting on list price alone
# would order a list by numbers it does not display — a trial would outrank a
# paying account.
# `mrr_base`, as SQL: list price in the reporting currency, zero where the
# subscription is not billing. Sorting or summing native `mrr` would order a
# list by numbers in mixed currencies — a dollar plan ranked below a rupee one
# it is worth five times more than.
# Built per request, not once at import. Whether a subscription is billing now
# depends on whether its period has run out, and `utcnow()` evaluated while the
# module loads is the moment the server last restarted — on a box that stays up
# for a month, a sort and a group built from it drift a month out of date
# without ever looking wrong.
def _subscription_mrr(now=None):
    """What the response reports as `mrr_base`, as SQL: list price in the
    reporting currency where the subscription is billing, zero where it is not.

    Sorting or summing native `mrr` would order a list by numbers in mixed
    currencies — a dollar plan ranked below a rupee one it is worth five times
    more than — and sorting on list price regardless of status would put a
    trial above a paying account.
    """
    return case(
        (vocab.subscription_is_billing(Subscription, now),
         plans_view.mrr_expression(Subscription.plan_name, shapes.REPORTING_CURRENCY)),
        else_=0,
    )


def subscription_sorts(now=None):
    """What a caller may sort a subscription list by, and the expression that
    does it. Contract field names on the left, so the CRM sorts by what the
    contract promised rather than by what MolarPlus happens to store a column
    called."""
    return {
        "account_name": org.account_name(),
        "plan_tier": plans_view.rank_expression(Subscription.plan_name),
        "mrr": _subscription_mrr(now),    # i.e. mrr_base — the comparable one
        # The contract's five states, not the raw column: sorting on the column
        # would put an expired trial among the active rows, because that is
        # what the column still says about it.
        "status": vocab.subscription_status_expression(Subscription, now),
        "current_end": Subscription.current_end,
        "trial_ends_at": Subscription.trial_ends_at,
        "created_at": Subscription.created_at,
    }


def subscription_groups(now=None):
    return {
        "plan_tier": plans_view.tier_expression(Subscription.plan_name),
        "billing_cycle": plans_view.cycle_expression(Subscription.plan_name),
        # The contract's five states, not the column's — a bucket labelled
        # "active" that quietly contains trials is worse than no bucket.
        "status": vocab.subscription_status_expression(Subscription, now),
    }


@router.get("/subscriptions", tags=["billing"], operation_id="listSubscriptions")
def list_subscriptions(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    # ── the browse half: what a table on a screen asks for ──
    q: Optional[str] = Query(None, description="Matches the account or plan name"),
    sort: Optional[str] = Query(None, description="field:asc|desc"),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=query.MAX_PAGE_SIZE),
    group_by: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Comma-separated"),
    is_trial: Optional[str] = Query(None),
    at_branch_limit: Optional[str] = Query(None),
    entitlement_mismatch: Optional[str] = Query(None),
    current_end_before: Optional[str] = Query(None),
    current_end_after: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """What accounts pay ClinoHealth.

    Two callers, two shapes. The sync passes `cursor` and gets a feed. The CRM's
    renewals, churn, trials, past-due and MRR-by-tier screens pass `page`,
    `sort`, `group_by` and filters, and get the page they are going to draw.

    The second half exists because those screens used to be Twenty views over a
    copied `Subscription` table. A Twenty view can only query Twenty's database,
    so the copy was the price of the screen. Answering the query here is what
    lets the copy go away and makes this endpoint the only place a subscription
    is described.

    Every subscription held by any clinic in a group is reported against the
    group's account, not just the parent's. Under the parent-clinic shim a
    branch can still carry its own subscription row from before it joined the
    group, and dropping those would delete real MRR from the CRM's totals.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    changed = _changed(Subscription.updated_at, Subscription.created_at)
    browse = query.Browse(q=q, sort=sort, page=page, page_size=page_size,
                          group_by=group_by)
    # One instant for the whole request. Every derived status below is a
    # question about "now", and asking the clock twice inside one response can
    # put a row in a bucket its own row then contradicts.
    now = utcnow()

    if cursor is None and not browse.paging:
        _warn_unattributable(db)

    rows_q = db.query(Subscription, Clinic).join(Clinic, Subscription.clinic_id == Clinic.id)
    if account_id:
        rows_q = rows_q.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        rows_q = rows_q.filter(changed >= since)

    statuses = query.csv(status)
    if statuses:
        # In the contract's vocabulary, not MolarPlus's column. See
        # vocab.subscription_status_filter — `active` and `trial` share a raw
        # value, and `past_due` has no raw value at all.
        rows_q = rows_q.filter(
            vocab.subscription_status_filter(Subscription, statuses, now))
    trial = query.parse_bool(is_trial)
    if trial is not None:
        rows_q = rows_q.filter(Subscription.is_trial.is_(trial))
    before = parse_rfc3339(current_end_before)
    if before is not None:
        rows_q = rows_q.filter(Subscription.current_end <= before)
    after = parse_rfc3339(current_end_after)
    if after is not None:
        rows_q = rows_q.filter(Subscription.current_end >= after)
    rows_q = query.search(rows_q, browse.q, (Clinic.name, org.account_name(),
                                             Subscription.plan_name,
                                             org.account_owner_name(), Clinic.phone,
                                             Clinic.email))

    if browse.group_by:
        # MRR by tier and by billing cycle, and the Kanban column counts, in one
        # GROUP BY rather than a copied table the CRM could SUM for itself.
        return query.group(
            rows_q, browse.group_by, subscription_groups(now),
            {"mrr_micros": func.sum(_subscription_mrr(now))},
        )

    # The two filters `core.plans` decides rather than SQL. See query.py.
    wants_limit = query.parse_bool(at_branch_limit)
    wants_mismatch = query.parse_bool(entitlement_mismatch)

    if browse.paging:
        rows_q = query.order(rows_q, browse.sort, subscription_sorts(now),
                             Subscription.id.asc())
        if wants_limit is None and wants_mismatch is None:
            return query.page(rows_q, browse, lambda page_rows: _subscriptions(db, page_rows))
        candidates = [
            row for row in rows_q.all()
            if _derived_matches(db, row, wants_limit, wants_mismatch)
        ]
        return query.in_memory_page(candidates, browse,
                                    lambda page_rows: _subscriptions(db, page_rows))

    rows_q = apply_keyset(rows_q, changed, Subscription.id, cursor)
    rows = rows_q.limit(limit + 1).all()

    return envelope(
        rows, limit,
        lambda page_rows: _subscriptions(db, page_rows),
        lambda row: (_sort_value(row[0].updated_at, row[0].created_at), row[0].id),
    )


def _subscriptions(db: Session, rows) -> List[Dict[str, Any]]:
    accounts = _accounts_of(db, [clinic for _, clinic in rows])
    contacts = org.contacts(db, [account for account, _ in accounts.values()])
    return [shapes.subscription(sub, *accounts[clinic.id], clinic=clinic,
                                contact=contacts.get(accounts[clinic.id][0]))
            for sub, clinic in rows]


def _derived_matches(db: Session, row, wants_limit, wants_mismatch) -> bool:
    """`at_branch_limit` and `entitlement_mismatch`, decided by the catalogue.

    Both used to be computed by the CRM's sync, which meant the CRM held an
    opinion about entitlement — a product question if there ever was one. They
    are answered here now, by the same `core.plans` rule that gates the feature
    in the product, so the list and the software agree.
    """
    sub, clinic = row
    if wants_mismatch is not None:
        bought, _ = plans.resolve(sub.plan_name)
        effective = plans.effective_plan(sub.plan_name, sub.status, sub.current_end)
        if (bought != effective) is not wants_mismatch:
            return False
    if wants_limit is not None:
        allowed = plans.limit(sub.plan_name, "branches")
        used = org.branch_count(db, clinic)
        at_limit = allowed is not None and used >= allowed
        if at_limit is not wants_limit:
            return False
    return True


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


def _accounts_of(db: Session, clinics: List[Clinic]) -> Dict[int, Tuple[int, str]]:
    """Clinic id → the id and name of the account it belongs to.

    A clinic's account is its parent — unless that parent no longer exists, in
    which case the row is an account in its own right. Resolving it here rather
    than trusting `parent_clinic_id` blindly is what stops an orphan being
    attributed to an account that is not there.

    The name travels with the id because a person reads these lists, and
    `clinic:42` is not something anybody recognises. One query for the page's
    parents, not one per row.
    """
    parent_ids = set(
        c.parent_clinic_id for c in clinics
        if c.parent_clinic_id and c.parent_clinic_id != c.id
    )
    parents = dict(
        db.query(Clinic.id, Clinic.name).filter(Clinic.id.in_(parent_ids)).all()
    ) if parent_ids else {}
    return dict(
        (c.id, (c.parent_clinic_id, parents[c.parent_clinic_id])
         if c.parent_clinic_id in parents else (c.id, c.name))
        for c in clinics
    )


def _account_clinic_ids(db: Session, clinics: List[Clinic]) -> Dict[int, int]:
    """Clinic id → the clinic id of the account it belongs to."""
    return dict((cid, account[0]) for cid, account in _accounts_of(db, clinics).items())


# ── Payments ─────────────────────────────────────────────────────────────────

PAYMENT_SORTS = {
    "account_name": org.account_name(),
    "amount": SubscriptionPayment.amount,
    "paid_at": SubscriptionPayment.paid_at,
    "status": SubscriptionPayment.status,
    "created_at": SubscriptionPayment.created_at,
}

PAYMENT_GROUPS = {
    "status": vocab.payment_status_expression(SubscriptionPayment.status),
    "provider": SubscriptionPayment.provider,
    "plan_name": SubscriptionPayment.plan_name,
}


@router.get("/payments", tags=["billing"], operation_id="listPayments")
def list_payments(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    paid_after: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=query.MAX_PAGE_SIZE),
    group_by: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Comma-separated"),
    paid_before: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """Settled money, as a feed for the sync and as a table for the CRM.

    The failed-payments and unsettled screens are this endpoint with a `status`
    filter. They used to be Twenty views over a copied `Payment` table — a
    ledger of every transaction, replicated nightly, so that a CRM could filter
    it. Filtering it here is what makes the replica unnecessary.

    `subscription_payments` has no `updated_at`, so the sort key and the
    reported `updated_at` are both `COALESCE(paid_at, created_at)`. A refund
    recorded later does not move it and will not appear in an incremental pull
    — that is what the nightly full snapshot is for.
    """
    limit = _limit(limit)
    since = parse_rfc3339(updated_since)
    after = parse_rfc3339(paid_after, "paid_after")
    before = parse_rfc3339(paid_before, "paid_before")
    changed = func.coalesce(SubscriptionPayment.paid_at, SubscriptionPayment.created_at, org.EPOCH)
    browse = query.Browse(q=q, sort=sort, page=page, page_size=page_size,
                          group_by=group_by)

    rows_q = (
        db.query(SubscriptionPayment, Clinic)
        .join(Clinic, SubscriptionPayment.clinic_id == Clinic.id)
    )
    if account_id:
        rows_q = rows_q.filter(org.belongs_to(Clinic, org.parse_account_id(account_id)))
    if since is not None:
        rows_q = rows_q.filter(changed >= since)
    if after is not None:
        rows_q = rows_q.filter(SubscriptionPayment.paid_at >= after)
    if before is not None:
        rows_q = rows_q.filter(SubscriptionPayment.paid_at <= before)
    statuses = query.csv(status)
    if statuses:
        rows_q = rows_q.filter(vocab.payment_status_filter(
            SubscriptionPayment.status, statuses))
    rows_q = query.search(rows_q, browse.q, (
        Clinic.name, org.account_name(), SubscriptionPayment.plan_name,
        SubscriptionPayment.coupon_code, org.account_owner_name(), Clinic.phone,
        Clinic.email))

    if browse.group_by:
        return query.group(rows_q, browse.group_by, PAYMENT_GROUPS,
                           {"amount": func.sum(SubscriptionPayment.amount)})

    def serialise(page_rows):
        accounts = _accounts_of(db, [clinic for _, clinic in page_rows])
        contacts = org.contacts(db, [account for account, _ in accounts.values()])
        return [shapes.payment(pay, *accounts[clinic.id],
                               contact=contacts.get(accounts[clinic.id][0]))
                for pay, clinic in page_rows]

    if browse.paging:
        rows_q = query.order(rows_q, browse.sort, PAYMENT_SORTS, changed.desc())
        return query.page(rows_q, browse, serialise)

    rows_q = apply_keyset(rows_q, changed, SubscriptionPayment.id, cursor)
    rows = rows_q.limit(limit + 1).all()
    return envelope(
        rows, limit, serialise,
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
