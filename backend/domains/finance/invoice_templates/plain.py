"""Plain invoice variant, for printing onto pre-printed letterhead.

Every other variant draws the clinic: a name, a logo, an address block, usually
a band of colour. On a clinic's own headed paper all of that is already printed,
and the rest of this codebase deals with that by *suppressing* what it would
otherwise have drawn — letterhead mode switches the branding flags off and the
decorated layouts render around the hole.

This one is built for that job instead of adapted to it. There is no clinic
header to suppress, because there is none to begin with: the sheet supplies the
identity and the document supplies the content. What is left is the part a
letterhead cannot carry — who the patient is, what was done, what it cost, and
a line to sign.

That makes it the sensible default for a clinic that prints on its own paper,
and it stays honest with letterhead mode *off* too: the clinic chose a plain
layout, so it gets one, rather than the branding quietly coming back.

WeasyPrint-safe CSS only: tables for layout, no grid, no gap, no :has().
"""
from domains.finance.invoice_templates._common import (
    prepare, money, qualifications_line, signature_block,
)
from domains.infrastructure.services.pdf_fields import page_css
from domains.finance.invoice_templates.classic import _amount_in_words
from domains.finance.invoice_templates.discount_block import render_discount_block


def render_invoice(invoice, clinic, config=None) -> str:
    d = prepare(invoice, clinic, config, default_color='#111827')

    # Designed for headed paper, so the default page box is a plain printable
    # margin rather than a bleed. Letterhead mode replaces it with the four
    # measured offsets; without it, 15mm is a sane sheet on any printer.
    page_rule = page_css(d.letterhead, default_margin='15mm')

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

    tax_block = ''
    if d.tax > 0:
        if d.is_india:
            half = d.tax / 2
            tax_block = (
                f'<tr class="sum"><td class="lbl" colspan="3">CGST 9%</td>'
                f'<td class="num">{money(d, half)}</td></tr>'
                f'<tr class="sum"><td class="lbl" colspan="3">SGST 9%</td>'
                f'<td class="num">{money(d, half)}</td></tr>'
            )
        else:
            tax_block = (f'<tr class="sum"><td class="lbl" colspan="3">Tax</td>'
                         f'<td class="num">{money(d, d.tax)}</td></tr>')

    aow = _amount_in_words(d.total) if (d.is_india and d.vis.amount_in_words) else ''

    show_discount = d.vis.discount and d.discount > 0
    disc_row = (f'<tr><td class="lbl" colspan="3">Discount</td>'
                f'<td class="num">- {money(d, d.discount)}</td></tr>' if show_discount else '')
    shown_subtotal = d.subtotal if show_discount else d.taxable

    meta = ''.join(
        f'<tr><td class="k">{k}</td><td class="v">{v}</td></tr>'
        for k, v in [('Invoice #', d.number or '—'), ('Date', d.date),
                     ('Patient ID', d.patient.uhid or '—'),
                     ('Payment', d.payment_mode)] if v
    )

    # The patient's own details are content, not branding, so they survive
    # letterhead mode — they are most of the reason the document exists.
    # The signature block is told to skip the qualifications: the Attending
    # line in the header already carries them, and the same letters twice on one
    # page reads as two different doctors at a glance.
    patient_lines = ''.join(
        f'<div>{x}</div>' for x in
        [d.patient.address, d.patient.phone,
         ' · '.join(filter(None, [d.patient.age and f'{d.patient.age} yrs',
                                  d.patient.gender]))] if x
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
{page_rule}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0;
        color:#111827; font-size:11px; line-height:1.45; background:#fff; }}
.word {{ font-size:17px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }}
.top {{ width:100%; border-collapse:collapse; margin-bottom:20px; }}
.top td {{ vertical-align:top; }}
.meta {{ border-collapse:collapse; margin-left:auto; }}
.meta td {{ padding:1.5px 0; font-size:10.5px; }}
.meta .k {{ font-weight:700; text-align:right; padding-right:12px; }}
.meta .v {{ text-align:right; white-space:nowrap; color:#374151; }}
.parties {{ width:100%; border-collapse:collapse; margin-bottom:18px;
  border-top:1px solid #111827; border-bottom:1px solid #d1d5db; }}
.parties td {{ vertical-align:top; padding:10px 16px 10px 0; font-size:10.5px; color:#374151; }}
.parties .lbl {{ font-weight:700; color:#111827; margin-bottom:3px;
  text-transform:uppercase; letter-spacing:.4px; font-size:9.5px; }}
.parties .nm {{ font-size:13px; font-weight:700; color:#111827; margin-bottom:2px; }}
table.items {{ width:100%; border-collapse:collapse; }}
table.items th {{ border-bottom:1px solid #111827; padding:7px 8px; font-size:9.5px;
  font-weight:700; text-transform:uppercase; letter-spacing:.4px; text-align:left; }}
table.items th.num, table.items td.num {{ text-align:right; white-space:nowrap; }}
table.items th.c, table.items td.c {{ text-align:center; width:40px; }}
table.items td {{ border-bottom:1px solid #e5e7eb; padding:7px 8px; font-size:11px; }}
table.items td.lbl {{ text-align:right; font-weight:600; border-bottom:none; }}
table.items tr.sum td {{ border-bottom:none; padding:3px 8px; }}
table.items tr.grand td {{ border-top:1px solid #111827; border-bottom:1px solid #111827;
  font-weight:700; font-size:13px; padding:8px; }}
.sub {{ font-size:9.5px; color:#6B7280; margin-top:1px; }}
.aow {{ margin-top:10px; font-size:10px; color:#374151; font-style:italic; }}
.notes {{ margin-top:22px; font-size:10px; color:#374151; }}
.notes .lbl {{ font-weight:700; color:#111827; margin-bottom:3px; }}
.foot {{ width:100%; border-collapse:collapse; margin-top:34px; }}
.foot td {{ vertical-align:bottom; }}
.disclaimer {{ text-align:center; color:#6B7280; font-size:9.5px; margin-top:18px;
  border-top:1px solid #e5e7eb; padding-top:9px; }}
</style></head><body>

<!-- No clinic header by design: this layout exists for paper that already
     carries one. See the module docstring. -->
<table class="top"><tr>
  <td class="word">Invoice</td>
  <td style="width:210px;"><table class="meta">{meta}</table></td>
</tr></table>

<table class="parties"><tr>
  <td style="width:60%;">
    <div class="lbl">Billed to</div>
    <div class="nm">{d.patient.name or '—'}</div>
    {patient_lines}
  </td>
  <td>
    {f'<div class="lbl">Attending</div><div>{d.doctor_name}</div>'
       + qualifications_line(d.doctor_qualifications) if d.doctor_name else ''}
  </td>
</tr></table>

<table class="items">
  <tr><th class="c">Qty</th><th>Description</th>
      <th class="num">Rate</th><th class="num">Amount</th></tr>
  {rows}
  <tr class="sum"><td class="lbl" colspan="3">Subtotal</td>
      <td class="num">{money(d, shown_subtotal)}</td></tr>
  {disc_row}
  {tax_block}
  <tr class="grand"><td class="lbl" colspan="3">Total</td>
      <td class="num">{money(d, d.total)}</td></tr>
</table>

{f'<div class="aow">{aow}</div>' if aow else ''}

{render_discount_block(invoice, d.currency, d.primary)}

{f'<div class="notes"><div class="lbl">Notes</div>{d.notes}</div>' if d.notes else ''}

<table class="foot"><tr>
  <td></td>
  <td style="width:200px;">{signature_block(d, with_qualifications=False)}</td>
</tr></table>

{f'<div class="disclaimer">{d.footer_text}</div>' if d.footer_text else ''}

</body></html>"""
