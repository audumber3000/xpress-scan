"""Shared renderer for the post-issue discount breakdown on invoice PDFs.

A discount granted after the bill was issued needs to be visible on the bill
itself, not just in the app: the patient is holding a document whose total no
longer matches what they were originally quoted, and the reason and date are
what make that reconcile. The summary "Discount" line already carries the
combined figure — this block itemises the part that came later.

WeasyPrint-safe HTML only (tables, no flex gap / grid / JS), matching the
constraints both templates render under.
"""
from domains.infrastructure.services.pdf_safety import safe_text


def render_discount_block(invoice, currency='₹', accent='#6B7280'):
    """HTML for the post-issue discounts, or '' when there are none."""
    discounts = list(getattr(invoice, 'post_issue_discounts', None) or [])
    if not discounts:
        return ''

    discounts.sort(key=lambda d: (d.applied_at or 0))

    rows = ''
    for d in discounts:
        when = d.applied_at.strftime('%d %b %Y') if d.applied_at else ''
        by = safe_text(getattr(d.user, 'name', '') or '') if getattr(d, 'user', None) else ''
        detail = safe_text(d.reason or '')
        if d.discount_type == 'percentage':
            detail = f'{float(d.value or 0):g}% — {detail}'
        rows += (
            f'<tr>'
            f'<td style="padding:3px 8px 3px 0; color:#6B7280; white-space:nowrap;">{when}</td>'
            f'<td style="padding:3px 8px 3px 0;">{detail}{(" (" + by + ")") if by else ""}</td>'
            f'<td style="padding:3px 0; text-align:right; white-space:nowrap;">'
            f'– {currency} {float(d.amount or 0):,.2f}</td>'
            f'</tr>'
        )

    return (
        f'<div style="margin-top:10px; padding:8px 10px; border:1px solid #E5E7EB; '
        f'border-left:3px solid {accent}; border-radius:4px; font-size:10px;">'
        f'<p style="margin:0 0 4px; font-weight:700; color:#374151;">'
        f'Discount applied after this invoice was issued</p>'
        f'<table style="width:100%; border-collapse:collapse;">{rows}</table>'
        f'</div>'
    )
