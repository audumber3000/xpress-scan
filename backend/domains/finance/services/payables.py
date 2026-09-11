"""The money rules for supplier bills, in one place.

Three of these are the whole feature, and all three are the kind of thing that
goes quietly wrong when each route works it out for itself:

  * what a bill is still owed,
  * what state that puts it in, and
  * when it falls due.

Nothing here touches the session or the request. That is deliberate: it makes
every rule testable against plain objects, and it keeps the routes to validation
and persistence.
"""
import datetime
from typing import Iterable, Optional

# Anything at or under this is treated as settled. Bills are floats, and a
# 4000.00 bill paid as 1333.33 x3 leaves a hundredth of a rupee behind — which
# would otherwise leave the bill "partial" forever and keep it on the ageing
# report with an outstanding balance nobody can pay.
SETTLED_EPSILON = 0.01

# Ageing is measured from the bill's own date, not from its due date: the
# question the buckets answer is "how long has this been on my book", which is
# the same question whatever terms each supplier gave. Days *overdue* is a
# different and also useful number, so it is reported per bill alongside.
AGEING_BUCKETS = ('0-30', '31-60', '61-90', '90+')


def compute_due_date(bill_date: datetime.date, terms_days: int) -> datetime.date:
    """When a bill falls due. Terms are counted from the bill date."""
    return bill_date + datetime.timedelta(days=max(0, int(terms_days or 0)))


def terms_from_due_date(bill_date: datetime.date, due_date: datetime.date) -> int:
    """The inverse, for when a clinic types a due date instead of terms.

    Keeping the pair consistent in both directions is what stops a bill whose
    due date was edited from still claiming it is on 45-day terms.
    """
    return max(0, (due_date - bill_date).days)


def paid_amount(payments: Iterable) -> float:
    return round(sum(float(getattr(p, 'amount', 0) or 0) for p in payments), 2)


def outstanding(bill, payments: Optional[Iterable] = None) -> float:
    """What is still owed. Never stored — it is the difference between two
    numbers that are, and a third copy is a third thing to disagree."""
    rows = payments if payments is not None else (getattr(bill, 'payments', None) or [])
    return round(float(bill.amount or 0) - paid_amount(rows), 2)


def resolve_status(bill, payments: Optional[Iterable] = None) -> str:
    """The state a bill is in, from its payments alone.

    A cancelled bill stays cancelled: it is a decision about the bill, not a
    consequence of the money, and recomputing would silently revive it.
    """
    if bill.status == 'cancelled':
        return 'cancelled'
    left = outstanding(bill, payments)
    if left <= SETTLED_EPSILON:
        return 'paid'
    if left < round(float(bill.amount or 0), 2) - SETTLED_EPSILON:
        return 'partial'
    return 'unpaid'


def days_overdue(bill, today: Optional[datetime.date] = None) -> int:
    """How far past its due date a bill is. Zero when it is not yet due, and
    zero once it is settled — a paid bill is not overdue, it is finished."""
    if bill.status in ('paid', 'cancelled'):
        return 0
    today = today or datetime.date.today()
    return max(0, (today - bill.due_date).days)


def ageing_bucket(bill_date: datetime.date, today: Optional[datetime.date] = None) -> str:
    """Which column of the ageing report a bill belongs in."""
    age = ((today or datetime.date.today()) - bill_date).days
    if age <= 30:
        return '0-30'
    if age <= 60:
        return '31-60'
    if age <= 90:
        return '61-90'
    return '90+'


def ageing_summary(bills, today: Optional[datetime.date] = None) -> dict:
    """Outstanding money per bucket, for the bills handed in.

    Only what is still owed is counted, not the face value: a 50,000 bill with
    45,000 already paid is 5,000 of exposure, and reporting the whole figure
    would make a clinic that pays promptly look like one that does not.
    """
    today = today or datetime.date.today()
    buckets = {b: {'bucket': b, 'amount': 0.0, 'count': 0} for b in AGEING_BUCKETS}
    for bill in bills:
        if bill.status == 'cancelled':
            continue
        left = outstanding(bill)
        if left <= SETTLED_EPSILON:
            continue
        slot = buckets[ageing_bucket(bill.bill_date, today)]
        slot['amount'] = round(slot['amount'] + left, 2)
        slot['count'] += 1
    return {
        'buckets': [buckets[b] for b in AGEING_BUCKETS],
        'total': round(sum(b['amount'] for b in buckets.values()), 2),
    }
