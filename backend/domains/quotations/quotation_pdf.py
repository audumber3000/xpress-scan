"""The quotation, as a document the patient can keep.

Deliberately not the invoice template with the words changed. An invoice states
what is owed; a quotation proposes what could be done and what it would cost,
and the column that matters is the patient's own share after their cover. It
also has to be readable by somebody deciding at their kitchen table rather than
by a bookkeeper reconciling.

Renders through the same weasyprint pipeline as invoices and prescriptions, so
one clinic's paperwork looks like one clinic's paperwork.
"""
from datetime import date


def _esc(v) -> str:
    return (str(v or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def render_quotation(quotation, clinic, currency="₹") -> str:
    q = quotation
    cur = currency or "₹"
    money = lambda n: f"{cur}{float(n or 0):,.2f}"

    insured = bool((q.insurance_snapshot or {}).get("covered"))
    payer = (q.insurance_snapshot or {}).get("payer_name") or ""

    rows = ""
    for i, li in enumerate(sorted(q.line_items, key=lambda x: (x.sort_order or 0, x.id or 0)), 1):
        rows += (
            "<tr>"
            f"<td class='c'>{i}</td>"
            f"<td>{_esc(li.description)}</td>"
            f"<td class='c'>{_esc(li.tooth_number) or '&ndash;'}</td>"
            f"<td class='c'>{int(li.quantity or 1)}</td>"
            f"<td class='r'>{money(li.unit_price)}</td>"
            f"<td class='r'>{money(li.amount)}</td>"
            + (f"<td class='r ins'>{money(li.insurance_estimate)}</td>" if insured else "")
            + f"<td class='r pay'>{money(li.patient_portion)}</td>"
            "</tr>"
        )

    head_ins = "<th class='r'>Insurance</th>" if insured else ""
    span = 6 if insured else 5

    # Only shown when there is cover. On an uninsured patient an "insurance"
    # column of zeros reads as a promise that was not kept.
    ins_block = ""
    if insured:
        ins_block = (
            "<div class='note'>"
            f"<strong>Estimated insurance:</strong> {money(q.insurance_estimate)}"
            f"{' through ' + _esc(payer) if payer else ''}. "
            "This is an estimate based on the cover recorded for you. "
            "The final amount is decided by your insurer."
            "</div>"
        )

    valid = q.valid_until.strftime("%d %B %Y") if q.valid_until else None

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 14mm 12mm; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 11px; }}
.hd {{ display: flex; justify-content: space-between; align-items: flex-start;
       border-bottom: 2px solid #2a276e; padding-bottom: 10px; margin-bottom: 14px; }}
.clinic {{ font-size: 17px; font-weight: bold; color: #2a276e; }}
.muted {{ color: #6b7280; }}
.title {{ text-align: right; }}
.title h1 {{ margin: 0; font-size: 20px; letter-spacing: .5px; }}
.grid {{ display: flex; gap: 14px; margin-bottom: 14px; }}
.box {{ flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px 11px; }}
.box .lbl {{ font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 4px; }}
th {{ background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: .5px;
      color: #4b5563; padding: 7px 6px; text-align: left; }}
td {{ padding: 7px 6px; border-bottom: 1px solid #f3f4f6; }}
.c {{ text-align: center; }} .r {{ text-align: right; }}
.ins {{ color: #059669; }} .pay {{ font-weight: bold; }}
.tot td {{ border-top: 2px solid #2a276e; font-weight: bold; }}
.due {{ background: #eef2ff; }}
.due td {{ font-size: 13px; font-weight: bold; color: #2a276e; padding: 9px 6px; }}
.note {{ margin-top: 12px; background: #f9fafb; border-left: 3px solid #2a276e;
         padding: 8px 11px; font-size: 10px; color: #374151; }}
.foot {{ margin-top: 18px; padding-top: 9px; border-top: 1px solid #e5e7eb;
         font-size: 9px; color: #6b7280; text-align: center; }}
</style></head><body>

<div class="hd">
  <div>
    <div class="clinic">{_esc(clinic.name if clinic else '')}</div>
    <div class="muted">{_esc(getattr(clinic, 'address', '') or '')}</div>
    <div class="muted">{_esc(getattr(clinic, 'phone', '') or '')}</div>
  </div>
  <div class="title">
    <h1>ESTIMATE</h1>
    <div class="muted">{_esc(q.quotation_number or '')}</div>
    <div class="muted">{date.today().strftime('%d %B %Y')}</div>
  </div>
</div>

<div class="grid">
  <div class="box">
    <div class="lbl">Prepared for</div>
    <div><strong>{_esc(q.patient.name if q.patient else '')}</strong></div>
    <div class="muted">{_esc(q.patient.phone if q.patient else '')}</div>
  </div>
  <div class="box">
    <div class="lbl">Valid until</div>
    <div><strong>{_esc(valid) if valid else 'No expiry'}</strong></div>
    <div class="muted">{'Prices may change after this date.' if valid else ''}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th class="c">#</th><th>Treatment</th><th class="c">Tooth / area</th>
    <th class="c">Qty</th><th class="r">Unit</th><th class="r">Amount</th>
    {head_ins}<th class="r">You pay</th>
  </tr></thead>
  <tbody>
    {rows}
    <tr class="tot">
      <td colspan="{span}" class="r">Total</td>
      <td class="r">{money(q.total)}</td>
    </tr>
    <tr class="due">
      <td colspan="{span}" class="r">Your estimated share</td>
      <td class="r">{money(q.patient_portion)}</td>
    </tr>
  </tbody>
</table>

{ins_block}
{f'<div class="note">{_esc(q.notes)}</div>' if q.notes else ''}

<div class="foot">
  This is an estimate for proposed treatment, not a bill. Nothing is charged
  until the work is agreed and carried out.
</div>
</body></html>"""
