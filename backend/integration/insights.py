"""How the business is going, as numbers the CRM can chart.

The list endpoints answer "which ones": which subscriptions renew this month,
which branches went quiet. A dashboard asks "how many", over every row and over
time — how many clinics are paying, how many patients were added each month,
what was collected — and paging through every list to count it in a browser is
the copy this contract exists to avoid, done badly.

So the product counts, once, and hands back the totals. Three endpoints, one per
dashboard, because they fail and grow independently:

    /insights/accounts   who the customers are and what they are paying for
    /insights/activity   how much the product is used — end customers, transactions
    /insights/revenue    what ClinoHealth bills and collects

**Aggregates only, the rule `aggregates.py` holds.** Every query here is a
COUNT, a SUM or a MAX grouped by clinic or by month. No row from `patients`,
`appointments` or `invoices` is selected, and the only names in any response
are clinic names — which the CRM already holds.

**Months are calendar months in UTC**, labelled `YYYY-MM`, oldest first, the
current month last and partial. A clinic in India sees a patient added at 2am
IST on the 1st counted in the previous month; at monthly resolution that is
noise, and a per-account timezone would make two dashboards disagree.

**Money is never summed across currencies.** A monthly total is a list of
`{amount_micros, currency}`, one per currency that month. `mrr` is the
exception, because the catalogue publishes every plan's price in the reporting
currency — the same rule `/subscriptions` sorts by.
"""
import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal_column
from sqlalchemy.orm import Session

from core import plans
from database import get_db
from models import Appointment, Clinic, Invoice, Patient, Subscription, SubscriptionPayment

from . import aggregates, org, plans_view, vocab
from .auth import Caller, require_read
from .shapes import REPORTING_CURRENCY
from .wire import micros, to_rfc3339, utcnow

router = APIRouter()

MAX_MONTHS = 24
DEFAULT_MONTHS = 12
TOP_ACCOUNTS = 10

# The five states a customer can be in, as the dashboards count them. The
# subscription vocabulary's five, with `active` renamed for what it means here
# and cancelled folded into expired: to "how many clinics are paying", a clinic
# that cancelled and one whose plan ran out are the same answer.
ACCOUNT_STATES = ("paying", "trial", "past_due", "expired", "none")
_STATE_OF = {
    "active": "paying",
    "trial": "trial",
    "past_due": "past_due",
    "cancelled": "expired",
    "expired": "expired",
}
BILLING_STATUSES = ("active", "past_due")


# ── Shared ──────────────────────────────────────────────────────────────────

class Window(object):
    """The months a response covers, and the SQL to bucket a timestamp into one."""

    def __init__(self, db: Session, now: datetime.datetime, months: int):
        self.now = now
        first = datetime.datetime(now.year, now.month, 1)
        starts = [first]
        for _ in range(months - 1):
            previous = starts[-1] - datetime.timedelta(days=1)
            starts.append(datetime.datetime(previous.year, previous.month, 1))
        starts.reverse()
        self.start = starts[0]
        self.labels = [s.strftime("%Y-%m") for s in starts]
        self.dialect = db.bind.dialect.name if db.bind is not None else "postgresql"

    def month(self, column):
        """`YYYY-MM` for a timestamp column, in whichever database this is.

        Postgres in production, SQLite in the conformance suite, and the two
        share no date function — the same reason `aggregates._greatest` exists.

        The format is written into the SQL rather than bound. Bound, SELECT and
        GROUP BY each get their own placeholder, and a server that prepares the
        statement sees two different expressions and refuses the grouping.
        """
        if self.dialect == "sqlite":
            return func.strftime(literal_column("'%Y-%m'"), column)
        return func.to_char(column, literal_column("'YYYY-MM'"))

    def label(self, value: Optional[datetime.datetime]) -> Optional[str]:
        if value is None or value < self.start or value > self.now:
            return None
        return value.strftime("%Y-%m")

    def counts(self, pairs: Iterable[Tuple[Optional[str], int]]) -> List[Dict[str, Any]]:
        """Every month in the window, zero where nothing happened.

        A month with no rows is absent from a GROUP BY. Sent that way, a chart
        joins January to March and draws a quiet February as a gentle slope.
        """
        found: Dict[str, int] = {}
        for label, count in pairs:
            if label in self.labels:
                found[label] = found.get(label, 0) + int(count or 0)
        return [{"month": label, "count": found.get(label, 0)} for label in self.labels]

    def amounts(self, totals: Dict[Tuple[str, str], float]) -> List[Dict[str, Any]]:
        """Every month in the window, each with its total per currency."""
        out = []
        for label in self.labels:
            by_currency = sorted((currency, total) for (month, currency), total
                                 in totals.items() if month == label)
            out.append({
                "month": label,
                "amounts": [micros(int(round(total * 1_000_000)), currency)
                            for currency, total in by_currency],
            })
        return out


def _months(months: int) -> int:
    return max(1, min(months, MAX_MONTHS))


def _clinics(db: Session):
    """Every clinic, and the account each belongs to.

    The same rule as `reads._accounts_of`: a clinic's account is its parent,
    unless the parent does not exist, in which case it is its own. Loaded whole
    because a dashboard needs all of them and there are hundreds, not millions.
    """
    rows = db.query(Clinic.id, Clinic.name, Clinic.parent_clinic_id, Clinic.created_at,
                    Clinic.country, Clinic.currency_code).all()
    ids = set(row.id for row in rows)
    account_of = dict(
        (row.id, row.parent_clinic_id
         if row.parent_clinic_id in ids and row.parent_clinic_id != row.id else row.id)
        for row in rows)
    return rows, account_of


def _currency(row) -> str:
    return (row.currency_code or plans_view.billing_currency(row.country)).upper()


def _current_subscriptions(db: Session, account_of: Dict[int, int]):
    """Each account's current subscription: the one whose period ends last.

    A clinic keeps its old rows — a trial, then the paid plan that followed it,
    a lapsed plan and the one that won it back — and every one of them is true
    history. The one ending latest is what the clinic has now; ties go to the
    newer row.
    """
    current: Dict[int, Any] = {}
    for sub in db.query(Subscription).filter(Subscription.clinic_id.isnot(None)).all():
        account = account_of.get(sub.clinic_id)
        if account is None:
            continue
        key = (sub.current_end or org.EPOCH, sub.created_at or org.EPOCH, sub.id)
        held = current.get(account)
        if held is None or key > held[0]:
            current[account] = (key, sub)
    return dict((account, held[1]) for account, held in current.items())


def _state(sub) -> str:
    if sub is None:
        return "none"
    return _STATE_OF[vocab.subscription_status(sub.status, bool(sub.is_trial), sub.id)]


# ── Accounts ────────────────────────────────────────────────────────────────

@router.get("/insights/accounts", tags=["insights"], operation_id="getAccountInsights")
def account_insights(
    months: int = Query(DEFAULT_MONTHS, ge=1, le=MAX_MONTHS),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """How many customers there are, what they are paying for, and how that moved.

    `converted` counts an account in the month of its first settled payment:
    the month it became a paying customer, whatever came before. `lapsed`
    counts an account whose current plan has ended, in the month it ended — a
    clinic that lapsed and came back is counted in neither, because it did not
    leave.
    """
    now = utcnow()
    window = Window(db, now, _months(months))
    clinics, account_of = _clinics(db)
    roots = [row for row in clinics if account_of[row.id] == row.id]
    current = _current_subscriptions(db, account_of)

    states = dict((state, 0) for state in ACCOUNT_STATES)
    tiers: Dict[str, int] = {}
    trials_ending = 0
    lapsed = []
    for root in roots:
        sub = current.get(root.id)
        state = _state(sub)
        states[state] += 1
        if state == "paying":
            tier, _ = plans.resolve(sub.plan_name)
            tiers[tier] = tiers.get(tier, 0) + 1
        if state == "trial":
            ends = sub.trial_ends_at or sub.current_end
            if ends is not None and now <= ends <= now + datetime.timedelta(days=7):
                trials_ending += 1
        if state == "expired":
            lapsed.append((window.label(sub.current_end), 1))

    first_paid: Dict[int, datetime.datetime] = {}
    paid = vocab.payment_status_filter(SubscriptionPayment.status, ["paid"])
    for clinic_id, first in (
        db.query(SubscriptionPayment.clinic_id, func.min(SubscriptionPayment.paid_at))
        .filter(paid, SubscriptionPayment.paid_at.isnot(None))
        .group_by(SubscriptionPayment.clinic_id)
        .all()
    ):
        account = account_of.get(clinic_id)
        if account is not None and (account not in first_paid or first < first_paid[account]):
            first_paid[account] = first

    countries: Dict[str, int] = {}
    for root in roots:
        code = (root.country or "").upper() or None
        countries[code] = countries.get(code, 0) + 1

    return {
        "as_of": to_rfc3339(now),
        "months": window.labels,
        "accounts": len(roots),
        "branches": len(clinics),
        "by_state": [{"key": state, "count": states[state]} for state in ACCOUNT_STATES],
        "paying_by_tier": [{"key": tier, "count": count} for tier, count in _tier_order(tiers)],
        "trials_ending_7_days": trials_ending,
        "signups": window.counts((window.label(root.created_at), 1) for root in roots),
        "converted": window.counts((window.label(when), 1) for when in first_paid.values()),
        "lapsed": window.counts(lapsed),
        "by_country": [{"key": key, "count": count} for key, count
                       in sorted(countries.items(), key=lambda item: (-item[1], item[0] or ""))],
    }


def _tier_order(tiers: Dict[str, int]) -> List[Tuple[str, int]]:
    """plus, pro, growth — the ladder's order, not the alphabet's, every tier present."""
    ladder = ("plus", "pro", "growth")
    return [(tier, tiers.get(tier, 0)) for tier in ladder] + sorted(
        (tier, count) for tier, count in tiers.items() if tier not in ladder)


# ── Activity ────────────────────────────────────────────────────────────────

@router.get("/insights/activity", tags=["insights"], operation_id="getActivityInsights")
def activity_insights(
    months: int = Query(DEFAULT_MONTHS, ge=1, le=MAX_MONTHS),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """How much the product is used: end customers, transactions, active accounts.

    An account is active in a window if any of its sites added an end
    customer, booked a transaction or raised an invoice in it — the same three
    signals as `last_activity_at`, so "active in the last 30 days" and "last
    used 31 days ago" can never both be true of one clinic.

    `transactions` are bucketed by when they take place, not when they were
    booked, and only up to now: a month's appointments are the ones held in it.
    `gmv` is the clinics' own billing — never ClinoHealth revenue.
    """
    now = utcnow()
    window = Window(db, now, _months(months))
    clinics, account_of = _clinics(db)
    names = dict((row.id, row.name or "") for row in clinics)
    currency_of = dict((row.id, _currency(row)) for row in clinics)
    roots = set(account_of.values())

    patients_month = window.month(Patient.created_at)
    new_end_customers = window.counts(
        db.query(patients_month, func.count(Patient.id))
        .filter(Patient.created_at >= window.start, Patient.created_at <= now)
        .group_by(patients_month).all())

    held_month = window.month(Appointment.appointment_date)
    transactions = window.counts(
        db.query(held_month, func.count(Appointment.id))
        .filter(Appointment.appointment_date >= window.start, Appointment.appointment_date <= now)
        .group_by(held_month).all())

    def active_since(days: int) -> int:
        since = now - datetime.timedelta(days=days)
        seen = set()
        for model in (Patient, Appointment, Invoice):
            for (clinic_id,) in (db.query(model.clinic_id)
                                 .filter(model.created_at >= since, model.clinic_id.isnot(None))
                                 .distinct().all()):
                if clinic_id in account_of:
                    seen.add(account_of[clinic_id])
        return len(seen)

    billed_at = func.coalesce(Invoice.finalized_at, Invoice.created_at)
    billed_month = window.month(billed_at)
    gmv: Dict[Tuple[str, str], float] = {}
    for label, clinic_id, total in (
        db.query(billed_month, Invoice.clinic_id, func.sum(Invoice.total))
        .filter(~Invoice.status.in_(aggregates.GMV_EXCLUDED_STATUSES))
        .filter(billed_at >= window.start, billed_at <= now)
        .group_by(billed_month, Invoice.clinic_id).all()
    ):
        key = (label, currency_of.get(clinic_id, "INR"))
        gmv[key] = gmv.get(key, 0.0) + float(total or 0.0)

    per_account: Dict[int, Dict[str, Any]] = {}

    def tally(model, field):
        for clinic_id, count, newest in (
            db.query(model.clinic_id, func.count(model.id), func.max(model.created_at))
            .filter(model.clinic_id.isnot(None))
            .group_by(model.clinic_id).all()
        ):
            account = account_of.get(clinic_id)
            if account is None:
                continue
            entry = per_account.setdefault(account, {
                "end_customer_count": 0, "transaction_count": 0, "last_activity_at": None})
            entry[field] += int(count or 0)
            if newest and (entry["last_activity_at"] is None or newest > entry["last_activity_at"]):
                entry["last_activity_at"] = newest

    tally(Patient, "end_customer_count")
    tally(Appointment, "transaction_count")
    end_customers = sum(entry["end_customer_count"] for entry in per_account.values())
    transaction_total = sum(entry["transaction_count"] for entry in per_account.values())

    top = sorted(per_account.items(),
                 key=lambda item: (-item[1]["end_customer_count"],
                                   -item[1]["transaction_count"], item[0]))[:TOP_ACCOUNTS]

    return {
        "as_of": to_rfc3339(now),
        "months": window.labels,
        "end_customers": end_customers,
        "transactions": transaction_total,
        "new_end_customers": new_end_customers,
        "transactions_by_month": transactions,
        "active_accounts": {
            "accounts": len(roots),
            "days_7": active_since(7),
            "days_30": active_since(30),
        },
        "gmv_by_month": window.amounts(gmv),
        "top_accounts": [
            {
                "account_id": org.account_id(account),
                "account_name": names.get(account, ""),
                "end_customer_count": entry["end_customer_count"],
                "transaction_count": entry["transaction_count"],
                "last_activity_at": to_rfc3339(entry["last_activity_at"]),
            }
            for account, entry in top
        ],
    }


# ── Revenue ─────────────────────────────────────────────────────────────────

@router.get("/insights/revenue", tags=["insights"], operation_id="getRevenueInsights")
def revenue_insights(
    months: int = Query(DEFAULT_MONTHS, ge=1, le=MAX_MONTHS),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """What ClinoHealth bills and collects.

    `mrr` is the list price of every billing subscription, per month, in the
    reporting currency — the figure `/subscriptions?sort=mrr` orders by, summed.
    Trials and ended plans contribute nothing. There is no MRR history: a
    subscription row is renewed in place, so last March's MRR is not in the
    database to be read. `collected` — money that actually settled, month by
    month — is the trend that can be told honestly.
    """
    now = utcnow()
    window = Window(db, now, _months(months))
    currency = REPORTING_CURRENCY
    _, account_of = _clinics(db)

    mrr = 0
    paying = set()
    by_tier: Dict[str, List[int]] = {}
    by_cycle: Dict[str, List[int]] = {}
    renewals = [0, 0]
    horizon = now + datetime.timedelta(days=30)
    for sub in db.query(Subscription).filter(Subscription.clinic_id.isnot(None)).all():
        status = vocab.subscription_status(sub.status, bool(sub.is_trial), sub.id)
        if status not in BILLING_STATUSES:
            continue
        amount = plans_view.monthly_mrr_micros(sub.plan_name, currency)
        tier, cycle = plans.resolve(sub.plan_name)
        mrr += amount
        if sub.clinic_id in account_of:
            paying.add(account_of[sub.clinic_id])
        for bucket, key in ((by_tier, tier), (by_cycle, cycle)):
            entry = bucket.setdefault(key, [0, 0])
            entry[0] += 1
            entry[1] += amount
        if sub.current_end is not None and now <= sub.current_end <= horizon:
            renewals[0] += 1
            renewals[1] += amount

    settled = vocab.payment_status_filter(SubscriptionPayment.status, ["paid"])
    failed = vocab.payment_status_filter(SubscriptionPayment.status, ["failed"])
    paid_month = window.month(SubscriptionPayment.paid_at)

    collected: Dict[Tuple[str, str], float] = {}
    discounts: Dict[Tuple[str, str], float] = {}
    counts: Dict[str, int] = {}
    for label, row_currency, total, discount, count in (
        db.query(paid_month, SubscriptionPayment.currency, func.sum(SubscriptionPayment.amount),
                 func.sum(SubscriptionPayment.discount_amount), func.count(SubscriptionPayment.id))
        .filter(settled, SubscriptionPayment.paid_at >= window.start,
                SubscriptionPayment.paid_at <= now)
        .group_by(paid_month, SubscriptionPayment.currency).all()
    ):
        key = (label, (row_currency or currency).upper())
        collected[key] = collected.get(key, 0.0) + float(total or 0.0)
        if discount:
            discounts[key] = discounts.get(key, 0.0) + float(discount)
        counts[label] = counts.get(label, 0) + int(count or 0)

    failed_at = func.coalesce(SubscriptionPayment.paid_at, SubscriptionPayment.created_at)
    failed_month = window.month(failed_at)
    failures = window.counts(
        db.query(failed_month, func.count(SubscriptionPayment.id))
        .filter(failed, failed_at >= window.start, failed_at <= now)
        .group_by(failed_month).all())

    collected_by_month = window.amounts(collected)
    for entry in collected_by_month:
        entry["count"] = counts.get(entry["month"], 0)

    def grouped(bucket, order):
        keys = [key for key in order if key in bucket] + sorted(k for k in bucket if k not in order)
        return [{"key": key, "count": bucket[key][0], "mrr": micros(bucket[key][1], currency)}
                for key in keys]

    return {
        "as_of": to_rfc3339(now),
        "months": window.labels,
        "currency": currency,
        "mrr": micros(mrr, currency),
        "arr": micros(mrr * 12, currency),
        "paying_accounts": len(paying),
        "arpa": micros(mrr // len(paying) if paying else 0, currency),
        "mrr_by_tier": grouped(by_tier, ("plus", "pro", "growth")),
        "mrr_by_cycle": grouped(by_cycle, ("monthly", "annual")),
        "renewals_30_days": {"count": renewals[0], "mrr": micros(renewals[1], currency)},
        "collected": collected_by_month,
        "failed": failures,
        "discounts": window.amounts(discounts),
    }
