"""Corporate invoice variant.

The layout an accountant expects: a solid BILL TO header bar, a striped item
table with a ruled amount column, and a boxed notes panel opposite the totals.
Closest to the spreadsheet invoices most practices are migrating off, which is
the point — a clinic that switches to us should be able to hand its accountant
something that looks like what they were sending last month.

Striping rather than full ruling: on a long list of treatments the alternating
band is what keeps the eye on one row across the page, and it survives
photocopying better than a hairline grid.
"""
from domains.finance.invoice_templates._common import (
    prepare, money, logo_block, tax_rows, signature_block,
)
from domains.infrastructure.services.pdf_fields import (
    page_css,
)
from domains.finance.invoice_templates.discount_block import render_discount_block


def render_invoice(invoice, clinic, config=None) -> str:
    d = prepare(invoice, clinic, config, default_color='#44546A')

    # This layout bleeds to the paper edge, so its normal page box is margin 0.
    # On pre-printed stationery that is exactly wrong — the content would land
    # under the clinic's printed header — so the resolved letterhead supplies
    # the margins instead. `prepare` has already stripped the branding itself.
    page_rule = page_css(d.letterhead, default_margin='0')

    rows = ''
    for i, item in enumerate(d.items):
        tooth = getattr(item, 'tooth_number', '') or ''
        note = f' <span class="sub">(Tooth {tooth})</span>' if tooth else ''
        rows += (
            f'<tr class="{"odd" if i % 2 else ""}">'
            f'<td>{item.description}{note}</td>'
            f'<td class="c">{int(item.quantity)}</td>'
            f'<td class="num">{money(d, item.unit_price)}</td>'
            f'<td class="num">{money(d, item.amount)}</td>'
            f'</tr>'
        )
    # Blank rows so the table keeps its shape on a short invoice. A two-line
    # bill with a table that stops dead looks unfinished next to a ten-line one.
    for i in range(len(d.items), max(len(d.items), 6)):
        rows += (f'<tr class="{"odd" if i % 2 else ""}">'
                 f'<td>&nbsp;</td><td></td><td></td><td></td></tr>')

    show_discount = d.vis.discount and d.discount > 0
    disc_row = (f'<tr><td class="k">Discount</td><td class="v">- {money(d, d.discount)}</td></tr>'
                if show_discount else '')
    shown_subtotal = d.subtotal if show_discount else d.taxable

    meta = ''.join(
        f'<tr><td class="k">{k}</td><td class="v">{v}</td></tr>'
        for k, v in [('DATE', d.date), ('INVOICE #', d.number or '—'),
                     ('PATIENT ID', d.patient.uhid or '—'), ('PAYMENT', d.payment_mode)] if v
    )
    clinic_lines = ''.join(
        f'<div>{x}</div>' for x in
        [d.clinic.address, (f'Phone: {d.clinic.phone}' if d.clinic.phone else ''), d.clinic.email,
         (f'{d.tax_reg_label}: {d.clinic.gst}' if d.clinic.gst else '')] if x
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
{page_rule}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0;
        color:#333; font-size:10.5px; line-height:1.45; background:#fff; }}
.page {{ padding:34px 40px 40px 40px; }}
.head {{ width:100%; border-collapse:collapse; margin-bottom:22px; }}
.head td {{ vertical-align:top; }}
.clinic {{ font-size:22px; font-weight:600; color:{d.primary}; letter-spacing:-.2px; }}
.addr {{ font-size:9.5px; color:#555; margin-top:5px; }}
.word {{ font-size:26px; font-weight:800; color:{d.primary}; text-align:right;
  letter-spacing:.5px; text-transform:uppercase; }}
.meta {{ width:auto; margin-left:auto; margin-top:8px; border-collapse:collapse; }}
.meta td {{ padding:1.5px 0; font-size:9.5px; }}
.meta .k {{ text-align:right; color:#666; letter-spacing:.6px; padding-right:12px; }}
.meta .v {{ text-align:right; background:#eef1f5; padding:1.5px 7px; white-space:nowrap;
  font-weight:600; color:#333; }}
.billbar {{ background:{d.primary}; color:#fff; font-size:10px; font-weight:700;
  letter-spacing:1px; padding:4px 9px; text-transform:uppercase; width:46%; }}
.billbox {{ font-size:10.5px; color:#333; padding:8px 9px 0 9px; }}
table.items {{ width:100%; border-collapse:collapse; margin-top:20px; border:1px solid {d.primary}; }}
table.items th {{ background:{d.primary}; color:#fff; padding:6px 9px; font-size:10px;
  font-weight:700; letter-spacing:.7px; text-transform:uppercase; text-align:right; }}
table.items th.l {{ text-align:left; }}
table.items td {{ padding:5.5px 9px; font-size:10.5px; border-bottom:1px solid #e4e8ee; }}
table.items tr.odd td {{ background:#f5f7fa; }}
table.items td.num {{ text-align:right; white-space:nowrap; }}
table.items td.c {{ text-align:center; width:50px; }}
.sub {{ color:#7b8794; font-size:9.5px; }}
.lower {{ width:100%; border-collapse:collapse; margin-top:16px; }}
.lower td {{ vertical-align:top; }}
.notes {{ border:1px solid {d.primary}; }}
.notes .bar {{ background:{d.primary}; color:#fff; font-size:10px; font-weight:700;
  letter-spacing:1px; padding:4px 9px; text-transform:uppercase; }}
.notes .in {{ padding:8px 9px; font-size:10px; color:#555; }}
.sum {{ width:100%; border-collapse:collapse; }}
.sum td {{ padding:4px 9px; font-size:10.5px; border-bottom:1px solid #e4e8ee; }}
.sum td.k {{ color:#555; }}
.sum td.v {{ text-align:right; white-space:nowrap; }}
.sum tr.grand td {{ background:#eef1f5; font-weight:800; font-size:12.5px; color:{d.primary};
  border-bottom:2px solid {d.primary}; }}
.thanks {{ text-align:center; font-size:10px; color:#555; margin-top:26px; }}
.thanks em {{ font-weight:700; font-style:italic; color:{d.primary}; }}
.clinic-footer {{ text-align:center; color:#8a949f; font-size:9.5px; margin-top:14px;
  border-top:1px solid #e4e8ee; padding-top:9px; }}
</style></head><body>

<div class="page">
  <table class="head"><tr>
    {f'<td style="width:64px;">{logo_block(d, 54, "4px")}</td>' if d.vis.logo else ''}
    <td style="padding-left:12px;">
      {f'<div class="clinic">{d.clinic.name}</div>' if d.clinic.name else ''}
      <div class="addr">{clinic_lines}</div>
    </td>
    <td style="width:250px;">
      <div class="word">Invoice</div>
      <table class="meta">{meta}</table>
    </td>
  </tr></table>

  <table style="width:100%;border-collapse:collapse;"><tr><td>
    <div class="billbar">Bill To</div>
    <div class="billbox">
      <div style="font-weight:600;color:#222;">{d.patient.name or '—'}</div>
      {f'<div>{d.patient.address}</div>' if d.patient.address else ''}
      {f'<div>{d.patient.phone}</div>' if d.patient.phone else ''}
    </div>
  </td></tr></table>

  <table class="items">
    <thead><tr>
      <th class="l">Description</th>
      <th style="width:50px;">Qty</th>
      <th style="width:110px;">Unit Price</th>
      <th style="width:115px;">Amount</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <table class="lower"><tr>
    <td style="width:52%;padding-right:18px;">
      <div class="notes">
        <div class="bar">Other Comments</div>
        <div class="in">
          {d.notes or 'Payment is due on receipt of this invoice.'}
          {f'<div style="margin-top:5px;">Please quote invoice {d.number} with your payment.</div>' if d.number else ''}
        </div>
      </div>
    </td>
    <td>
      <table class="sum">
        <tr><td class="k">Subtotal</td><td class="v">{money(d, shown_subtotal)}</td></tr>
        {disc_row}
        {tax_rows(d, label_cls='k', value_cls='v')}
        <tr class="grand"><td class="k">TOTAL</td><td class="v">{money(d, d.total)}</td></tr>
      </table>
      <div style="margin-top:18px;">{signature_block(d)}</div>
    </td>
  </tr></table>

  {render_discount_block(invoice, currency=d.currency, accent=d.primary) if d.vis.discount else ''}

  <div class="thanks">
    {f'If you have any questions about this invoice, please contact {d.clinic.name}' + (f' on {d.clinic.phone}' if d.clinic.phone else '') + '.' if d.clinic.name else 'If you have any questions about this invoice, please contact us.'}<br>
    <em>Thank you for your visit.</em>
  </div>

  {f'<div class="clinic-footer">{d.footer_text}</div>' if d.footer_text else ''}
</div>

</body></html>"""
