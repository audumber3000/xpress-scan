"""Everything an invoice variant needs, prepared once.

`classic.py` and `modern.py` each carry their own copy of this preparation —
roughly ninety lines of branding resolution, locale, patient fields, doctor
lookup and totals, identical in both but drifted in small ways. A third copy per
new layout would guarantee that a fix to the currency symbol or the doctor's
signature lands in some templates and not others.

Those two are deliberately left alone: they are pinned by golden tests, and
rewriting a rendered document to remove duplication is how you discover the
duplication was not quite duplication. New variants build on this instead, and
the older two can be migrated when someone next has reason to touch them.

Everything here is already sanitised — a variant interpolates these values
straight into markup without escaping them again.
"""
import datetime
from types import SimpleNamespace

from domains.infrastructure.services.pdf_safety import (
    safe_color, safe_signature_data_uri, safe_text,
)
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri
from domains.infrastructure.services.pdf_fields import resolve_field_visibility


def prepare(invoice, clinic, config=None, default_color: str = '#111827') -> SimpleNamespace:
    """Resolve one invoice into the values every layout needs."""
    primary = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default=default_color,
    )
    # Flags default to shown and can only hide — see pdf_fields.
    vis = resolve_field_visibility(config)

    footer_text = safe_text(
        (config.footer_text if config and config.footer_text else '') if config else ''
    ) if vis.footer else ''

    # Inline bytes, not a URL: the stored config link is a presigned R2 URL that
    # expires, and WeasyPrint fetching an expired link renders a broken image.
    logo_data = resolve_logo_data_uri(
        (config.logo_url if config else None),
        getattr(clinic, 'logo_url', None),
    )

    c = SimpleNamespace(
        name=safe_text(clinic.name if clinic else 'Dental Clinic'),
        phone=safe_text(clinic.phone if clinic and clinic.phone and vis.contact else ''),
        email=safe_text(clinic.email if clinic and clinic.email and vis.contact else ''),
        address=safe_text(clinic.address if clinic and clinic.address and vis.address else ''),
        gst=safe_text((getattr(clinic, 'gst_number', '') if clinic else '') if vis.tax_number else ''),
        tagline=safe_text((getattr(clinic, 'tagline', '') or '' if clinic else '') if vis.tagline else ''),
        reg=safe_text((getattr(clinic, 'license_number', '') or '' if clinic else '') if vis.license_number else ''),
        doctor=safe_text(getattr(clinic, 'doctor_name', '') if clinic else ''),
    )

    # Locale. A clinic outside India must never be shown CGST/SGST or a rupee.
    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    is_india = (getattr(clinic, 'country', None) or 'IN') == 'IN'
    tax_reg_label = 'GSTIN' if is_india else (getattr(clinic, 'tax_label', None) or 'Tax No.')

    pat = getattr(invoice, 'patient', None)
    p = SimpleNamespace(
        name=safe_text(pat.name if pat else ''),
        phone=safe_text(pat.phone if pat else ''),
        age=safe_text(str(getattr(pat, 'age', '') or '') if pat else ''),
        gender=safe_text((getattr(pat, 'gender', '') or getattr(pat, 'sex', '') or '') if pat else ''),
        uhid=safe_text(getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else '')),
        address=safe_text(getattr(pat, 'village', '') or getattr(pat, 'address', '') or '' if pat else ''),
    )

    # The prescribing doctor and their signature come off the appointment when
    # there is one, falling back to the clinic's own doctor.
    doctor_name = c.doctor
    doctor_signature = ''
    try:
        appt = getattr(invoice, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)
            if doc:
                doctor_name = safe_text(getattr(doc, 'name', '') or doctor_name)
                doctor_signature = safe_signature_data_uri(getattr(doc, 'signature_url', None))
    except Exception:
        # A malformed relationship must not cost the clinic its invoice.
        pass

    created_at = getattr(invoice, 'created_at', None)
    subtotal = float(getattr(invoice, 'subtotal', 0) or 0)
    discount = float(getattr(invoice, 'discount_amount', 0) or 0)
    tax = float(getattr(invoice, 'tax', 0) or 0)

    return SimpleNamespace(
        primary=primary, vis=vis, footer_text=footer_text, logo_data=logo_data,
        clinic=c, patient=p, currency=currency, is_india=is_india,
        tax_reg_label=tax_reg_label,
        doctor_name=doctor_name, doctor_signature=doctor_signature,
        number=safe_text(getattr(invoice, 'invoice_number', '') or ''),
        date=(created_at.strftime('%d %b %Y') if created_at
              else datetime.date.today().strftime('%d %b %Y')),
        payment_mode=safe_text(getattr(invoice, 'payment_mode', '') or 'Pending'),
        notes=safe_text(getattr(invoice, 'notes', '') or ''),
        status=safe_text(getattr(invoice, 'status', '') or ''),
        subtotal=subtotal, discount=discount, tax=tax,
        taxable=subtotal - discount,
        total=float(getattr(invoice, 'total', 0) or 0),
        items=list(getattr(invoice, 'line_items', []) or []),
    )


def money(d, amount) -> str:
    """One place decides how a figure is written, so two columns of the same
    document cannot disagree about the thousands separator."""
    return f'{d.currency} {float(amount):,.2f}'


def logo_block(d, size: int = 56, radius: str = '6px', on_dark: bool = False) -> str:
    """The clinic's mark, or its initials when it has no logo.

    A clinic without a logo is the common case, so the fallback is a designed
    element rather than an empty box — and on a coloured band it inverts, since
    an accent-on-accent monogram is invisible.
    """
    if d.logo_data:
        return (f'<img src="{d.logo_data}" alt="" '
                f'style="width:{size}px;height:{size}px;object-fit:contain;">')
    initials = (d.clinic.name or 'DC')[:2].upper()
    bg = '#ffffff' if on_dark else d.primary
    fg = d.primary if on_dark else '#ffffff'
    return (
        f'<div style="width:{size}px;height:{size}px;background:{bg};color:{fg};'
        f'border-radius:{radius};text-align:center;line-height:{size}px;'
        f'font-weight:700;font-size:{max(12, size // 3)}px;letter-spacing:.5px;">{initials}</div>'
    )


def tax_rows(d, label_cls: str = '', value_cls: str = '') -> str:
    """CGST/SGST in India, a single Tax line everywhere else.

    Split as a half each because that is what the rest of the app assumes for an
    intra-state supply, which every clinic invoice is.
    """
    if d.tax <= 0:
        return ''
    if d.is_india:
        half = d.tax / 2
        return (
            f'<tr><td class="{label_cls}">CGST 9%</td><td class="{value_cls}">{money(d, half)}</td></tr>'
            f'<tr><td class="{label_cls}">SGST 9%</td><td class="{value_cls}">{money(d, half)}</td></tr>'
        )
    return f'<tr><td class="{label_cls}">Tax</td><td class="{value_cls}">{money(d, d.tax)}</td></tr>'


def signature_block(d, align: str = 'right') -> str:
    """The authorised signature, when the clinic has not hidden it."""
    if not d.vis.signature:
        return ''
    img = (f'<img src="{d.doctor_signature}" alt="" style="display:block;max-width:150px;'
           f'max-height:50px;margin-{"left" if align == "right" else "right"}:auto;'
           f'margin-bottom:2px;object-fit:contain;">') if d.doctor_signature else ''
    return (
        f'<div style="text-align:{align};">{img}'
        f'<div style="border-top:1px solid #9aa3ad;padding-top:4px;min-width:150px;'
        f'display:inline-block;font-size:10px;color:#6B7280;">'
        f'{d.doctor_name or "Authorised Signatory"}</div></div>'
    )
