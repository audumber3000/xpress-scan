"""Banded invoice variant.

A full-width accent band across the head, carrying the word INVOICE on the left
and the four facts that identify it on the right. Everything below is white and
unruled: the band does the work of separating the document from the page, so the
body needs no boxes.

Suits a clinic whose brand colour is the point. The band is the only place the
colour appears at full strength, which is what keeps it from reading as a
template rather than as their letterhead.

WeasyPrint-safe CSS only: tables for layout, no grid, no gap, no :has().
"""
from domains.finance.invoice_templates._common import (
    prepare, money, logo_block, tax_rows, signature_block,
)
from domains.infrastructure.services.pdf_fields import (
    page_css,
)
from domains.finance.invoice_templates.discount_block import render_discount_block


def render_invoice(invoice, clinic, config=None) -> str:
    d = prepare(invoice, clinic, config, default_color='#3D8EA8')

    # This layout bleeds to the paper edge, so its normal page box is margin 0.
    # On pre-printed stationery that is exactly wrong — the content would land
    # under the clinic's printed header — so the resolved letterhead supplies
    # the margins instead. `prepare` has already stripped the branding itself.
    page_rule = page_css(d.letterhead, default_margin='0')

    rows = ''
    for item in d.items:
        tooth = getattr(item, 'tooth_number', '') or ''
        tooth_note = (f'<div class="sub">Tooth {tooth}</div>' if tooth else '')
        rows += (
            f'<tr>'
            f'<td class="desc">{item.description}{tooth_note}</td>'
            f'<td class="num">{money(d, item.unit_price)}</td>'
            f'<td class="num">{int(item.quantity)}</td>'
            f'<td class="num strong">{money(d, item.amount)}</td>'
            f'</tr>'
        )

    show_discount = d.vis.discount and d.discount > 0
    disc_row = (f'<tr><td>Discount</td><td class="num">- {money(d, d.discount)}</td></tr>'
                if show_discount else '')
    # With the discount hidden, the subtotal must already be net of it or the
    # column stops adding up to the total the patient is asked to pay.
    shown_subtotal = d.subtotal if show_discount else d.taxable

    meta = ''.join(
        f'<tr><td class="k">{k}</td><td class="v">{v}</td></tr>'
        for k, v in [
            ('INVOICE #', d.number or '—'),
            ('INVOICE DATE', d.date),
            ('PATIENT ID', d.patient.uhid or '—'),
            ('PAYMENT', d.payment_mode),
        ] if v
    )

    clinic_lines = ''.join(
        f'<div>{line}</div>' for line in
        [d.clinic.address, d.clinic.phone, d.clinic.email,
         (f'{d.tax_reg_label}: {d.clinic.gst}' if d.clinic.gst else ''),
         (f'Reg: {d.clinic.reg}' if d.clinic.reg else '')]
        if line
    )
    patient_lines = ''.join(
        f'<div>{line}</div>' for line in [d.patient.address, d.patient.phone] if line
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
{page_rule}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0;
        color:#243746; font-size:11.5px; line-height:1.45; background:#fff; }}
.band {{ background:{d.primary}; color:#fff; padding:26px 40px 22px 40px; }}
.band table {{ width:100%; border-collapse:collapse; }}
.band td {{ vertical-align:top; }}
.wordmark {{ font-size:40px; font-weight:300; letter-spacing:1px; line-height:1; }}
.band .sub {{ font-size:11px; opacity:.85; margin-top:6px; }}
.meta {{ width:auto; margin-left:auto; }}
.meta td {{ padding:1.5px 0; font-size:10px; }}
.meta .k {{ text-align:right; opacity:.8; letter-spacing:.8px; padding-right:16px; }}
.meta .v {{ text-align:right; font-weight:700; white-space:nowrap; }}
.body {{ padding:26px 40px 40px 40px; }}
.parties {{ width:100%; border-collapse:collapse; margin-bottom:26px; }}
.parties td {{ vertical-align:top; width:33.33%; padding-right:18px; font-size:11px; color:#4a5b6b; }}
.parties .lbl {{ font-size:9px; letter-spacing:1.2px; color:#8a99a8; margin-bottom:5px; }}
.parties .who {{ font-weight:700; color:#243746; font-size:12.5px; margin-bottom:3px; }}
.total-cell {{ text-align:right; }}
.total-cell .amt {{ font-size:26px; font-weight:300; color:{d.primary}; line-height:1.1; }}
table.items {{ width:100%; border-collapse:collapse; }}
table.items thead th {{ font-size:9.5px; letter-spacing:1px; color:{d.primary};
  text-align:right; padding:0 0 8px 0; border-bottom:1.5px solid {d.primary}; font-weight:700; }}
table.items thead th.l {{ text-align:left; }}
table.items td {{ padding:9px 0; border-bottom:1px solid #eef1f4; font-size:11.5px; }}
table.items td.num {{ text-align:right; white-space:nowrap; }}
table.items td.strong {{ font-weight:700; }}
.desc .sub {{ font-size:9.5px; color:#8a99a8; margin-top:1px; }}
.sum {{ width:52%; margin-left:auto; margin-top:16px; border-collapse:collapse; }}
.sum td {{ padding:5px 0; font-size:11.5px; color:#4a5b6b; }}
.sum td.num {{ text-align:right; white-space:nowrap; color:#243746; }}
.sum tr.grand td {{ border-top:1.5px solid {d.primary}; padding-top:10px;
  font-size:15px; font-weight:700; color:{d.primary}; }}
.foot {{ margin-top:38px; width:100%; border-collapse:collapse; }}
.foot td {{ vertical-align:bottom; font-size:10px; color:#7c8b99; }}
.note {{ margin-top:22px; font-size:10.5px; color:#5d6d7c; }}
.note .lbl {{ font-size:9px; letter-spacing:1.2px; color:#8a99a8; margin-bottom:3px; }}
.clinic-footer {{ text-align:center; color:#9aa7b3; font-size:9.5px;
  margin-top:18px; border-top:1px solid #eef1f4; padding-top:10px; }}
</style></head><body>

<div class="band">
  <table><tr>
    <td>
      <div class="wordmark">INVOICE</div>
      {f'<div class="sub">{d.clinic.name}</div>' if d.clinic.name else ''}
    </td>
    {f'<td style="text-align:right;width:56px;">{logo_block(d, 52, "4px", on_dark=True)}</td>' if d.vis.logo else ''}
    <td style="width:230px;"><table class="meta">{meta}</table></td>
  </tr></table>
</div>

<div class="body">
  <table class="parties"><tr>
    <td>
      <div class="lbl">FROM</div>
      {f'<div class="who">{d.clinic.name}</div>' if d.clinic.name else ''}
      {clinic_lines}
    </td>
    <td>
      <div class="lbl">BILL TO</div>
      <div class="who">{d.patient.name or '—'}</div>
      {patient_lines}
    </td>
    <td class="total-cell">
      <div class="lbl">INVOICE TOTAL</div>
      <div class="amt">{money(d, d.total)}</div>
    </td>
  </tr></table>

  <table class="items">
    <thead><tr>
      <th class="l">DESCRIPTION</th><th>UNIT PRICE</th><th>QTY</th><th>AMOUNT</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <table class="sum">
    <tr><td>Subtotal</td><td class="num">{money(d, shown_subtotal)}</td></tr>
    {disc_row}
    {tax_rows(d, value_cls='num')}
    <tr class="grand"><td>TOTAL</td><td class="num">{money(d, d.total)}</td></tr>
  </table>

  {render_discount_block(invoice, currency=d.currency, accent=d.primary) if d.vis.discount else ''}

  {f'<div class="note"><div class="lbl">NOTES</div>{d.notes}</div>' if d.notes else ''}

  <table class="foot"><tr>
    <td>{f'Thank you for choosing {d.clinic.name}.' if d.clinic.name else 'Thank you for your visit.'}</td>
    <td style="text-align:right;">{signature_block(d)}</td>
  </tr></table>

  {f'<div class="clinic-footer">{d.footer_text}</div>' if d.footer_text else ''}
</div>

</body></html>"""
