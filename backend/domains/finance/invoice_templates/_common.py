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
from domains.infrastructure.services.pdf_fields import (
    apply_letterhead, document_doctor_lines, resolve_field_visibility,
    resolve_letterhead,
)


def prepare(invoice, clinic, config=None, default_color: str = '#111827') -> SimpleNamespace:
    """Resolve one invoice into the values every layout needs."""
    primary = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default=default_color,
    )
    # Flags default to shown and can only hide — see pdf_fields.
    vis = resolve_field_visibility(config)

    # Printing onto the clinic's own headed paper. When it is on, our copy of
    # the branding comes off — the sheet already carries it — and the renderer
    # reserves the four margins the letterhead prints in. Off unless configured,
    # so an untouched clinic renders exactly as before.
    letterhead = resolve_letterhead(config)
    vis = apply_letterhead(vis, letterhead)

    footer_text = safe_text(
        (config.footer_text if config and config.footer_text else '') if config else ''
    ) if vis.footer else ''

    # Inline bytes, not a URL: the stored config link is a presigned R2 URL that
    # expires, and WeasyPrint fetching an expired link renders a broken image.
    logo_data = resolve_logo_data_uri(
        (config.logo_url if config else None),
        getattr(clinic, 'logo_url', None),
    ) if vis.logo else ''

    c = SimpleNamespace(
        name=safe_text((clinic.name if clinic else 'Dental Clinic') if vis.clinic_name else ''),
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
        phone=safe_text(pat.phone if pat and vis.patient_contact else ''),
        age=safe_text(str(getattr(pat, 'age', '') or '') if pat and vis.patient_age_gender else ''),
        gender=safe_text((getattr(pat, 'gender', '') or getattr(pat, 'sex', '') or '')
                         if pat and vis.patient_age_gender else ''),
        uhid=safe_text(getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else '')),
        address=safe_text((getattr(pat, 'village', '') or getattr(pat, 'address', '') or '')
                          if pat and vis.patient_contact else ''),
    )

    # The prescribing doctor and their signature come off the appointment when
    # there is one, falling back to the clinic's own doctor.
    doctor_name = c.doctor
    doctor_signature = ''
    # Letters after the name, travelling with whichever doctor was resolved: the
    # clinic owner's MDS must not end up printed under a visiting associate.
    doctor_qualifications = safe_text(getattr(clinic, 'doctor_qualifications', '') or '')
    try:
        appt = getattr(invoice, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)
            if doc:
                doctor_name = safe_text(getattr(doc, 'name', '') or doctor_name)
                doctor_signature = safe_signature_data_uri(getattr(doc, 'signature_url', None))
                doctor_qualifications = safe_text(getattr(doc, 'qualifications', '') or '')
    except Exception:
        # A malformed relationship must not cost the clinic its invoice.
        pass

    # Hidden last, so the lookup above still runs and the signature flag keeps
    # behaving independently of the name.
    if not vis.doctor_name:
        doctor_name = ''
    # Hiding the name hides the letters with it: "BDS, MDS" floating under no
    # name at all is not a thing anybody asked for.
    if not vis.doctor_qualifications or not doctor_name:
        doctor_qualifications = ''

    created_at = getattr(invoice, 'created_at', None)
    subtotal = float(getattr(invoice, 'subtotal', 0) or 0)
    discount = float(getattr(invoice, 'discount_amount', 0) or 0)
    tax = float(getattr(invoice, 'tax', 0) or 0)

    return SimpleNamespace(
        primary=primary, vis=vis, letterhead=letterhead,
        # The name before the flag hid it. Only the monogram fallback uses this:
        # a clinic that hides its name but keeps its logo should still get its
        # own initials rather than a generic "DC".
        raw_clinic_name=safe_text(clinic.name if clinic else ''),
        footer_text=footer_text, logo_data=logo_data,
        clinic=c, patient=p, currency=currency, is_india=is_india,
        tax_reg_label=tax_reg_label,
        doctor_name=doctor_name, doctor_signature=doctor_signature,
        doctor_qualifications=doctor_qualifications,
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
    # Hidden means nothing drawn. The initials are a *substitute* mark for a
    # clinic that has no logo — offering them to a clinic that asked for no logo
    # answers a different question, and on pre-printed paper it prints a second
    # monogram next to the real one.
    if not d.vis.logo:
        return ''
    if d.logo_data:
        return (f'<img src="{d.logo_data}" alt="" '
                f'style="width:{size}px;height:{size}px;object-fit:contain;">')
    initials = (d.raw_clinic_name or 'DC')[:2].upper()
    bg = '#ffffff' if on_dark else d.primary
    fg = d.primary if on_dark else '#ffffff'
    return (
        f'<div style="width:{size}px;height:{size}px;background:{bg};color:{fg};'
        f'border-radius:{radius};text-align:center;line-height:{size}px;'
        f'font-weight:700;font-size:{max(12, size // 3)}px;letter-spacing:.5px;">{initials}</div>'
    )



def qualifications_line(quals: str, size: str = '9.5px', color: str = '#6B7280') -> str:
    """The letters under a doctor's name, or nothing.

    Small and bold on the line below the name, which is how a printed
    prescription pad sets them and what a clinic recognises as correct. One
    helper so the four places a doctor's name appears cannot each pick their own
    size — the signature block and the header used to, and the result looked
    like two different documents stapled together.
    """
    if not quals:
        return ''
    return (f'<div style="font-size:{size};font-weight:700;color:{color};'
            f'letter-spacing:.2px;margin-top:1px;">{quals}</div>')


def header_doctor_html(clinic, vis, name: str, quals: str, wrap) -> str:
    """The doctors named in the document header, rendered this layout's way.

    A clinic that has listed its doctors in Control Center gets all of them; one
    that has not gets the single doctor the caller already resolved, which is
    every clinic today. `wrap(name, quals_html)` is the layout's own markup for
    one entry, so this decides WHO is named and the variant decides how.

    Header only. The signature block still names whoever actually treated the
    patient — a letterhead listing five partners does not mean five people
    signed the bill.
    """
    return ''.join(
        wrap(d.name, qualifications_line(d.qualifications))
        for d in document_doctor_lines(clinic, vis, name, quals)
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


def signature_block(d, align: str = 'right', with_qualifications: bool = True) -> str:
    """The authorised signature, when the clinic has not hidden it.

    `with_qualifications` exists for layouts that already name the doctor
    elsewhere on the page. The letters belong once, on the line that identifies
    them; repeating them above the signature of the same person is noise.
    """
    if not d.vis.signature:
        return ''
    img = (f'<img src="{d.doctor_signature}" alt="" style="display:block;max-width:150px;'
           f'max-height:50px;margin-{"left" if align == "right" else "right"}:auto;'
           f'margin-bottom:2px;object-fit:contain;">') if d.doctor_signature else ''
    quals = (qualifications_line(getattr(d, 'doctor_qualifications', ''), size='9px')
             if with_qualifications else '')
    return (
        f'<div style="text-align:{align};">{img}'
        f'<div style="border-top:1px solid #9aa3ad;padding-top:4px;min-width:150px;'
        f'display:inline-block;font-size:10px;color:#6B7280;">'
        f'{d.doctor_name or "Authorised Signatory"}{quals}</div></div>'
    )


# ── The link-to-invoice QR code ─────────────────────────────────────────────
#
# One helper that every variant calls on its last line, including classic and
# modern, which otherwise keep their own copies of everything. It has to live
# in one place: seven hand-placed QR codes would drift into seven sizes, and a
# code printed too small is a code that does not scan.

# Big enough to scan from a printed page at arm's length, small enough to sit
# beside a one-line footer without making the bill feel like a boarding pass.
_QR_SIZE = '19mm'


def invoice_qr_html(invoice, config) -> str:
    """The QR block, or '' when there is nothing to draw.

    Nothing is drawn unless the clinic has switched it on AND this invoice
    already has a token. The second condition is what guarantees a printed code
    never scans to a 404: tokens are minted and committed by the route before
    rendering, so a render that somehow runs without one prints no code rather
    than a dead one.
    """
    # Imported here, not at module top: pdf_fields and invoice_link are only
    # needed when a clinic has opted in, and keeping the import local means the
    # pinned golden-test renders load exactly what they always loaded.
    from domains.infrastructure.services.pdf_fields import resolve_qr_enabled
    if not resolve_qr_enabled(config):
        return ''
    token = getattr(invoice, 'public_token', None)
    if not token:
        return ''
    from domains.finance.invoice_link import public_invoice_url, qr_data_uri
    src = qr_data_uri(public_invoice_url(token))
    return (
        '<table class="mp-qr" style="border-collapse:collapse;">'
        '<tr>'
        f'<td style="padding:0;vertical-align:middle;">'
        f'<img src="{src}" alt="" style="width:{_QR_SIZE};height:{_QR_SIZE};display:block;"></td>'
        '<td style="padding:0 0 0 8px;vertical-align:middle;">'
        '<div style="font-size:8.5px;font-weight:700;color:#111827;line-height:1.3;">'
        'Scan to view this invoice</div>'
        '<div style="font-size:7.5px;color:#6B7280;line-height:1.35;margin-top:1px;">'
        'Opens on your phone.<br>No app or login needed.</div>'
        '</td></tr></table>'
    )


def footer_with_qr(footer_html: str, qr_html: str) -> str:
    """Seat the QR code at the bottom left, beside the footer line.

    Returns `footer_html` untouched when there is no QR. Not "equivalent" —
    untouched, the same string object: every clinic that has not opted in must
    get a byte-identical document, and the golden tests assert exactly that.

    With a QR, the last row of the bill becomes a two-cell table: the code and
    its caption on the left, the clinic's own footer line on the right in
    whatever style its layout gives it. A table rather than flex because
    WeasyPrint's table layout is the part of it that has never surprised
    anyone.

    The footer line keeps its own markup. What is neutralised is only the
    vertical spacing it brought for standing alone at the foot of the page —
    its top margin, padding and rule — which inside this row would push it
    below the code instead of level with it.
    """
    if not qr_html:
        return footer_html
    return (
        '<style>'
        '.mp-qr-row .mp-qr-foot > *{margin-top:0!important;padding-top:0!important;'
        'border-top:0!important;}'
        '</style>'
        '<table class="mp-qr-row" style="width:100%;border-collapse:collapse;'
        'margin-top:14px;page-break-inside:avoid;">'
        '<tr>'
        f'<td style="padding:0;vertical-align:bottom;width:1%;white-space:nowrap;">{qr_html}</td>'
        f'<td class="mp-qr-foot" style="padding:0 0 0 16px;vertical-align:middle;">{footer_html}</td>'
        '</tr></table>'
    )
