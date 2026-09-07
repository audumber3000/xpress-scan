"""Minimal Mono invoice variant.

No colour at all, and a fully ruled item table. This is the one to reach for
when the invoice is going to be photocopied, faxed to an insurer, or filed in a
folder — a coloured band survives none of those, and a ruled grid is what makes
a scanned column of figures still readable.

The clinic's accent is deliberately ignored rather than desaturated: a template
that quietly turns a brand colour grey looks broken. Choosing this layout is
choosing black and white, and the picker says so.
"""
from domains.finance.invoice_templates._common import (
    prepare, money, logo_block, tax_rows, signature_block,
)
from domains.finance.invoice_templates.discount_block import render_discount_block


def render_invoice(invoice, clinic, config=None) -> str:
    # Prepared with a black default, then the accent is pinned to black so the
    # shared helpers (signature rule, discount block) stay monochrome too.
    d = prepare(invoice, clinic, config, default_color='#000000')
    d.primary = '#000000'

    rows = ''
    for item in d.items:
        tooth = getattr(item, 'tooth_number', '') or ''
        sac = getattr(item, 'sac_code', '') or ''
        note = ' · '.join(filter(None, [f'Tooth {tooth}' if tooth else '',
                                        f'SAC {sac}' if sac else '']))
        rows += (
            f'<tr>'
            f'<td class="c">{int(item.quantity)}</td>'
            f'<td>{item.description}{f"<div class=sub>{note}</div>" if note else ""}</td>'
            f'<td class="num">{money(d, item.unit_price)}</td>'
            f'<td class="num">{money(d, item.amount)}</td>'
            f'</tr>'
        )

    show_discount = d.vis.discount and d.discount > 0
    disc_row = (f'<tr><td colspan="3" class="lbl">Discount</td>'
                f'<td class="num">- {money(d, d.discount)}</td></tr>' if show_discount else '')
    shown_subtotal = d.subtotal if show_discount else d.taxable

    # Rendered into the same ruled table as the items, so the figures stay in
    # one column all the way down instead of restarting in a floating box.
    tax_block = ''
    if d.tax > 0:
        if d.is_india:
            half = d.tax / 2
            tax_block = (
                f'<tr><td colspan="3" class="lbl">CGST 9%</td><td class="num">{money(d, half)}</td></tr>'
                f'<tr><td colspan="3" class="lbl">SGST 9%</td><td class="num">{money(d, half)}</td></tr>'
            )
        else:
            tax_block = (f'<tr><td colspan="3" class="lbl">Tax</td>'
                         f'<td class="num">{money(d, d.tax)}</td></tr>')

    meta = ''.join(
        f'<tr><td class="k">{k}</td><td class="v">{v}</td></tr>'
        for k, v in [('Invoice #', d.number or '—'), ('Invoice Date', d.date),
                     ('Patient ID', d.patient.uhid or '—'), ('Payment', d.payment_mode)] if v
    )
    clinic_lines = ''.join(
        f'<div>{x}</div>' for x in
        [d.clinic.address, d.clinic.phone, d.clinic.email,
         (f'{d.tax_reg_label}: {d.clinic.gst}' if d.clinic.gst else '')] if x
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
@page {{ size: A4; margin: 0; }}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0;
        color:#000; font-size:11px; line-height:1.45; background:#fff; }}
.page {{ padding:44px 48px; }}
.head {{ width:100%; border-collapse:collapse; margin-bottom:34px; }}
.head td {{ vertical-align:top; }}
.clinic {{ font-size:19px; font-weight:700; letter-spacing:-.2px; }}
.addr {{ font-size:10px; color:#444; margin-top:6px; }}
.word {{ font-size:19px; font-weight:700; text-align:right; letter-spacing:.5px; }}
.parties {{ width:100%; border-collapse:collapse; margin-bottom:22px; }}
.parties td {{ vertical-align:top; width:33.33%; padding-right:16px; font-size:10.5px; color:#333; }}
.parties .lbl {{ font-weight:700; color:#000; margin-bottom:4px; font-size:10.5px; }}
.meta {{ width:100%; border-collapse:collapse; }}
.meta td {{ padding:1.5px 0; font-size:10.5px; }}
.meta .k {{ font-weight:700; text-align:right; padding-right:14px; }}
.meta .v {{ text-align:right; white-space:nowrap; color:#333; }}
table.items {{ width:100%; border-collapse:collapse; border:1px solid #999; }}
table.items th {{ background:#f2f2f2; border:1px solid #999; padding:7px 8px; font-size:10px;
  font-weight:700; text-transform:uppercase; letter-spacing:.4px; }}
table.items td {{ border:1px solid #ccc; padding:7px 8px; font-size:11px; }}
table.items td.num {{ text-align:right; white-space:nowrap; }}
table.items td.c {{ text-align:center; width:44px; }}
table.items td.lbl {{ text-align:right; font-weight:600; border-left:none; border-right:1px solid #ccc; }}
table.items tr.grand td {{ background:#f2f2f2; font-weight:700; font-size:13px; }}
.sub {{ font-size:9.5px; color:#666; margin-top:1px; }}
.terms {{ margin-top:34px; font-size:10px; color:#333; }}
.terms .lbl {{ font-weight:700; color:#000; margin-bottom:4px; }}
.foot {{ width:100%; border-collapse:collapse; margin-top:30px; }}
.foot td {{ vertical-align:bottom; }}
.clinic-footer {{ text-align:center; color:#666; font-size:9.5px; margin-top:16px;
  border-top:1px solid #ddd; padding-top:10px; }}
</style></head><body>

<div class="page">
  <table class="head"><tr>
    <td>
      <div class="clinic">{d.clinic.name}</div>
      <div class="addr">{clinic_lines}</div>
    </td>
    <td style="width:70px;text-align:right;">{logo_block(d, 46, '0')}</td>
    <td class="word" style="width:110px;">INVOICE</td>
  </tr></table>

  <table class="parties"><tr>
    <td>
      <div class="lbl">Bill To</div>
      <div>{d.patient.name or '—'}</div>
      {f'<div>{d.patient.address}</div>' if d.patient.address else ''}
      {f'<div>{d.patient.phone}</div>' if d.patient.phone else ''}
    </td>
    <td></td>
    <td><table class="meta">{meta}</table></td>
  </tr></table>

  <table class="items">
    <thead><tr>
      <th style="width:44px;">Qty</th>
      <th style="text-align:left;">Description</th>
      <th style="width:110px;">Unit Price</th>
      <th style="width:110px;">Amount</th>
    </tr></thead>
    <tbody>
      {rows}
      <tr><td colspan="3" class="lbl">Subtotal</td><td class="num">{money(d, shown_subtotal)}</td></tr>
      {disc_row}
      {tax_block}
      <tr class="grand"><td colspan="3" class="lbl">Total</td><td class="num">{money(d, d.total)}</td></tr>
    </tbody>
  </table>

  {render_discount_block(invoice, currency=d.currency, accent='#000000') if d.vis.discount else ''}

  <div class="terms">
    <div class="lbl">Terms &amp; Conditions</div>
    <div>{d.notes or 'Payment is due on receipt of this invoice.'}</div>
  </div>

  <table class="foot"><tr>
    <td style="font-size:10px;color:#666;">{d.clinic.name}</td>
    <td style="text-align:right;">{signature_block(d)}</td>
  </tr></table>

  {f'<div class="clinic-footer">{d.footer_text}</div>' if d.footer_text else ''}
</div>

</body></html>"""
