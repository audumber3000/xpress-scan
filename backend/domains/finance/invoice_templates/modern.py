"""Modern Compact invoice variant.

Design intent vs Classic:
- No accent stripe / dark band — uses a thin top rule + accent column on totals.
- Letterhead row is single-line (logo + clinic name beside it on one row).
- Big, prominent "INVOICE" number + total at the top right.
- Single-line item rows (no SAC / Tooth columns) for a cleaner look. Tooth #
  shows inline with the description.
- Summary block is compact, right-aligned.
- No Indian "amount in words" block (keeps the page short).
- Footer is one tight row of terms + signature.

WeasyPrint-safe CSS only — no flexbox `gap`, no CSS grid, no JS, no `:has()`.
Layout uses tables and `display: flex` with explicit margins where needed.
"""
import datetime

from domains.infrastructure.services.pdf_safety import safe_color, safe_signature_data_uri, safe_text, safe_url


def render_invoice(invoice, clinic, config=None) -> str:
    primary_color = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default='#111827',
    )
    footer_text = safe_text((config.footer_text if config and config.footer_text else '') if config else '')

    raw_logo_url = (config.logo_url if config and config.logo_url else None) if config else None
    raw_logo_url = raw_logo_url or getattr(clinic, 'logo_url', None)
    logo_url = safe_url(raw_logo_url)
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" style="width:48px;height:48px;object-fit:contain;">'
    else:
        initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = (
            f'<div style="width:48px;height:48px;background:{primary_color};color:#fff;'
            f'display:flex;align-items:center;justify-content:center;'
            f'font-weight:700;font-size:14px;letter-spacing:0.5px;border-radius:6px;">{initials}</div>'
        )

    c_name    = safe_text(clinic.name    if clinic else 'Dental Clinic')
    c_phone   = safe_text(clinic.phone   if clinic and clinic.phone   else '')
    c_email   = safe_text(clinic.email   if clinic and clinic.email   else '')
    c_address = safe_text(clinic.address if clinic and clinic.address else '')
    c_gst     = safe_text(getattr(clinic, 'gst_number',  '') if clinic else '')
    c_doctor  = safe_text(getattr(clinic, 'doctor_name', '') if clinic else '')

    pat      = getattr(invoice, 'patient', None)
    p_name   = safe_text(pat.name  if pat else '')
    p_phone  = safe_text(pat.phone if pat else '')
    p_age    = safe_text(str(getattr(pat, 'age', '') or '') if pat else '')
    p_gender = safe_text((getattr(pat, 'gender', '') or getattr(pat, 'sex', '') or '') if pat else '')
    p_uhid   = safe_text(getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else ''))

    # Doctor from appointment + their signature (Phase 5)
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

    created_at   = getattr(invoice, 'created_at', None)
    invoice_date = created_at.strftime('%d %b %Y') if created_at else datetime.date.today().strftime('%d %b %Y')

    subtotal = float(getattr(invoice, 'subtotal',       0) or 0)
    total    = float(getattr(invoice, 'total',          0) or 0)
    inv_tax  = float(getattr(invoice, 'tax',            0) or 0)
    discount = float(getattr(invoice, 'discount_amount',0) or 0)
    taxable  = subtotal - discount

    invoice_number = safe_text(getattr(invoice, 'invoice_number', '') or '')
    pm  = safe_text(getattr(invoice, 'payment_mode', '') or 'Pending')
    notes = safe_text(getattr(invoice, 'notes', '') or '')

    age_gender = ' / '.join(filter(None, [p_age, p_gender])) or '–'

    # ── Line item rows (single-line, with tooth inlined) ─────────────────────
    rows = ''
    for i, item in enumerate(invoice.line_items, 1):
        tooth = getattr(item, 'tooth_number', '') or ''
        tooth_chip = f'<span style="font-size:10px;color:#6b7280;margin-left:6px;">#{safe_text(str(tooth))}</span>' if tooth else ''
        rows += (
            f'<tr>'
            f'<td class="num">{i}</td>'
            f'<td>{safe_text(item.description)}{tooth_chip}</td>'
            f'<td class="qty">{int(item.quantity)}</td>'
            f'<td class="amt">₹ {float(item.unit_price):,.2f}</td>'
            f'<td class="amt">₹ {float(item.amount):,.2f}</td>'
            f'</tr>'
        )

    # ── Summary rows ────────────────────────────────────────────────────────
    disc_row = f'<tr><td>Discount</td><td>– ₹ {discount:,.2f}</td></tr>' if discount > 0 else ''
    half = inv_tax / 2 if inv_tax > 0 else 0
    cgst_row = f'<tr><td>CGST 9%</td><td>₹ {half:,.2f}</td></tr>' if half else ''
    sgst_row = f'<tr><td>SGST 9%</td><td>₹ {half:,.2f}</td></tr>' if half else ''

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
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.4;
}}
.page {{
  width: 100%;
  min-height: 297mm;
  padding: 32px 40px;
}}

/* Letterhead */
.head {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
}}
.head .brand {{ display: flex; align-items: center; }}
.head .brand .meta {{ margin-left: 12px; }}
.head .brand .name {{ font-size: 16px; font-weight: 700; letter-spacing: 0.2px; color: var(--ink); }}
.head .brand .sub  {{ font-size: 10.5px; color: var(--muted); margin-top: 2px; }}
.head .invoice-meta {{ text-align: right; }}
.head .invoice-meta .label {{
  font-size: 10px; color: var(--muted); text-transform: uppercase;
  letter-spacing: 1px; margin-bottom: 4px;
}}
.head .invoice-meta .number {{
  font-size: 22px; font-weight: 700; color: var(--accent); letter-spacing: 0.5px;
}}
.head .invoice-meta .date {{ font-size: 11px; color: var(--muted); margin-top: 2px; }}

/* Bill-to / patient strip */
.strip {{
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
  margin-bottom: 18px;
}}
.strip .col {{ width: 48%; }}
.strip .col h4 {{
  margin: 0 0 6px 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 600;
}}
.strip .col p {{ margin: 1px 0; font-size: 11.5px; color: var(--ink); }}
.strip .col .tight {{ color: var(--muted); font-size: 10.5px; }}

/* Items table */
.items {{
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 18px;
}}
.items thead th {{
  text-align: left;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 600;
  padding: 10px 8px;
  border-bottom: 2px solid var(--line);
}}
.items thead th.num {{ width: 28px; text-align: center; }}
.items thead th.qty {{ width: 50px; text-align: center; }}
.items thead th.amt {{ width: 110px; text-align: right; }}
.items tbody td {{
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  color: var(--ink);
}}
.items tbody td.num {{ text-align: center; color: var(--muted); }}
.items tbody td.qty {{ text-align: center; }}
.items tbody td.amt {{ text-align: right; font-variant-numeric: tabular-nums; }}

/* Totals block */
.totals-wrap {{
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}}
.totals {{
  width: 280px;
  border-collapse: collapse;
}}
.totals td {{
  padding: 6px 0;
  font-size: 12px;
  color: var(--ink);
}}
.totals td:first-child {{ color: var(--muted); }}
.totals td:last-child {{ text-align: right; font-variant-numeric: tabular-nums; }}
.totals .grand td {{
  border-top: 1px solid var(--line);
  padding-top: 10px;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 700;
}}
.totals .grand td:last-child {{ color: var(--accent); }}

/* Footer */
.foot {{
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 10.5px;
  color: var(--muted);
  line-height: 1.5;
}}
.foot .terms {{ width: 60%; }}
.foot .sig {{ width: 35%; text-align: right; }}
.foot .sig .line {{
  display: inline-block;
  width: 140px;
  border-top: 1px solid var(--ink);
  margin-top: 36px;
  padding-top: 4px;
  font-size: 10px;
  color: var(--ink);
  font-weight: 600;
}}

.disclaimer {{
  text-align: center;
  margin-top: 14px;
  padding-top: 10px;
  font-size: 9.5px;
  color: var(--muted);
  font-style: italic;
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
        <div class="sub">{(doctor_name + ' · ') if doctor_name else ''}{c_address}</div>
        <div class="sub">{('Tel: ' + c_phone) if c_phone else ''}{('  ·  ' + c_email) if c_email else ''}</div>
        {f'<div class="sub">GSTIN: {c_gst}</div>' if c_gst else ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="label">Invoice</div>
      <div class="number">{invoice_number}</div>
      <div class="date">{invoice_date}</div>
    </div>
  </div>

  <!-- BILL TO / PATIENT -->
  <div class="strip">
    <div class="col">
      <h4>Billed To</h4>
      <p style="font-weight:600;">{p_name}</p>
      <p class="tight">ID: {p_uhid}</p>
      <p class="tight">{age_gender}{('  ·  ' + p_phone) if p_phone else ''}</p>
    </div>
    <div class="col" style="text-align:right;">
      <h4>Payment</h4>
      <p>{pm}</p>
      {f'<p class="tight">{notes}</p>' if notes else ''}
    </div>
  </div>

  <!-- ITEMS -->
  <table class="items">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Treatment / Service</th>
        <th class="qty">Qty</th>
        <th class="amt">Rate</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-wrap">
    <table class="totals">
      <tr><td>Subtotal</td><td>₹ {subtotal:,.2f}</td></tr>
      {disc_row}
      {cgst_row}
      {sgst_row}
      <tr class="grand"><td>Total Due</td><td>₹ {total:,.2f}</td></tr>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="foot">
    <div class="terms">
      Clinical treatments (consultation, RCT, crowns, implants) are GST-exempt under SAC 9993.
      Warranties valid only with this original invoice. Computer-generated; no signature required.
    </div>
    <div class="sig">
      {f'<img src="{doctor_signature}" alt="Signature" style="display:block;max-width:140px;max-height:48px;margin-left:auto;margin-bottom:2px;object-fit:contain;">' if doctor_signature else ''}
      <span class="line">Authorised Signatory</span>
    </div>
  </div>

  {f'<div class="disclaimer">{footer_text}</div>' if footer_text else ''}

</div>
</body></html>"""
