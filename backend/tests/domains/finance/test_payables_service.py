"""The money rules for supplier bills, tested against plain objects.

These are the three numbers the whole feature rests on — what is still owed,
what state that puts a bill in, and when it falls due. They are tested here
without a database or a request because that is what makes it cheap to cover
the edges that matter: the rounding that leaves a hundredth of a rupee behind,
the cancelled bill that must not come back to life, the overpayment that must
not read as a credit.
"""
import datetime
from types import SimpleNamespace as NS

import pytest

from domains.finance.services.payables import (
    SETTLED_EPSILON, ageing_bucket, ageing_summary, compute_due_date,
    days_overdue, outstanding, paid_amount, resolve_status, terms_from_due_date,
)

JAN1 = datetime.date(2026, 1, 1)


def bill(amount=4000.0, payments=(), status='unpaid', bill_date=JAN1, terms=45):
    return NS(amount=amount, payments=list(payments), status=status,
              bill_date=bill_date, terms_days=terms,
              due_date=compute_due_date(bill_date, terms))


def payment(amount, on=JAN1):
    return NS(amount=amount, paid_on=on)


# ── Terms and due dates ─────────────────────────────────────────────────────

def test_a_45_day_bill_falls_due_45_days_later():
    assert compute_due_date(JAN1, 45) == datetime.date(2026, 2, 15)


def test_no_terms_means_due_on_the_bill_date():
    assert compute_due_date(JAN1, 0) == JAN1


def test_terms_and_due_date_are_inverses():
    """A clinic that types a due date instead of terms must not leave the bill
    still claiming the old terms — that is how a 30-day bill goes on saying 45."""
    due = datetime.date(2026, 2, 15)
    assert terms_from_due_date(JAN1, due) == 45
    assert compute_due_date(JAN1, terms_from_due_date(JAN1, due)) == due


def test_negative_terms_are_clamped_rather_than_dated_backwards():
    assert compute_due_date(JAN1, -10) == JAN1


# ── Outstanding ─────────────────────────────────────────────────────────────

def test_a_part_payment_reduces_the_outstanding():
    b = bill(4000.0, [payment(1500.0)])
    assert paid_amount(b.payments) == 1500.0
    assert outstanding(b) == 2500.0


def test_several_part_payments_add_up():
    b = bill(4000.0, [payment(1500.0), payment(500.0), payment(1000.0)])
    assert outstanding(b) == 1000.0


def test_outstanding_is_derived_not_stored():
    """Adding a payment changes the answer with nothing else written."""
    b = bill(4000.0)
    assert outstanding(b) == 4000.0
    b.payments.append(payment(4000.0))
    assert outstanding(b) == 0.0


# ── Status ──────────────────────────────────────────────────────────────────

def test_status_walks_unpaid_to_partial_to_paid():
    b = bill(4000.0)
    assert resolve_status(b) == 'unpaid'
    b.payments.append(payment(1000.0))
    assert resolve_status(b) == 'partial'
    b.payments.append(payment(3000.0))
    assert resolve_status(b) == 'paid'


def test_a_thirds_split_still_settles():
    """4000 paid as three thirds leaves a hundredth behind. Without the epsilon
    the bill stays 'partial' forever and sits on the ageing report owing a
    penny nobody can pay."""
    third = round(4000.0 / 3, 2)
    b = bill(4000.0, [payment(third), payment(third), payment(third)])
    assert abs(outstanding(b)) <= SETTLED_EPSILON
    assert resolve_status(b) == 'paid'


def test_a_cancelled_bill_stays_cancelled():
    """Cancelling is a decision about the bill, not a consequence of the money.
    Recomputing it from zero payments would silently revive it as 'unpaid'."""
    assert resolve_status(bill(4000.0, status='cancelled')) == 'cancelled'


# ── Overdue ─────────────────────────────────────────────────────────────────

def test_not_overdue_before_the_due_date():
    b = bill(terms=45)
    assert days_overdue(b, JAN1 + datetime.timedelta(days=44)) == 0


def test_overdue_counts_from_the_due_date():
    b = bill(terms=45)
    assert days_overdue(b, datetime.date(2026, 2, 20)) == 5


def test_a_paid_bill_is_never_overdue():
    """It is finished, not late."""
    b = bill(4000.0, [payment(4000.0)], status='paid')
    assert days_overdue(b, datetime.date(2027, 1, 1)) == 0


# ── Ageing ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("age,expected", [
    (0, '0-30'), (30, '0-30'), (31, '31-60'), (60, '31-60'),
    (61, '61-90'), (90, '61-90'), (91, '90+'), (400, '90+'),
])
def test_ageing_buckets(age, expected):
    assert ageing_bucket(JAN1, JAN1 + datetime.timedelta(days=age)) == expected


def test_ageing_counts_what_is_owed_not_the_face_value():
    """A 50,000 bill with 45,000 paid is 5,000 of exposure. Reporting the whole
    figure makes a clinic that pays promptly look like one that does not."""
    b = bill(50000.0, [payment(45000.0)])
    summary = ageing_summary([b], JAN1)
    assert summary['total'] == 5000.0
    assert summary['buckets'][0] == {'bucket': '0-30', 'amount': 5000.0, 'count': 1}


def test_ageing_ignores_settled_and_cancelled_bills():
    rows = [
        bill(1000.0, [payment(1000.0)]),                 # settled
        bill(2000.0, status='cancelled'),                # cancelled
        bill(3000.0),                                    # the only live one
    ]
    summary = ageing_summary(rows, JAN1)
    assert summary['total'] == 3000.0


def test_ageing_spreads_bills_across_buckets():
    today = datetime.date(2026, 6, 1)
    rows = [
        bill(100.0, bill_date=today - datetime.timedelta(days=5)),
        bill(200.0, bill_date=today - datetime.timedelta(days=45)),
        bill(300.0, bill_date=today - datetime.timedelta(days=75)),
        bill(400.0, bill_date=today - datetime.timedelta(days=200)),
    ]
    got = {b['bucket']: b['amount'] for b in ageing_summary(rows, today)['buckets']}
    assert got == {'0-30': 100.0, '31-60': 200.0, '61-90': 300.0, '90+': 400.0}
