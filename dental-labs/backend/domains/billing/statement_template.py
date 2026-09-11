"""Monthly statement / GST invoice HTML template for Dental Labs.

Standalone renderer (mirrors the structure of MolarPlus `invoice_templates/classic.py`
but simpler — no template variants). Produces a print-ready A4 HTML document that
`domains/billing/pdf.py` converts to PDF.
"""
from html import escape

BRAND = "#2a276e"


def _amount_in_words(amount: float, currency_code: str = "INR") -> str:
    """Whole-number amount in words. Indian numbering for INR, else international."""
    rupees = int(round(amount))
    if rupees == 0:
        return "Zero"

    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
            "Ninety"]

    def two(n):
        if n < 20:
            return ones[n]
        return tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")

    def three(n):
        h = n // 100
        r = n % 100
        out = (ones[h] + " Hundred" if h else "")
        if r:
            out += (" " if out else "") + two(r)
        return out

    parts = []
    if currency_code == "INR":
        # Indian system: crore, lakh, thousand, hundred
        crore = rupees // 10000000
        rupees %= 10000000
        lakh = rupees // 100000
        rupees %= 100000
        thousand = rupees // 1000
        rupees %= 1000
        if crore:
            parts.append(two(crore) + " Crore")
        if lakh:
            parts.append(two(lakh) + " Lakh")
        if thousand:
            parts.append(two(thousand) + " Thousand")
        if rupees:
            parts.append(three(rupees))
    else:
        million = rupees // 1000000
        rupees %= 1000000
        thousand = rupees // 1000
        rupees %= 1000
        if million:
            parts.append(three(million) + " Million")
        if thousand:
            parts.append(three(thousand) + " Thousand")
        if rupees:
            parts.append(three(rupees))

    return " ".join(parts).strip()


def _fmt(symbol: str, amount: float) -> str:
    return f"{symbol}{amount:,.2f}"


def render_statement_html(invoice, lab, client) -> str:
    sym = (lab.currency_symbol if lab else None) or "₹"
    ccode = (lab.currency_code if lab else None) or "INR"
    tax_label = (lab.tax_label if lab else None) or "GST No."

    lab_name = escape(lab.name) if lab and lab.name else "Dental Lab"
    lab_lines = []
    if lab:
        if lab.address:
            lab_lines.append(escape(lab.address).replace("\n", "<br>"))
        contact = " · ".join(filter(None, [lab.phone, lab.email]))
        if contact:
            lab_lines.append(escape(contact))
        if lab.tax_id:
            lab_lines.append(f"{escape(tax_label)}: {escape(lab.tax_id)}")
    lab_meta = "<br>".join(lab_lines)

    client_name = escape(client.name) if client and client.name else "Client"
    client_lines = []
    if client:
        if client.clinic_name:
            client_lines.append(escape(client.clinic_name))
        if client.address:
            client_lines.append(escape(client.address).replace("\n", "<br>"))
        contact = " · ".join(filter(None, [client.phone, client.email]))
        if contact:
            client_lines.append(escape(contact))
        if client.tax_id:
            client_lines.append(f"{escape(tax_label)}: {escape(client.tax_id)}")
    client_meta = "<br>".join(client_lines)

    rows = ""
    for i, li in enumerate(invoice.line_items, start=1):
        rows += f"""
        <tr>
          <td class="num">{i}</td>
          <td>{escape(li.description or '')}</td>
          <td class="num">{li.qty:g}</td>
          <td class="num">{_fmt(sym, li.amount)}</td>
        </tr>"""

    words = _amount_in_words(invoice.total, ccode)
    tax_pct = f"{invoice.tax_rate:g}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 18mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937;
         font-size: 12px; margin: 0; }}
  .head {{ display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid {BRAND}; padding-bottom: 14px; }}
  .lab-name {{ font-size: 22px; font-weight: 700; color: {BRAND}; }}
  .lab-meta, .bill-meta {{ color: #4b5563; line-height: 1.5; margin-top: 6px; }}
  .doc-title {{ text-align: right; }}
  .doc-title h1 {{ font-size: 20px; color: {BRAND}; margin: 0; letter-spacing: 1px; }}
  .doc-title .meta {{ color: #4b5563; margin-top: 6px; line-height: 1.6; }}
  .parties {{ display: flex; justify-content: space-between; margin-top: 22px; }}
  .label {{ text-transform: uppercase; font-size: 10px; letter-spacing: 1px;
           color: #9ca3af; margin-bottom: 4px; }}
  .bill-name {{ font-weight: 600; font-size: 14px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
  th {{ background: {BRAND}; color: #fff; text-align: left; padding: 9px 10px;
       font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }}
  td {{ padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }}
  .num {{ text-align: right; }}
  th.num {{ text-align: right; }}
  .totals {{ width: 280px; margin-left: auto; margin-top: 14px; }}
  .totals tr td {{ border: none; padding: 5px 10px; }}
  .totals .grand td {{ border-top: 2px solid {BRAND}; font-weight: 700;
                      font-size: 14px; color: {BRAND}; }}
  .words {{ margin-top: 14px; font-style: italic; color: #4b5563; }}
  .footer {{ margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 12px;
            color: #6b7280; font-size: 11px; line-height: 1.6; }}
  .pill {{ display: inline-block; padding: 2px 10px; border-radius: 999px;
          background: #eef2ff; color: {BRAND}; font-weight: 600; font-size: 11px; }}
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="lab-name">{lab_name}</div>
      <div class="lab-meta">{lab_meta}</div>
    </div>
    <div class="doc-title">
      <h1>STATEMENT</h1>
      <div class="meta">
        <div><strong>{escape(invoice.invoice_number)}</strong></div>
        <div>Period: {invoice.period_start:%d %b %Y} – {invoice.period_end:%d %b %Y}</div>
        <div><span class="pill">{escape(invoice.status.replace('_', ' ').title())}</span></div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="label">Billed To</div>
      <div class="bill-name">{client_name}</div>
      <div class="bill-meta">{client_meta}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th>Description</th>
        <th class="num" style="width:60px;">Qty</th>
        <th class="num" style="width:120px;">Amount</th>
      </tr>
    </thead>
    <tbody>{rows}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="num">{_fmt(sym, invoice.subtotal)}</td></tr>
    <tr><td>{escape(tax_label.replace('No.', '').strip()) or 'Tax'} ({tax_pct}%)</td>
        <td class="num">{_fmt(sym, invoice.tax_amount)}</td></tr>
    <tr class="grand"><td>Total Due</td><td class="num">{_fmt(sym, invoice.total)}</td></tr>
    <tr><td>Paid</td><td class="num">{_fmt(sym, invoice.paid_amount)}</td></tr>
    <tr><td>Balance</td><td class="num">{_fmt(sym, invoice.due_amount)}</td></tr>
  </table>

  <div class="words">Amount in words: {words} {ccode} only</div>

  <div class="footer">
    <div>Please settle outstanding balances within agreed credit terms.</div>
    <div>This is a computer-generated statement and does not require a signature.</div>
  </div>
</body>
</html>"""
