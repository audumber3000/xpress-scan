"""Bold invoice variant.

An oversized INVOICE wordmark under a full-height accent rule down the left
edge, with the parties and the invoice facts sitting in four columns beneath it.
The total is the only other thing allowed to be large, and it is the one figure
anybody looks for first.

The left rule is structural rather than decorative: it gives the page an anchor
without a header band, so the letterhead stays white and a logo printed on it
sits on the same ground as the rest of the document.
"""
from domains.finance.invoice_templates._common import (
    prepare, money, logo_block, tax_rows, signature_block,
)
from domains.infrastructure.services.pdf_fields import (
    page_css,
)
from domains.finance.invoice_templates.discount_block import render_discount_block


def render_invoice(invoice, clinic, config=None) -> str:
    d = prepare(invoice, clinic, config, default_color='#1F3864')

    # This layout bleeds to the paper edge, so its normal page box is margin 0.
    # On pre-printed stationery that is exactly wrong — the content would land
    # under the clinic's printed header — so the resolved letterhead supplies
    # the margins instead. `prepare` has already stripped the branding itself.
    page_rule = page_css(d.letterhead, default_margin='0')

    rows = ''
    for item in d.items:
        tooth = getattr(item, 'tooth_number', '') or ''
        tooth_note = f'<div class="sub">Tooth {tooth}</div>' if tooth else ''
        rows += (
            f'<tr>'
            f'<td class="qty">{int(item.quantity)}</td>'
            f'<td>{item.description}{tooth_note}</td>'
            f'<td class="num">{money(d, item.unit_price)}</td>'
            f'<td class="num">{money(d, item.amount)}</td>'
            f'</tr>'
        )

    show_discount = d.vis.discount and d.discount > 0
    disc_row = (f'<tr><td>Discount</td><td class="num">- {money(d, d.discount)}</td></tr>'
                if show_discount else '')
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
        f'<div>{x}</div>' for x in
        [d.clinic.address, d.clinic.phone, d.clinic.email,
         (f'{d.tax_reg_label}: {d.clinic.gst}' if d.clinic.gst else '')] if x
    )
    patient_lines = ''.join(f'<div>{x}</div>' for x in [d.patient.address, d.patient.phone] if x)
    age_gender = ' · '.join(filter(None, [d.patient.age, d.patient.gender]))

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
{page_rule}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0;
        color:#2b2b2b; font-size:11px; line-height:1.45; background:#fff; }}
.rule {{ position:fixed; left:0; top:0; bottom:0; width:14px; background:{d.primary}; }}
.page {{ padding:34px 44px 40px 54px; }}
.head {{ width:100%; border-collapse:collapse; margin-bottom:26px; }}
.head td {{ vertical-align:top; }}
.wordmark {{ font-size:52px; font-weight:800; letter-spacing:-1.5px; line-height:.95;
  color:{d.primary}; text-transform:uppercase; }}
.tagline {{ font-size:10.5px; color:#7a7a7a; margin-top:6px; letter-spacing:.4px; }}
.cols {{ width:100%; border-collapse:collapse; margin-bottom:30px; }}
.cols td {{ vertical-align:top; width:25%; padding-right:16px; font-size:10.5px; color:#6a6a6a; }}
.cols .lbl {{ font-size:11px; font-weight:800; letter-spacing:.3px; color:{d.primary};
  text-transform:uppercase; margin-bottom:6px; }}
.cols .who {{ color:#2b2b2b; font-weight:600; margin-bottom:2px; }}
.meta {{ width:100%; border-collapse:collapse; }}
.meta td {{ padding:1.5px 0; font-size:10.5px; }}
.meta .k {{ font-weight:800; color:{d.primary}; text-transform:uppercase; letter-spacing:.3px; }}
.meta .v {{ text-align:right; color:#6a6a6a; white-space:nowrap; }}
table.items {{ width:100%; border-collapse:collapse; }}
table.items thead th {{ font-size:11px; font-weight:800; color:{d.primary}; text-transform:uppercase;
  letter-spacing:.3px; text-align:right; padding:0 0 7px 0; border-left:3px solid {d.primary};
  padding-left:8px; }}
table.items thead th.l {{ text-align:left; }}
table.items tbody td {{ padding:8px 0 8px 8px; font-size:11px; border-bottom:1px solid #f0f0f0; }}
table.items td.num, table.items td.qty {{ text-align:right; white-space:nowrap; }}
table.items td.qty {{ text-align:center; width:46px; }}
.sub {{ font-size:9.5px; color:#9a9a9a; margin-top:1px; }}
.sum {{ width:48%; margin-left:auto; margin-top:14px; border-collapse:collapse; }}
.sum td {{ padding:4px 0; font-size:11px; color:#6a6a6a; }}
.sum td.num {{ text-align:right; color:#2b2b2b; white-space:nowrap; }}
.sum tr.grand td {{ padding-top:10px; font-size:17px; font-weight:800; color:{d.primary};
  text-transform:uppercase; }}
.sum tr.grand td.num {{ color:#C0392B; }}
.terms {{ margin-top:44px; font-size:10px; color:#6a6a6a; }}
.terms .lbl {{ font-size:11px; font-weight:800; letter-spacing:.3px; color:{d.primary};
  text-transform:uppercase; margin-bottom:5px; }}
.foot {{ width:100%; border-collapse:collapse; margin-top:26px; }}
.foot td {{ vertical-align:bottom; }}
.clinic-footer {{ text-align:center; color:#a5a5a5; font-size:9.5px; margin-top:16px;
  border-top:1px solid #f0f0f0; padding-top:10px; }}
</style></head><body>

<div class="rule"></div>
<div class="page">

  <table class="head"><tr>
    <td>
      <div class="wordmark">Invoice</div>
      {f'<div class="tagline">{d.clinic.tagline}</div>' if d.clinic.tagline else ''}
    </td>
    {f'<td style="text-align:right;width:70px;">{logo_block(d, 62, "50%")}</td>' if d.vis.logo else ''}
  </tr></table>

  <table class="cols"><tr>
    <td>
      <div class="lbl">From</div>
      {f'<div class="who">{d.clinic.name}</div>' if d.clinic.name else ''}
      {clinic_lines}
    </td>
    <td>
      <div class="lbl">Bill To</div>
      <div class="who">{d.patient.name or '—'}</div>
      {patient_lines}
      {f'<div>{age_gender}</div>' if age_gender else ''}
    </td>
    <td colspan="2"><table class="meta">{meta}</table></td>
  </tr></table>

  <table class="items">
    <thead><tr>
      <th class="l" style="width:46px;">Qty</th>
      <th class="l">Description</th>
      <th style="width:110px;">Unit Price</th>
      <th style="width:110px;">Amount</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <table class="sum">
    <tr><td>Subtotal</td><td class="num">{money(d, shown_subtotal)}</td></tr>
    {disc_row}
    {tax_rows(d, value_cls='num')}
    <tr class="grand"><td>Total</td><td class="num">{money(d, d.total)}</td></tr>
  </table>

  {render_discount_block(invoice, currency=d.currency, accent=d.primary) if d.vis.discount else ''}

  <div class="terms">
    <div class="lbl">Terms &amp; Conditions</div>
    <div>{d.notes or 'Payment is due on receipt of this invoice.'}</div>
  </div>

  <table class="foot"><tr>
    <td style="font-size:10px;color:#9a9a9a;">{d.clinic.name}{f' · {d.clinic.phone}' if d.clinic.phone else ''}</td>
    <td style="text-align:right;">{signature_block(d)}</td>
  </tr></table>

  {f'<div class="clinic-footer">{d.footer_text}</div>' if d.footer_text else ''}
</div>

</body></html>"""
