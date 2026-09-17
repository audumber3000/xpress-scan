"""What has been paid against a bill, printed where the bill adds up.

An invoice showed what the treatment cost and stopped there, so a patient who
had paid part of it was handed a document with the full amount and no sign of
what they had already given. The per-payment receipt answers this with two rows
at the foot of its summary — paid so far, and the balance due as on a date — and
that is the shape the bill now uses too.

They are rows in each layout's OWN totals table, drawn in that layout's style.
Not a separate panel: an earlier version printed a bordered box with the list of
instalments, which on the classic layout landed above the treatment table and
read as something stuck on top of the invoice.

Nothing changes on a bill with no payments against it. The total already IS the
amount due there, and every such bill renders exactly as it did before.
"""
from types import SimpleNamespace


def payment_summary(invoice):
    """(paid, due, count) for one invoice, or None when nothing has been paid.

    Summed from the instalment rows, which is what the app's own figures and
    `Invoice.status` are derived from — a second source of truth for "how much
    has this patient paid" is how a bill and a receipt start disagreeing.
    """
    payments = list(getattr(invoice, 'payments', None) or [])
    if not payments:
        return None
    paid = sum(float(getattr(p, 'amount', 0) or 0) for p in payments)
    if paid <= 0:
        return None
    total = float(getattr(invoice, 'total', 0) or 0)
    return paid, max(total - paid, 0.0), len(payments)


def balance_rows(invoice, clinic):
    """The figures for the two extra rows, or None when there is nothing to add.

    `as_on` is the clinic's own today, because that is the moment the balance is
    true for: printing the bill again next week may show a different figure, and
    the date says so — the same wording the receipt uses.
    """
    summary = payment_summary(invoice)
    if not summary:
        return None
    paid, due, count = summary
    from core.clinic_time import clinic_today
    return SimpleNamespace(
        paid=paid,
        due=due,
        count=count,
        settled=due <= 0.005,   # half a paisa: floating point, not a real balance
        as_on=clinic_today(clinic).strftime('%d %B %Y'),
    )


def as_on_line(b, size='10px'):
    """The small "as on 14 September 2026" line under the Balance Due label."""
    return (f'<span style="display:block;font-weight:normal;font-size:{size};'
            f'opacity:.8;">as on {b.as_on}</span>')
