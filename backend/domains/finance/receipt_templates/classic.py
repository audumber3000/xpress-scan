"""Classic payment receipt — the counterpart to the Classic invoice.

Deliberately built from the same parts as `invoice_templates/classic.py`: the
accent strip top and bottom, the uppercase letterhead with the clinic block on
the right, a centred underlined title, the label-grid info table, the bordered
items table with a tinted header, the right-aligned summary ending in a
highlighted grand-total row, the amount-in-words bar, and the terms + signature
footer. A patient holding the invoice and the receipt should see one practice,
not two vendors.

Where the invoice asks "what is owed", the receipt answers "what was handed
over": the items table carries the payment, the summary walks invoice total →
paid so far → balance, and the grand-total row is the balance that remains.

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
        logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
    else:
        initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = (
            f'<div style="width:75px;height:75px;background:#f0f4f8;border:2px dashed {primary_color};'
            f'display:flex;justify-content:center;align-items:center;color:{primary_color};'
            f'font-weight:bold;font-size:11px;text-align:center;">{initials}</div>'
        )

    c_name    = safe_text(clinic.name    if clinic else 'Dental Clinic')
    c_phone   = safe_text(clinic.phone   if clinic and clinic.phone   and vis.contact else '')
    c_email   = safe_text(clinic.email   if clinic and clinic.email   and vis.contact else '')
    c_address = safe_text(clinic.address if clinic and clinic.address and vis.address else '')
    c_tagline = safe_text((getattr(clinic, 'tagline', '') or '' if clinic else '') if vis.tagline else '')
    c_reg     = safe_text((getattr(clinic, 'license_number',  '') if clinic else '') if vis.license_number else '')
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

    doctor_name = c_doctor
    doctor_signature = ''
    try:
        appt = getattr(invoice, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)
            if doc:
                doctor_name = safe_text(getattr(doc, 'name', '') or doctor_name)
                doctor_signature = safe_signature_data_uri(getattr(doc, 'signature_url', None))
    except Exception:
        pass

    # ── The figures, frozen when the money was taken ─────────────────────────
    amount = float(getattr(payment, 'amount', 0) or 0)
    invoice_total = float(getattr(invoice, 'total', 0) or 0)
    paid_to_date = getattr(payment, 'receipt_paid_to_date', None)
    balance_due = getattr(payment, 'receipt_balance_due', None)
    if paid_to_date is None:
        paid_to_date = amount
    if balance_due is None:
        balance_due = max(invoice_total - float(paid_to_date), 0.0)
    paid_to_date = float(paid_to_date)
    balance_due = float(balance_due)

    receipt_number = safe_text(getattr(payment, 'receipt_number', '') or '')
    invoice_number = safe_text(getattr(invoice, 'invoice_number', '') or '')

    # The document is dated the day the money changed hands, not the day it was
    # typed in — a back-dated entry still receipts its real date.
    on_date = getattr(payment, 'paid_on', None) or (
        payment.created_at.date() if getattr(payment, 'created_at', None) else datetime.date.today()
    )
    receipt_date = on_date.strftime('%d %B %Y')

    method = safe_text(getattr(payment, 'method', '') or 'Cash')
    note = safe_text(getattr(payment, 'note', '') or '')

    aow = _amount_in_words(amount) if is_india else ''
    settled = balance_due <= 0.005

    reg_gst_parts = []
    if c_reg:
        reg_gst_parts.append(f'Reg No: {c_reg}')
    if c_gst:
        reg_gst_parts.append(f'<strong>{tax_reg_label}: {c_gst}</strong>')
    reg_gst_line = f'<p>{" | ".join(reg_gst_parts)}</p>' if reg_gst_parts else ''

    signature_box = (
        f'''<div class="signature-box">
        {f'<img src="{doctor_signature}" alt="Signature" style="max-width:140px;max-height:50px;display:block;margin:0 auto 4px auto;object-fit:contain;">' if doctor_signature else ''}
        <div class="signature-line">Authorized Signatory / Seal</div>
        <p style="margin:5px 0 0 0;color:var(--text-muted);font-weight:bold;">{c_name}</p>
      </div>''' if vis.signature else ''
    )

    settled_row = (
        '<tr><td colspan="3" style="text-align:center;font-weight:bold;color:#15803D;">'
        'Invoice settled in full — no balance outstanding.</td></tr>'
        if settled else ''
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
@page {{ size: A4; margin: 2mm; }}
:root {{
  --primary-color: {primary_color};
  --text-main: #333;
  --text-muted: #555;
  --border-light: #ddd;
  --table-header-bg: #f8fafc;
  --highlight-bg: #f0f4f8;
}}
body {{
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--text-main);
  line-height: 1.3;
  background-color: #fff;
  margin: 0;
  padding: 0;
  font-size: 13px;
}}
.receipt-container {{
  width: 100%;
  min-height: 297mm;
  margin: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
}}
.color-strip {{ height: 10px; background-color: var(--primary-color); }}
.receipt-body {{ padding: 40px 50px; flex-grow: 1; }}
.header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 15px;
  margin-bottom: 15px;
}}
.header-left {{ display: flex; align-items: center; }}
.clinic-info-left h1 {{
  margin: 0;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 24px;
  line-height: 1.1;
}}
.clinic-info-left .tagline {{ margin: 3px 0; font-size: 16px; color: var(--primary-color); font-weight: bold; }}
.clinic-info-right {{ text-align: right; }}
.clinic-info-right .doc-name {{ font-size: 14px; font-weight: bold; color: var(--primary-color); margin: 0 0 4px 0; }}
.clinic-info-right p {{ margin: 2px 0; font-size: 11px; color: var(--text-muted); font-weight: 500; }}
.receipt-title {{
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  margin: 10px 0 15px 0;
  color: var(--text-main);
  text-decoration: underline;
}}
.info-table {{ width: 100%; margin-bottom: 15px; }}
.info-table td {{ vertical-align: top; width: 50%; }}
.info-table p {{ margin: 3px 0; }}
.info-table strong {{ display: inline-block; width: 120px; color: var(--primary-color); }}
.items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 15px; }}
.items-table th, .items-table td {{
  border: 1px solid var(--border-light);
  padding: 6px 8px;
  text-align: center;
}}
.items-table th {{
  background-color: var(--table-header-bg);
  color: var(--primary-color);
  font-weight: bold;
  font-size: 11px;
}}
.items-table .text-left {{ text-align: left; }}
.items-table .text-right {{ text-align: right; }}
.summary-wrapper {{ display: flex; justify-content: flex-end; margin-bottom: 15px; }}
.summary-table {{ width: 350px; border-collapse: collapse; }}
.summary-table td {{
  padding: 6px 8px;
  text-align: right;
  border-bottom: 1px solid var(--border-light);
}}
.summary-table td:first-child {{ text-align: left; font-weight: bold; color: var(--text-muted); }}
.grand-total {{
  font-size: 15px;
  font-weight: bold;
  border-top: 2px solid var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
  color: var(--primary-color);
  background-color: var(--highlight-bg);
}}
.amount-words {{
  font-style: italic;
  margin-bottom: 15px;
  background: var(--table-header-bg);
  padding: 8px 12px;
  border-left: 4px solid var(--primary-color);
  color: #444;
}}
.footer {{
  font-size: 11px;
  color: #666;
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
}}
.terms {{ width: 65%; }}
.terms h4 {{ margin-bottom: 4px; color: var(--primary-color); text-transform: uppercase; }}
.terms ul {{ padding-left: 15px; margin: 0; }}
.signature-box {{ width: 30%; text-align: center; margin-top: 10px; }}
.signature-line {{
  border-top: 1px solid var(--text-main);
  margin-top: 40px;
  padding-top: 5px;
  font-weight: bold;
  color: var(--primary-color);
}}
</style>
</head><body>

<div class="receipt-container">
  <div class="color-strip"></div>
  <div class="receipt-body">

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div style="margin-right:20px;flex-shrink:0;">{logo_html}</div>
        <div class="clinic-info-left">
          <h1>{c_name}</h1>
          {f'<div class="tagline">{c_tagline}</div>' if c_tagline else ''}
        </div>
      </div>
      <div class="clinic-info-right">
        {f'<div class="doc-name">{doctor_name}</div>' if doctor_name else ''}
        {f'<p>{c_address}</p>' if c_address else ''}
        {f'<p>Tel: {c_phone}</p>' if c_phone else ''}
        {f'<p>Email: {c_email}</p>' if c_email else ''}
        {reg_gst_line}
      </div>
    </div>

    <div class="receipt-title">PAYMENT RECEIPT</div>

    <!-- RECEIPT / PATIENT INFO -->
    <table class="info-table">
      <tr>
        <td>
          <p><strong>Receipt No:</strong> {receipt_number}</p>
          <p><strong>Date:</strong> {receipt_date}</p>
          <p><strong>Payment Method:</strong> {method}</p>
          <p><strong>Against Invoice:</strong> {invoice_number}</p>
          {f'<p><strong>Note:</strong> {note}</p>' if note else ''}
        </td>
        <td>
          <p><strong>Received From:</strong> {p_name}</p>
          <p><strong>Patient ID:</strong> {p_uhid}</p>
          {f'<p><strong>Contact:</strong> {p_phone}</p>' if p_phone else ''}
        </td>
      </tr>
    </table>

    <!-- WHAT WAS RECEIVED -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:30px;">S.No.</th>
          <th class="text-left">Particulars</th>
          <th class="text-right" style="width:130px;">Amount ({currency})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td class="text-left">
            Payment received by {method} on {receipt_date}<br>
            <span style="font-size:11px;color:#777;">Towards invoice {invoice_number}</span>
          </td>
          <td class="text-right">{amount:,.2f}</td>
        </tr>
        {settled_row}
      </tbody>
    </table>

    <!-- WHERE THIS PAYMENT LEAVES THE BILL -->
    <div class="summary-wrapper">
      <table class="summary-table">
        <tr><td>Invoice Total</td><td>{currency} {invoice_total:,.2f}</td></tr>
        <tr><td>Amount Received (This Receipt)</td><td>{currency} {amount:,.2f}</td></tr>
        <tr><td>Total Paid So Far</td><td>{currency} {paid_to_date:,.2f}</td></tr>
        <tr class="grand-total">
          <td>
            Balance Due
            <span style="display:block;font-weight:normal;font-size:11px;">as on {receipt_date}</span>
          </td>
          <td style="white-space:nowrap;">{currency} {balance_due:,.2f}</td>
        </tr>
      </table>
    </div>

    <!-- AMOUNT IN WORDS -->
    {f'''<div class="amount-words">
      <strong>Received Amount in Words:</strong> {aow}
    </div>''' if aow else ''}

    <!-- FOOTER -->
    <div class="footer">
      <div class="terms">
        <h4>Terms &amp; Conditions</h4>
        <ul>
          <li>This receipt acknowledges the amount shown above against invoice {invoice_number}.</li>
          <li>The balance shown is as on {receipt_date} and does not reflect any later adjustment.</li>
          <li>This is a computer-generated receipt and does not require a physical signature.</li>
        </ul>
      </div>
      {signature_box}
    </div>

    {f'<div style="text-align:center;color:#888;font-size:10px;margin-top:16px;border-top:1px solid #eee;padding-top:10px;">{footer_text}</div>' if footer_text else ''}

  </div>
  <div class="color-strip"></div>
</div>

</body></html>"""
