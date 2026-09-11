"""Receipt counterparts for the Banded, Bold, Corporate and Mono invoices.

One renderer, four styles, rather than four modules that are ninety percent the
same file. `classic.py` and `modern.py` predate this and are each a full
bespoke layout; they stay as they are because golden tests pin their output.

A receipt carries far less than an invoice — an amount, what it leaves
outstanding, and which invoice it was against — so what actually distinguishes
these four is the treatment of the header and the ruling of one small table.
That is a style token, not four documents.

The pairing matters more than the styling. A clinic never picks a receipt
design: it inherits the invoice's `template_id`, so a patient who gets a Banded
invoice and a Classic receipt has been handed two documents that look like they
came from different practices. `test_every_invoice_variant_has_a_receipt_counterpart`
exists to catch exactly that, and caught it when these four were added.

WeasyPrint-safe CSS only.
"""
import datetime

from domains.infrastructure.services.pdf_safety import (
    safe_color, safe_signature_data_uri, safe_text,
)
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri
from domains.infrastructure.services.pdf_fields import (
    apply_letterhead, page_css, resolve_field_visibility, resolve_letterhead,
)
from domains.finance.invoice_templates.classic import _amount_in_words

# How each style dresses the same document. `mono` pins the accent to black on
# purpose — its invoice ignores the clinic's colour so it survives a photocopier,
# and a matching receipt in brand colour would defeat that.
STYLES = {
    'banded':    {'header': 'band',  'default': '#3D8EA8', 'ruled': False, 'force_black': False},
    'bold':      {'header': 'rule',  'default': '#1F3864', 'ruled': False, 'force_black': False},
    'corporate': {'header': 'bars',  'default': '#44546A', 'ruled': False, 'force_black': False},
    'mono':      {'header': 'plain', 'default': '#000000', 'ruled': True,  'force_black': True},
    # The counterpart to the Plain invoice. `none` draws no clinic block at all,
    # because the sheet it prints on already carries one.
    'plain':     {'header': 'none',  'default': '#111827', 'ruled': False, 'force_black': False},
}


def render_for(style_id: str):
    """Build the `render_receipt(invoice, payment, clinic, config)` for one style."""
    def _render(invoice, payment, clinic, config=None) -> str:
        return _render_receipt(invoice, payment, clinic, config, STYLES[style_id])
    _render.__name__ = f'render_receipt_{style_id}'
    _render.__doc__ = f'Payment receipt in the {style_id} style, matching that invoice layout.'
    return _render


def _render_receipt(invoice, payment, clinic, config, style) -> str:
    accent = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default=style['default'],
    )
    if style['force_black']:
        accent = '#000000'

    vis = resolve_field_visibility(config)

    # A receipt inherits the invoice's template and its settings, so it inherits
    # letterhead mode too: a clinic printing bills on headed paper prints the
    # receipt for that bill on the same stationery.
    letterhead = resolve_letterhead(config)
    vis = apply_letterhead(vis, letterhead)

    footer_text = safe_text(
        (config.footer_text if config and config.footer_text else '') if config else ''
    ) if vis.footer else ''

    logo_data = resolve_logo_data_uri(
        (config.logo_url if config else None), getattr(clinic, 'logo_url', None),
    )

    c_name = safe_text((clinic.name if clinic else 'Dental Clinic') if vis.clinic_name else '')
    c_addr = safe_text(clinic.address if clinic and clinic.address and vis.address else '')
    c_phone = safe_text(clinic.phone if clinic and clinic.phone and vis.contact else '')
    c_email = safe_text(clinic.email if clinic and clinic.email and vis.contact else '')
    c_gst = safe_text((getattr(clinic, 'gst_number', '') if clinic else '') if vis.tax_number else '')
    c_doctor = safe_text(getattr(clinic, 'doctor_name', '') if clinic else '')

    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    is_india = (getattr(clinic, 'country', None) or 'IN') == 'IN'
    tax_label = 'GSTIN' if is_india else (getattr(clinic, 'tax_label', None) or 'Tax No.')

    pat = getattr(invoice, 'patient', None)
    p_name = safe_text(pat.name if pat else '')
    p_phone = safe_text(pat.phone if pat else '')
    p_uhid = safe_text(getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else ''))

    invoice_total = float(getattr(invoice, 'total', 0) or 0)
    invoice_number = safe_text(getattr(invoice, 'invoice_number', '') or '')
    amount = float(getattr(payment, 'amount', 0) or 0)

    # Frozen on the row when the receipt was issued. Legacy rows pre-date those
    # columns, so the live figures stand in — a receipt that renders nothing is
    # worse than one that recomputes.
    paid_to_date = getattr(payment, 'receipt_paid_to_date', None)
    balance_due = getattr(payment, 'receipt_balance_due', None)
    if paid_to_date is None:
        paid_to_date = amount
    if balance_due is None:
        balance_due = max(invoice_total - float(paid_to_date), 0.0)
    paid_to_date = float(paid_to_date)
    balance_due = float(balance_due)

    receipt_number = safe_text(getattr(payment, 'receipt_number', '') or '')
    mode = safe_text(getattr(payment, 'method', None) or getattr(payment, 'mode', None)
                     or getattr(invoice, 'payment_mode', '') or 'Cash')
    ref = safe_text(getattr(payment, 'reference', '') or getattr(payment, 'utr', '') or '')
    when = (payment.created_at.date() if getattr(payment, 'created_at', None)
            else datetime.date.today())
    date_str = when.strftime('%d %b %Y')

    settled = balance_due <= 0.005
    status_chip = (
        f'<span class="chip paid">Paid in full</span>' if settled
        else f'<span class="chip due">Balance {currency} {balance_due:,.2f}</span>'
    )
    words = _amount_in_words(amount) if is_india else ''

    if not vis.logo:
        logo_html = ''
    elif logo_data:
        logo_html = f'<img src="{logo_data}" alt="" style="width:46px;height:46px;object-fit:contain;">'
    else:
        initials = (safe_text(clinic.name if clinic else '') or 'DC')[:2].upper()
        on_band = style['header'] == 'band'
        logo_html = (
            f'<div style="width:46px;height:46px;background:{"#fff" if on_band else accent};'
            f'color:{accent if on_band else "#fff"};text-align:center;line-height:46px;'
            f'font-weight:700;font-size:15px;border-radius:4px;">{initials}</div>'
        )

    signature = ''
    if vis.signature:
        sig_uri = safe_signature_data_uri(getattr(payment, 'signature_url', None))
        img = (f'<img src="{sig_uri}" alt="" style="display:block;max-width:140px;max-height:44px;'
               f'margin-left:auto;margin-bottom:2px;object-fit:contain;">') if sig_uri else ''
        signature = (
            f'<div style="text-align:right;">{img}'
            f'<div style="border-top:1px solid #9aa3ad;padding-top:4px;min-width:150px;'
            f'display:inline-block;font-size:10px;color:#6B7280;">'
            f'{c_doctor or "Authorised Signatory"}</div></div>'
        )

    clinic_lines = ''.join(f'<div>{x}</div>' for x in [
        c_addr, c_phone, c_email, (f'{tax_label}: {c_gst}' if c_gst else '')] if x)

    # ── The one part that really differs between the four ────────────────────
    header = style['header']
    if header == 'band':
        head_html = f'''
<div class="band">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td><div class="word">RECEIPT</div><div class="sub">{c_name}</div></td>
    <td style="width:56px;text-align:right;">{logo_html}</td>
  </tr></table>
</div>
<div class="pad">'''
    elif header == 'rule':
        head_html = f'''
<div class="leftrule"></div>
<div class="pad">
  <table style="width:100%;border-collapse:collapse;margin-bottom:22px;"><tr>
    <td><div class="word big">Receipt</div><div class="sub dark">{c_name}</div></td>
    <td style="width:56px;text-align:right;">{logo_html}</td>
  </tr></table>'''
    elif header == 'bars':
        head_html = f'''
<div class="pad">
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><tr>
    <td style="width:56px;">{logo_html}</td>
    <td style="padding-left:12px;"><div class="clinic">{c_name}</div>
      <div class="addr">{clinic_lines}</div></td>
    <td style="text-align:right;"><div class="word">RECEIPT</div></td>
  </tr></table>
  <div class="bar">Received With Thanks</div>'''
    elif header == 'none':
        # Nothing but the word, so the clinic's own printed header is the only
        # identity on the page.
        head_html = f'''
<div class="pad">
  <div class="word" style="margin-bottom:20px;">RECEIPT</div>'''
    else:  # plain
        head_html = f'''
<div class="pad">
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><tr>
    <td><div class="clinic">{c_name}</div><div class="addr">{clinic_lines}</div></td>
    <td style="width:56px;text-align:right;">{logo_html}</td>
    <td style="width:110px;text-align:right;"><div class="word">RECEIPT</div></td>
  </tr></table>'''

    # On pre-printed stationery the decorated headers have to go the same way
    # the invoice's did: a colour band over a printed letterhead is the exact
    # collision this feature exists to stop.
    if letterhead.enabled:
        head_html = f'''
<div class="pad">
  <div class="word" style="margin-bottom:20px;">RECEIPT</div>'''

    # `.pad` supplies the inset when the page bleeds; under letterhead mode the
    # measured margins do that instead, so the padding would stack on top.
    page_rule = page_css(letterhead, default_margin='0')
    pad_reset = '.pad { padding: 0; }' if letterhead.enabled else ''

    show_clinic_lines_below = header in ('band', 'rule') and not letterhead.enabled
    ruled = style['ruled']

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
{page_rule}
body {{ font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; margin:0; padding:0;
        color:#243746; font-size:11.5px; line-height:1.45; background:#fff; }}
.pad {{ padding:30px 44px 40px 44px; }}
{pad_reset}
.band {{ background:{accent}; color:#fff; padding:24px 44px; }}
.band .word {{ font-size:34px; font-weight:300; letter-spacing:1px; line-height:1; color:#fff; }}
.band .sub {{ font-size:11px; opacity:.85; margin-top:5px; }}
.leftrule {{ position:fixed; left:0; top:0; bottom:0; width:12px; background:{accent}; }}
.word {{ font-size:22px; font-weight:800; color:{accent}; text-transform:uppercase; letter-spacing:.5px; }}
.word.big {{ font-size:42px; letter-spacing:-1px; }}
.sub.dark {{ font-size:11px; color:#6b7a89; margin-top:4px; }}
.clinic {{ font-size:17px; font-weight:700; color:{accent}; }}
.addr {{ font-size:9.5px; color:#5d6d7c; margin-top:4px; }}
.bar {{ background:{accent}; color:#fff; font-size:10px; font-weight:700; letter-spacing:1px;
        padding:4px 9px; text-transform:uppercase; width:46%; }}
.meta {{ width:100%; border-collapse:collapse; margin:18px 0 20px 0; }}
.meta td {{ vertical-align:top; width:25%; padding:0 14px 0 0; font-size:10.5px; color:#5d6d7c; }}
.meta .k {{ font-size:9px; letter-spacing:1px; text-transform:uppercase; color:#8a99a8; margin-bottom:3px; }}
.meta .v {{ font-weight:700; color:#243746; font-size:11.5px; }}
.amountbox {{ border-top:2px solid {accent}; border-bottom:2px solid {accent};
              padding:14px 0; margin:6px 0 18px 0; }}
.amountbox .k {{ font-size:9px; letter-spacing:1.2px; text-transform:uppercase; color:#8a99a8; }}
.amountbox .v {{ font-size:28px; font-weight:700; color:{accent}; line-height:1.15; }}
.amountbox .w {{ font-size:10px; color:#5d6d7c; font-style:italic; margin-top:3px; }}
table.fig {{ width:62%; border-collapse:collapse; {'border:1px solid #999;' if ruled else ''} }}
table.fig td {{ padding:{'7px 9px' if ruled else '6px 0'}; font-size:11.5px;
  {'border:1px solid #ccc;' if ruled else 'border-bottom:1px solid #eef1f4;'} }}
table.fig td.v {{ text-align:right; font-weight:700; white-space:nowrap; }}
table.fig tr.total td {{ {'background:#f2f2f2;' if ruled else ''} color:{accent}; font-size:13px; font-weight:800; }}
.chip {{ display:inline-block; padding:3px 10px; border-radius:11px; font-size:10px; font-weight:700; }}
.chip.paid {{ background:{'#f2f2f2' if style['force_black'] else '#e7f6ee'};
              color:{'#000' if style['force_black'] else '#0f7b52'};
              {'border:1px solid #999;' if style['force_black'] else ''} }}
.chip.due  {{ background:{'#f2f2f2' if style['force_black'] else '#fdf1e3'};
              color:{'#000' if style['force_black'] else '#a35a12'};
              {'border:1px solid #999;' if style['force_black'] else ''} }}
.note {{ margin-top:22px; font-size:10px; color:#6b7a89; }}
.foot {{ width:100%; border-collapse:collapse; margin-top:34px; }}
.foot td {{ vertical-align:bottom; font-size:10px; color:#8a99a8; }}
.clinic-footer {{ text-align:center; color:#9aa7b3; font-size:9.5px; margin-top:16px;
  border-top:1px solid #eef1f4; padding-top:10px; }}
</style></head><body>

{head_html}

  {f'<div class="addr" style="margin-bottom:6px;">{clinic_lines}</div>' if show_clinic_lines_below else ''}

  <table class="meta"><tr>
    <td><div class="k">Receipt No</div><div class="v">{receipt_number or '—'}</div></td>
    <td><div class="k">Date</div><div class="v">{date_str}</div></td>
    <td><div class="k">Against Invoice</div><div class="v">{invoice_number or '—'}</div></td>
    <td><div class="k">Mode</div><div class="v">{mode}{f' · {ref}' if ref else ''}</div></td>
  </tr><tr>
    <td style="padding-top:12px;"><div class="k">Received From</div><div class="v">{p_name or '—'}</div></td>
    <td style="padding-top:12px;"><div class="k">Patient ID</div><div class="v">{p_uhid or '—'}</div></td>
    <td style="padding-top:12px;"><div class="k">Contact</div><div class="v">{p_phone or '—'}</div></td>
    <td style="padding-top:12px;"><div class="k">Status</div><div>{status_chip}</div></td>
  </tr></table>

  <div class="amountbox">
    <div class="k">Amount Received</div>
    <div class="v">{currency} {amount:,.2f}</div>
    {f'<div class="w">{words}</div>' if words else ''}
  </div>

  <table class="fig">
    <tr><td>Invoice total</td><td class="v">{currency} {invoice_total:,.2f}</td></tr>
    <tr><td>Paid to date</td><td class="v">{currency} {paid_to_date:,.2f}</td></tr>
    <tr class="total"><td>Balance due</td><td class="v">{currency} {balance_due:,.2f}</td></tr>
  </table>

  <div class="note">
    This receipt acknowledges the amount shown above against invoice {invoice_number or '—'}.
    {'No further amount is outstanding on this invoice.' if settled else 'The balance shown remains outstanding.'}
  </div>

  <table class="foot"><tr>
    <td>{c_name}{f' · {c_phone}' if c_phone else ''}</td>
    <td style="text-align:right;">{signature}</td>
  </tr></table>

  {f'<div class="clinic-footer">{footer_text}</div>' if footer_text else ''}
</div>

</body></html>"""
