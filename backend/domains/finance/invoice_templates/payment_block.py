"""What has actually been paid against a bill, printed on the bill.

An invoice said what the treatment cost and nothing else. A patient who has paid
two of three instalments was handed a document showing the full amount with no
sign of what they had already given the clinic — and the front desk had to
explain the difference by hand, every time.

This is the same three lines the per-payment receipt already shows: what the
bill came to, what has been paid so far, and what is still due. Kept in one
place rather than written into each layout, so the bill and the receipt cannot
disagree about how much is owed.

Prints nothing on a bill with no payments against it. That document is already
correct: the total IS the amount due, and adding "Paid 0.00 / Due 4,500.00"
under it only tells the patient something the line above already said.

WeasyPrint-safe HTML only — tables, no flex gap, no grid, no JS.
"""


def payment_summary(invoice):
    """(paid, due, count) for one invoice, or None when nothing has been paid.

    Derived from the instalment rows rather than read off a column, because that
    is what every other reader of this data does: `Invoice.status` and the app's
    own figures come from the same sum, and a second source of truth for "how
    much has this patient paid" is how a bill and a receipt start disagreeing.
    """
    payments = list(getattr(invoice, 'payments', None) or [])
    if not payments:
        return None
    paid = sum(float(getattr(p, 'amount', 0) or 0) for p in payments)
    if paid <= 0:
        return None
    total = float(getattr(invoice, 'total', 0) or 0)
    return paid, max(total - paid, 0.0), len(payments)


def render_payment_block(invoice, currency='₹', accent='#6B7280', settled_accent='#047857'):
    """HTML for the paid / due summary, or '' when nothing has been paid."""
    summary = payment_summary(invoice)
    if not summary:
        return ''
    paid, due, count = summary
    total = float(getattr(invoice, 'total', 0) or 0)
    settled = due <= 0.005  # half a paisa: floating point, not a real balance

    # The dates, so "paid" is answerable rather than merely asserted. Only the
    # instalments themselves — one line each, oldest first, the order somebody
    # reads a statement in.
    rows = ''
    for p in sorted(
        (getattr(invoice, 'payments', None) or []),
        key=lambda x: (getattr(x, 'paid_on', None) or getattr(x, 'created_at', None) or 0),
    ):
        amount = float(getattr(p, 'amount', 0) or 0)
        if amount <= 0:
            continue
        when = getattr(p, 'paid_on', None) or getattr(p, 'created_at', None)
        when_text = when.strftime('%d %b %Y') if when else ''
        method = str(getattr(p, 'method', '') or '')
        rows += (
            f'<tr>'
            f'<td style="padding:2px 8px 2px 0; color:#6B7280; white-space:nowrap;">{when_text}</td>'
            f'<td style="padding:2px 8px 2px 0; color:#6B7280;">{method}</td>'
            f'<td style="padding:2px 0; text-align:right; white-space:nowrap;">'
            f'{currency} {amount:,.2f}</td>'
            f'</tr>'
        )

    edge = settled_accent if settled else accent
    heading = (
        'Paid in full' if settled
        else f'Part paid — {count} payment{"s" if count != 1 else ""} received'
    )
    due_line = (
        f'<tr><td style="padding:3px 8px 0 0; font-weight:700;">Balance due</td>'
        f'<td></td>'
        f'<td style="padding:3px 0 0; text-align:right; font-weight:700; '
        f'color:{"#047857" if settled else "#B91C1C"}; white-space:nowrap;">'
        f'{currency} {due:,.2f}</td></tr>'
    )

    return (
        f'<div style="margin-top:10px; padding:8px 10px; border:1px solid #E5E7EB; '
        f'border-left:3px solid {edge}; border-radius:4px; font-size:10px;">'
        f'<p style="margin:0 0 4px; font-weight:700; color:#374151;">{heading}</p>'
        f'<table style="width:100%; border-collapse:collapse;">'
        f'{rows}'
        f'<tr><td style="padding:3px 8px 0 0; border-top:1px solid #E5E7EB;">Invoice total</td>'
        f'<td style="border-top:1px solid #E5E7EB;"></td>'
        f'<td style="padding:3px 0 0; text-align:right; border-top:1px solid #E5E7EB; '
        f'white-space:nowrap;">{currency} {total:,.2f}</td></tr>'
        f'<tr><td style="padding:1px 8px 0 0;">Paid to date</td><td></td>'
        f'<td style="padding:1px 0 0; text-align:right; white-space:nowrap;">'
        f'{currency} {paid:,.2f}</td></tr>'
        f'{due_line}'
        f'</table>'
        f'</div>'
    )
