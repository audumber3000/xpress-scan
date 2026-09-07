"""Per-site counts and sums — and nothing below them.

The contract transmits `end_customer_count`, `transaction_count` and
`monthly_gmv`. It has no endpoint that returns a patient, an appointment or an
invoice line, and adding one is not a change to make later: patient data is
health data, and replicating it into a CRM that support staff across five
product lines can read turns an integration into a compliance problem.

Every query in this module is therefore an aggregate. `COUNT`, `SUM` and `MAX`
only — if a `SELECT` here ever returns a row from `patients`, `appointments` or
`invoices`, that is the bug.

**`monthly_gmv` is the clinic's own revenue, not ClinoHealth's.** It is what a
practice bills its patients, and it is an account-health signal. ClinoHealth's
revenue is `Subscription.mrr`. The old support console conflated the two — every
"revenue" figure in its metrics endpoints was actually this number — which is
how it managed to have a financials page and report no MRR at all. They must
never be summed together or charted on one axis.
"""
import datetime
import logging
from typing import Dict, Iterable, List, Optional

from sqlalchemy import func

from models import Appointment, Invoice, Patient

log = logging.getLogger("integration.aggregates")

GMV_WINDOW_DAYS = 30

# An invoice that was never issued is not money the clinic billed. Everything
# else — finalized, partially paid, paid — is.
GMV_EXCLUDED_STATUSES = ("draft", "cancelled")


class SiteMetrics(object):
    """The four numbers the contract asks of a site."""

    __slots__ = ("end_customer_count", "transaction_count", "gmv", "last_activity_at")

    def __init__(self):
        self.end_customer_count = 0
        self.transaction_count = 0
        self.gmv = 0.0
        self.last_activity_at = None

    def note_activity(self, when: Optional[datetime.datetime]) -> None:
        if when and (self.last_activity_at is None or when > self.last_activity_at):
            self.last_activity_at = when


def _empty(clinic_ids: Iterable[int]) -> Dict[int, SiteMetrics]:
    return dict((cid, SiteMetrics()) for cid in clinic_ids)


def for_clinics(db, clinic_ids: List[int],
                now: Optional[datetime.datetime] = None) -> Dict[int, SiteMetrics]:
    """Aggregates for a page of clinics, in four grouped queries rather than
    four per clinic.

    The page is bounded by `limit` (1,000 at most), so the `IN` list is bounded
    too. Doing this per row is the first thing that makes a nightly sync slow,
    which is also why the contract offers `/accounts/{id}/stats` as a roll-up
    the product computes itself.
    """
    metrics = _empty(clinic_ids)
    if not clinic_ids:
        return metrics

    now = now or datetime.datetime.utcnow()
    since = now - datetime.timedelta(days=GMV_WINDOW_DAYS)

    for clinic_id, count, last_seen in (
        db.query(Patient.clinic_id, func.count(Patient.id), func.max(Patient.created_at))
        .filter(Patient.clinic_id.in_(clinic_ids))
        .group_by(Patient.clinic_id)
        .all()
    ):
        entry = metrics.get(clinic_id)
        if entry is not None:
            entry.end_customer_count = int(count or 0)
            entry.note_activity(last_seen)

    for clinic_id, count, last_seen in (
        db.query(Appointment.clinic_id, func.count(Appointment.id), func.max(Appointment.created_at))
        .filter(Appointment.clinic_id.in_(clinic_ids))
        .group_by(Appointment.clinic_id)
        .all()
    ):
        entry = metrics.get(clinic_id)
        if entry is not None:
            entry.transaction_count = int(count or 0)
            entry.note_activity(last_seen)

    # GMV is windowed; the activity timestamp is not. An account that stopped
    # invoicing five weeks ago has a GMV of zero and a `last_activity_at` five
    # weeks old, and the second of those is the churn signal — a zero on its
    # own cannot tell "quiet month" from "gone".
    billed_at = func.coalesce(Invoice.finalized_at, Invoice.created_at)
    for clinic_id, total in (
        db.query(Invoice.clinic_id, func.sum(Invoice.total))
        .filter(Invoice.clinic_id.in_(clinic_ids))
        .filter(~Invoice.status.in_(GMV_EXCLUDED_STATUSES))
        .filter(billed_at >= since)
        .group_by(Invoice.clinic_id)
        .all()
    ):
        entry = metrics.get(clinic_id)
        if entry is not None:
            entry.gmv = float(total or 0.0)

    for clinic_id, last_seen in (
        db.query(Invoice.clinic_id, func.max(Invoice.created_at))
        .filter(Invoice.clinic_id.in_(clinic_ids))
        .group_by(Invoice.clinic_id)
        .all()
    ):
        entry = metrics.get(clinic_id)
        if entry is not None:
            entry.note_activity(last_seen)

    return metrics


def roll_up(metrics: Dict[int, SiteMetrics], clinic_ids: List[int],
            currency_of: Dict[int, str], account_currency: str,
            account_id: str = "") -> SiteMetrics:
    """Sum a group's sites into the account-level figures.

    Counts add up across currencies; money does not. `invoices` carries no
    currency of its own — a clinic bills in `clinics.currency_code` — so a group
    whose branches sit in different currencies has no single GMV, and adding
    the numbers anyway is precisely the float-summation-across-currencies bug
    this contract exists to make impossible.

    Branches outside the account's own currency are therefore left out of the
    total and logged. That under-reports, visibly, which is the safe direction:
    a number that is too small prompts a question, and one that is too big
    prompts a board slide.
    """
    total = SiteMetrics()
    skipped = []
    for clinic_id in clinic_ids:
        entry = metrics.get(clinic_id)
        if entry is None:
            continue
        total.end_customer_count += entry.end_customer_count
        total.transaction_count += entry.transaction_count
        total.note_activity(entry.last_activity_at)
        if (currency_of.get(clinic_id) or account_currency) == account_currency:
            total.gmv += entry.gmv
        elif entry.gmv:
            skipped.append(clinic_id)

    if skipped:
        log.warning(
            "account %s: monthly_gmv excludes branches %s, which bill in a "
            "currency other than %s", account_id or "?", skipped, account_currency,
        )
    return total
