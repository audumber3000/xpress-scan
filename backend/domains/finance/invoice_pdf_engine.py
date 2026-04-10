import datetime

# ── Amount-in-words (Indian numbering) ───────────────────────────────────────
def _amount_in_words(amount):
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens_w = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _conv(n):
        if n == 0:         return ''
        elif n < 20:       return ones[n]
        elif n < 100:      return tens_w[n // 10] + ((' ' + ones[n % 10]) if n % 10 else '')
        elif n < 1000:     return ones[n // 100] + ' Hundred' + ((' ' + _conv(n % 100)) if n % 100 else '')
        elif n < 100000:   return _conv(n // 1000) + ' Thousand' + ((' ' + _conv(n % 1000)) if n % 1000 else '')
        elif n < 10000000: return _conv(n // 100000) + ' Lakh' + ((' ' + _conv(n % 100000)) if n % 100000 else '')
        else:              return _conv(n // 10000000) + ' Crore' + ((' ' + _conv(n % 10000000)) if n % 10000000 else '')

    try:
        amount = float(amount)
    except Exception:
        return 'Zero Rupees Only'
    rupees = int(amount)
    paise  = round((amount - rupees) * 100)
    result = (_conv(rupees) if rupees else 'Zero') + ' Rupees'
    if paise:
        result += ' and ' + _conv(paise) + ' Paise'
    return result + ' Only'


# ── Main entry ────────────────────────────────────────────────────────────────
def generate_invoice_html(invoice, clinic, config=None) -> str:
    # Primary colour: config → clinic attribute → smart default
    primary_color = (
        (config.primary_color if config and config.primary_color else None) or
        getattr(clinic, 'primary_color', None) or
        '#1a2a6c'
    )
    footer_text   = (config.footer_text if config and config.footer_text else '') if config else ''

    # Logo
    logo_url  = (config.logo_url if config and config.logo_url else None) if config else None
    logo_url  = logo_url or getattr(clinic, 'logo_url', None)
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
    else:
        initials = (clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = f'<div style="width:75px;height:75px;background:#f0f4f8;border:2px dashed {primary_color};display:flex;justify-content:center;align-items:center;color:{primary_color};font-weight:bold;font-size:11px;text-align:center;">{initials}</div>'

    # Clinic fields
    c_name    = clinic.name    if clinic else 'Dental Clinic'
    c_phone   = clinic.phone   if clinic and clinic.phone   else ''
    c_email   = clinic.email   if clinic and clinic.email   else ''
    c_address = clinic.address if clinic and clinic.address else ''
    c_tagline = getattr(clinic, 'tagline', 'Comprehensive Dental & Orthodontic Care') if clinic else ''
    c_reg     = getattr(clinic, 'reg_number', '') if clinic else ''
    c_gst     = getattr(clinic, 'gst_number',  '') if clinic else ''
    c_doctor  = getattr(clinic, 'doctor_name', '') if clinic else ''

    # Status label
    status_label = (
        'UPI – Unverified'
        if invoice.status == 'paid_unverified' and invoice.payment_mode == 'UPI'
        else invoice.status.replace('_', ' ').title()
    )

    # Patient
    pat      = getattr(invoice, 'patient', None)
    p_name   = pat.name  if pat else ''
    p_phone  = pat.phone if pat else ''
    p_age    = str(getattr(pat, 'age',    '') or '') if pat else ''
    p_gender = (getattr(pat, 'gender', '') or getattr(pat, 'sex', '') or '') if pat else ''
    p_uhid   = (getattr(pat, 'uhid', '') or (f'PT-{pat.id}' if pat else ''))

    # Doctor from appointment
    doctor_name = c_doctor
    try:
        appt = getattr(invoice, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)
            if doc:
                doctor_name = getattr(doc, 'name', '') or doctor_name
            if not doctor_name:
                doctor_name = getattr(appt, 'dentist_name', '') or getattr(appt, 'doctor_name', '') or ''
    except Exception:
        pass

    # Dates
    created_at   = getattr(invoice, 'created_at', None)
    invoice_date = created_at.strftime('%d %B %Y') if created_at else datetime.date.today().strftime('%d %B %Y')

    # Financial
    subtotal = float(getattr(invoice, 'subtotal',       0) or 0)
    total    = float(getattr(invoice, 'total',          0) or 0)
    inv_tax  = float(getattr(invoice, 'tax',            0) or 0)
    discount = float(getattr(invoice, 'discount_amount',0) or 0)
    taxable  = subtotal - discount

    return _render_indian_tax(
        invoice=invoice,
        primary_color=primary_color,
        footer_text=footer_text,
        logo_html=logo_html,
        c_name=c_name, c_phone=c_phone, c_email=c_email,
        c_address=c_address, c_tagline=c_tagline,
        c_reg=c_reg, c_gst=c_gst, doctor_name=doctor_name,
        status_label=status_label,
        p_name=p_name, p_phone=p_phone,
        p_age=p_age, p_gender=p_gender, p_uhid=p_uhid,
        invoice_date=invoice_date,
        subtotal=subtotal, total=total,
        inv_tax=inv_tax, discount=discount, taxable=taxable,
    )


# ── Indian Tax Invoice ────────────────────────────────────────────────────────
def _render_indian_tax(
    invoice, primary_color,
    footer_text, logo_html,
    c_name, c_phone, c_email, c_address, c_tagline,
    c_reg, c_gst, doctor_name, status_label,
    p_name, p_phone, p_age, p_gender, p_uhid,
    invoice_date, subtotal, total, inv_tax, discount, taxable,
):
    # Line items
    rows = ''
    for i, item in enumerate(invoice.line_items, 1):
        tooth = getattr(item, 'tooth_number', '') or '–'
        sac   = getattr(item, 'sac_code',     '') or '9993'
        rows += (
            f'<tr>'
            f'<td>{i}</td>'
            f'<td class="text-left">{item.description}</td>'
            f'<td>{sac}</td>'
            f'<td>{tooth}</td>'
            f'<td>{int(item.quantity)}</td>'
            f'<td class="text-right">{float(item.unit_price):,.2f}</td>'
            f'<td class="text-right">{float(item.amount):,.2f}</td>'
            f'</tr>'
        )

    # Summary rows
    disc_row = (
        f'<tr><td>Discount</td><td>– ₹ {discount:,.2f}</td></tr>'
        if discount > 0 else ''
    )
    half = inv_tax / 2 if inv_tax > 0 else 0
    cgst_row = f'<tr><td>CGST @ 9%</td><td>₹ {half:,.2f}</td></tr>' if half else ''
    sgst_row = f'<tr><td>SGST @ 9%</td><td>₹ {half:,.2f}</td></tr>' if half else ''

    # Reg / GST line
    reg_gst_parts = []
    if c_reg:  reg_gst_parts.append(f'Reg No: {c_reg}')
    if c_gst:  reg_gst_parts.append(f'<strong>GSTIN: {c_gst}</strong>')
    reg_gst_line = f'<p>{" | ".join(reg_gst_parts)}</p>' if reg_gst_parts else ''

    # Payment
    pm  = getattr(invoice, 'payment_mode', '') or 'Pending'
    utr = getattr(invoice, 'utr', '') or ''

    age_gender = ' / '.join(filter(None, [p_age, p_gender]))
    notes      = getattr(invoice, 'notes', '') or ''
    aow        = _amount_in_words(total)

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
:root {{
  --primary-color: {primary_color};
  --bg-color: #f4f7f6;
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
.invoice-container {{
  width: 100%;
  min-height: 297mm;
  margin: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
}}
.color-strip {{ height: 10px; background-color: var(--primary-color); }}
.invoice-body {{ padding: 40px 50px; flex-grow: 1; }}
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
.clinic-info-left .services {{ margin: 0; font-size: 12px; font-weight: bold; color: var(--primary-color); }}
.clinic-info-right {{ text-align: right; }}
.clinic-info-right .doc-name {{ font-size: 14px; font-weight: bold; color: var(--primary-color); margin: 0 0 4px 0; }}
.clinic-info-right p {{ margin: 2px 0; font-size: 11px; color: var(--text-muted); font-weight: 500; }}
.invoice-title {{
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

<div class="invoice-container">
  <div class="color-strip"></div>
  <div class="invoice-body">

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div style="margin-right:20px;flex-shrink:0;">{logo_html}</div>
        <div class="clinic-info-left">
          <h1>{c_name}</h1>
          <div class="tagline">{c_tagline}</div>
        </div>
      </div>
      <div class="clinic-info-right">
        {f'<div class="doc-name">{doctor_name}</div>' if doctor_name else ''}
        {f'<p>{c_address}</p>' if c_address else ''}
        {f'<p>📞 {c_phone}</p>' if c_phone else ''}
        {f'<p>✉️ {c_email}</p>' if c_email else ''}
        {reg_gst_line}
      </div>
    </div>

    <div class="invoice-title">TAX INVOICE</div>

    <!-- PATIENT / INVOICE INFO -->
    <table class="info-table">
      <tr>
        <td>
          <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
          <p><strong>Date:</strong> {invoice_date}</p>
          <p><strong>Payment Method:</strong> {pm}{(' | UTR: ' + utr) if utr else ''}</p>
          <p><strong>Status:</strong> {status_label}</p>
          {f'<p><strong>Notes:</strong> {notes}</p>' if notes else ''}
        </td>
        <td>
          <p><strong>Patient Name:</strong> {p_name}</p>
          <p><strong>Patient ID:</strong> {p_uhid}</p>
          <p><strong>Age / Sex:</strong> {age_gender or '–'} &nbsp;&nbsp; <strong>Contact:</strong> {p_phone}</p>
        </td>
      </tr>
    </table>

    <!-- LINE ITEMS TABLE -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:30px;">S.No.</th>
          <th class="text-left" style="width:38%;">Service / Treatment Description</th>
          <th style="width:65px;">SAC / HSN</th>
          <th style="width:60px;">Tooth No.</th>
          <th style="width:32px;">Qty</th>
          <th class="text-right" style="width:85px;">Unit Price (₹)</th>
          <th class="text-right" style="width:85px;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>

    <!-- BILLING SUMMARY -->
    <div class="summary-wrapper">
      <table class="summary-table">
        <tr><td>Subtotal</td><td>₹ {subtotal:,.2f}</td></tr>
        {disc_row}
        <tr><td>Net Taxable Amount</td><td>₹ {taxable:,.2f}</td></tr>
        {cgst_row}
        {sgst_row}
        <tr class="grand-total"><td>Grand Total</td><td>₹ {total:,.2f}</td></tr>
      </table>
    </div>

    <!-- AMOUNT IN WORDS -->
    <div class="amount-words">
      <strong>Amount in Words:</strong> {aow}
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="terms">
        <h4>Terms &amp; Conditions</h4>
        <ul>
          <li>Clinical treatments (Consultation, RCT, Crowns, Implants) are exempt from GST as per Indian Govt. regulations (SAC 9993). GST applies only to cosmetic procedures &amp; pharmacy products.</li>
          <li>Warranties for crowns/bridges are valid only with this original invoice.</li>
          <li>This is a computer-generated invoice and does not require a physical signature.</li>
        </ul>
      </div>
      <div class="signature-box">
        <div class="signature-line">Authorized Signatory / Seal</div>
        <p style="margin:5px 0 0 0;color:var(--text-muted);font-weight:bold;">{c_name}</p>
      </div>
    </div>

    {f'<div style="text-align:center;color:#888;font-size:10px;margin-top:16px;border-top:1px solid #eee;padding-top:10px;">{footer_text}</div>' if footer_text else ''}

  </div>
  <div class="color-strip"></div>
</div>

</body></html>"""


# ── Legacy template stubs (kept so old template_id values don't break) ────────
def _render_modern_orange(c):    return generate_invoice_html(c['invoice'], type('C', (), c)())
def _render_classic_blue(c):     return generate_invoice_html(c['invoice'], type('C', (), c)())
def _render_minimalist_mono(c):  return generate_invoice_html(c['invoice'], type('C', (), c)())
def _render_elegant_green(c):    return generate_invoice_html(c['invoice'], type('C', (), c)())
