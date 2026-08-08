"""Modern Compact payment receipt — the counterpart to the Modern invoice.

Design intent matches `invoice_templates/modern.py`: thin top rule instead of an
accent band, single-line letterhead, big prominent number top-right, borderless
rows. A clinic on the Modern invoice gets this receipt, so the two documents in
a patient's hands look like they came from the same practice.

WeasyPrint-safe CSS only — no flexbox `gap`, no CSS grid, no JS, no `:has()`.
"""
import datetime

from domains.infrastructure.services.pdf_safety import (
    safe_color, safe_signature_data_uri, safe_text,
)
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri
from domains.infrastructure.services.pdf_fields import resolve_field_visibility
from domains.finance.invoice_templates.classic import _amount_in_words


def render_receipt(invoice, payment, clinic, config=None) -> str:
    """HTML for one installment's receipt.

    `payment` is an InvoicePayment whose receipt_number / receipt_paid_to_date /
    receipt_balance_due have already been assigned. Falls back to live figures
    for legacy rows that pre-date those columns.
    """
    primary_color = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default='#1a2a6c',
    )
    # Receipts follow the INVOICE category's settings — receipt_pdf_engine
    # looks up the invoice config — so a clinic that hides its GST on the bill
    # doesn't leak it on the receipt for the same payment.
    vis = resolve_field_visibility(config)

    footer_text = safe_text((config.footer_text if config and config.footer_text else '') if config else '') if vis.footer else ''

    # Inline bytes, not a URL — see pdf_branding.resolve_logo_data_uri.
    logo_url = resolve_logo_data_uri(
        (config.logo_url if config else None),
        getattr(clinic, 'logo_url', None),
    )
    if logo_url:
        logo_html = f'<img class="logo" src="{logo_url}" alt="Logo" style="width:52px;height:52px;object-fit:contain;">'
    else:
        initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = (
            f'<div class="logo" style="width:52px;height:52px;background:{primary_color};color:#fff;'
            f'display:flex;align-items:center;justify-content:center;'
            f'font-weight:700;font-size:15px;letter-spacing:0.5px;border-radius:6px;">{initials}</div>'
        )

    c_name    = safe_text(clinic.name    if clinic else 'Dental Clinic')
    c_phone   = safe_text(clinic.phone   if clinic and clinic.phone   and vis.contact else '')
    c_email   = safe_text(clinic.email   if clinic and clinic.email   and vis.contact else '')
    c_address = safe_text(clinic.address if clinic and clinic.address and vis.address else '')
    c_gst     = safe_text((getattr(clinic, 'gst_number',  '') if clinic else '') if vis.tax_number else '')
    c_doctor  = safe_text(getattr(clinic, 'doctor_name', '') if clinic else '')

    currency  = getattr(clinic, 'currency_symbol', None) or '₹'
    tax_label = getattr(clinic, 'tax_label', None) or 'GST No.'
    is_india  = (getattr(clinic, 'country', None) or 'IN') == 'IN'
    tax_reg_label = 'GSTIN' if is_india else tax_label

    pat     = getattr(invoice, 'patient', None)
    p_name  = safe_text(pat.name  if pat else '')
    p_phone = safe_text(pat.phone if pat else '')
    p_uhid  = safe_text(getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else ''))

    doctor_signature = ''
    try:
        appt = getattr(invoice, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)
            if doc:
                doctor_signature = safe_signature_data_uri(getattr(doc, 'signature_url', None))
    except Exception:
        pass

    # ── The three figures, frozen at the moment the money was taken ──────────
    amount   = float(getattr(payment, 'amount', 0) or 0)
    invoice_total = float(getattr(invoice, 'total', 0) or 0)
    paid_to_date = getattr(payment, 'receipt_paid_to_date', None)
    balance_due  = getattr(payment, 'receipt_balance_due', None)
    if paid_to_date is None:
        paid_to_date = amount
    if balance_due is None:
        balance_due = max(invoice_total - float(paid_to_date), 0.0)
    paid_to_date = float(paid_to_date)
    balance_due  = float(balance_due)

    receipt_number = safe_text(getattr(payment, 'receipt_number', '') or '')
    invoice_number = safe_text(getattr(invoice, 'invoice_number', '') or '')

    # The date on the document is the day the money changed hands, not the day
    # somebody typed it in — a back-dated entry still receipts its real date.
    on_date = getattr(payment, 'paid_on', None) or (
        payment.created_at.date() if getattr(payment, 'created_at', None) else datetime.date.today()
    )
    receipt_date = on_date.strftime('%d %b %Y')

    method = safe_text(getattr(payment, 'method', '') or 'Cash')
    note   = safe_text(getattr(payment, 'note', '') or '')

    # Joined from the surviving parts so hiding one can't strip a separator bare.
    who_line = ' · '.join(filter(None, [c_doctor, c_address]))
    contact_line = '  ·  '.join(filter(None, [f'Tel: {c_phone}' if c_phone else '', c_email]))

    aow = _amount_in_words(amount) if is_india else ''

    signature_box = (
        f'''<div class="sig">
      {f'<img src="{doctor_signature}" alt="Signature" style="display:block;max-width:150px;max-height:48px;margin-left:auto;margin-bottom:2px;object-fit:contain;">' if doctor_signature else ''}
      <span class="line">Authorised Signatory</span>
    </div>''' if vis.signature else ''
    )

    settled = balance_due <= 0.005
    status_chip = (
        f'<span class="chip paid">Invoice settled in full</span>' if settled
        else f'<span class="chip due">Balance {currency} {balance_due:,.2f}</span>'
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
@page {{ size: A4; margin: 2mm; }}
:root {{
  --accent: {primary_color};
  --ink: #111827;
  --muted: #6B7280;
  --line: #E5E7EB;
  --soft: #F9FAFB;
}}
* {{ box-sizing: border-box; }}
body {{
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--ink);
  background: #fff;
  margin: 0; padding: 0;
  font-size: 12px;
  line-height: 1.4;
}}
.page {{ width: 100%; padding: 34px 42px; }}

/* Letterhead */
.head {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--accent);
  padding-bottom: 16px;
}}
/* Explicit widths: without them WeasyPrint shrink-to-fits the brand column and
   the clinic name wraps mid-word next to a half-empty right column. */
.head .brand {{ display: flex; align-items: center; width: 63%; }}
.head .brand .logo {{ flex: none; }}
.head .brand .meta {{ margin-left: 12px; }}
.head .brand .name {{ font-size: 17px; font-weight: 700; color: var(--ink); }}
.head .brand .sub  {{ font-size: 10.5px; color: var(--muted); margin-top: 2px; }}
.head .doc {{ text-align: right; width: 33%; }}
.head .doc .label {{
  font-size: 11px; color: var(--muted); text-transform: uppercase;
  letter-spacing: 1.5px; font-weight: 600; margin-bottom: 4px;
}}
.head .doc .number {{ font-size: 20px; font-weight: 700; color: var(--accent); letter-spacing: 0.5px; }}
.head .doc .date {{ font-size: 11px; color: var(--muted); margin-top: 2px; }}

/* Received-from strip */
.strip {{ display: flex; justify-content: space-between; margin: 20px 0 18px; }}
.strip .col {{ width: 48%; }}
.strip .col h4 {{
  margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--muted); font-weight: 600;
}}
.strip .col p {{ margin: 1px 0; font-size: 11.5px; }}
.strip .col .tight {{ color: var(--muted); font-size: 10.5px; }}

/* The headline: what was actually received */
.received {{
  background: var(--soft);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  padding: 16px 18px;
  margin-bottom: 18px;
}}
.received .cap {{
  font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
  color: var(--muted); font-weight: 600;
}}
.received .amt {{
  font-size: 30px; font-weight: 700; color: var(--accent);
  margin-top: 4px; font-variant-numeric: tabular-nums;
}}
.received .words {{ font-size: 10.5px; color: var(--muted); font-style: italic; margin-top: 4px; }}
.received .mode {{ font-size: 11px; color: var(--ink); margin-top: 8px; }}

/* Where this payment leaves the bill */
.ledger {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
.ledger th {{
  text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
  color: var(--muted); font-weight: 600; padding: 9px 8px;
  border-bottom: 2px solid var(--line);
}}
.ledger th.amt, .ledger td.amt {{ text-align: right; }}
.ledger td {{
  padding: 9px 8px; border-bottom: 1px solid var(--line);
  font-size: 12px; font-variant-numeric: tabular-nums;
}}
.ledger td .asof {{ color: var(--muted); font-size: 10px; }}
.ledger tr.balance td {{
  font-weight: 700; border-bottom: none;
  border-top: 1px solid var(--line);
}}
.ledger tr.balance td.amt {{ color: {'#15803D' if settled else '#B45309'}; }}

.chip {{
  display: inline-block; padding: 3px 9px; border-radius: 10px;
  font-size: 10px; font-weight: 700;
}}
.chip.paid {{ background: #DCFCE7; color: #15803D; }}
.chip.due  {{ background: #FEF3C7; color: #B45309; }}

.note {{ font-size: 10.5px; color: var(--muted); margin-bottom: 14px; }}

/* Footer */
.foot {{
  margin-top: 26px; padding-top: 14px; border-top: 1px solid var(--line);
  display: flex; justify-content: space-between; align-items: flex-start;
  font-size: 10.5px; color: var(--muted); line-height: 1.5;
}}
.foot .terms {{ width: 60%; }}
.foot .sig {{ width: 35%; text-align: right; }}
.foot .sig .line {{
  display: inline-block; width: 150px; border-top: 1px solid var(--ink);
  margin-top: 34px; padding-top: 4px; font-size: 10px;
  color: var(--ink); font-weight: 600;
}}
.disclaimer {{
  text-align: center; margin-top: 14px; padding-top: 10px;
  font-size: 9.5px; color: var(--muted); font-style: italic;
  border-top: 1px dashed var(--line);
}}
</style>
</head><body>
<div class="page">

  <!-- LETTERHEAD -->
  <div class="head">
    <div class="brand">
      {logo_html}
      <div class="meta">
        <div class="name">{c_name}</div>
        {f'<div class="sub">{who_line}</div>' if who_line else ''}
        {f'<div class="sub">{contact_line}</div>' if contact_line else ''}
        {f'<div class="sub">{tax_reg_label}: {c_gst}</div>' if c_gst else ''}
      </div>
    </div>
    <div class="doc">
      <div class="label">Payment Receipt</div>
      <div class="number">{receipt_number}</div>
      <div class="date">{receipt_date}</div>
    </div>
  </div>

  <!-- RECEIVED FROM / AGAINST -->
  <div class="strip">
    <div class="col">
      <h4>Received From</h4>
      <p style="font-weight:600;">{p_name}</p>
      <p class="tight">ID: {p_uhid}</p>
      {f'<p class="tight">{p_phone}</p>' if p_phone else ''}
    </div>
    <div class="col" style="text-align:right;">
      <h4>Against Invoice</h4>
      <p style="font-weight:600;">{invoice_number}</p>
      <p class="tight">Invoice total {currency} {invoice_total:,.2f}</p>
      <p style="margin-top:6px;">{status_chip}</p>
    </div>
  </div>

  <!-- THE AMOUNT RECEIVED -->
  <div class="received">
    <div class="cap">Amount received</div>
    <div class="amt">{currency} {amount:,.2f}</div>
    {f'<div class="words">{aow}</div>' if aow else ''}
    <div class="mode">Paid by <strong>{method}</strong> on {receipt_date}</div>
  </div>

  <!-- WHERE THIS PAYMENT LEAVES THE BILL -->
  <table class="ledger">
    <thead>
      <tr><th>Position on this invoice</th><th class="amt">Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>This payment</td>
        <td class="amt">{currency} {amount:,.2f}</td>
      </tr>
      <tr>
        <td>Total paid so far <span class="asof">(including this payment)</span></td>
        <td class="amt">{currency} {paid_to_date:,.2f}</td>
      </tr>
      <tr class="balance">
        <td>Balance still due <span class="asof">(as on {receipt_date})</span></td>
        <td class="amt">{currency} {balance_due:,.2f}</td>
      </tr>
    </tbody>
  </table>

  {f'<div class="note">Note: {note}</div>' if note else ''}

  <!-- FOOTER -->
  <div class="foot">
    <div class="terms">
      This receipt acknowledges the amount shown above against invoice {invoice_number}.
      Figures are as on {receipt_date}. Computer-generated; no signature required.
    </div>
    {signature_box}
  </div>

  {f'<div class="disclaimer">{footer_text}</div>' if footer_text else ''}

</div>
</body></html>"""
