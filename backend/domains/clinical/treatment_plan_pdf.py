"""The treatment plan, written for the patient to take home.

A companion to summary_pdf.py, and deliberately a different document. The visit
summary says what happened; this says what is proposed, and what it is likely to
cost. That difference is the whole reason it carries money at all — the patient
is being asked to agree to something, and a plan handed over without fees is a
plan they cannot say yes to.

It is not a bill and does not pretend to be one. It carries no invoice number,
nothing is payable on it, and it says so on its face. A patient who wants a
formal proposal they can accept or decline gets a quotation, which is a
different object with its own status.

Tooth numbers are converted to FDI on the way out, matching the chart the
patient was shown in the chair.
"""

from domains.clinical.tooth_notation import universal_to_fdi, format_surfaces

_STATUS_LABEL = {
    "planned": "Planned",
    "in-progress": "In progress",
    "completed": "Completed",
}


def _esc(v) -> str:
    return (str(v or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _teeth_label(item) -> str:
    """A per-tooth procedure names one tooth; a combined one (a quadrant
    scaling, say) names several. Neither is 'General' — that is the third case,
    work with no tooth at all.

    Surfaces come along when the procedure records them, named for the tooth
    they sit on: an anterior composite reads ID, never OD."""
    teeth = item.get("teeth")
    tooth = item.get("tooth")
    if isinstance(teeth, list) and teeth:
        label = ", ".join(str(universal_to_fdi(t)) for t in teeth)
        anchor = teeth[0]
    elif tooth not in (None, "", []):
        label = str(universal_to_fdi(tooth))
        anchor = tooth
    else:
        return "General"

    written = format_surfaces(anchor, item.get("surfaces"))
    return f"{label} ({written})" if written else label


def _money(amount, currency) -> str:
    try:
        return f"{currency}{float(amount or 0):,.0f}"
    except (TypeError, ValueError):
        return f"{currency}0"


def _plan_items(case_paper):
    """The snapshot is JSON-or-JSON-string, the same as every other clinical
    field on this record."""
    raw = getattr(case_paper, "treatment_plan_snapshot", None)
    if isinstance(raw, str):
        try:
            import json
            raw = json.loads(raw)
        except Exception:
            return []
    return [i for i in raw if isinstance(i, dict)] if isinstance(raw, list) else []


def render_treatment_plan(case_paper, clinic, patient, dentist_name="", currency="₹") -> str:
    cp = case_paper
    when = cp.date.strftime("%d %B %Y") if cp.date else ""
    items = _plan_items(cp)

    rows = []
    total = 0.0
    for item in items:
        qty = item.get("qty") or 1
        try:
            qty = max(1, int(qty))
        except (TypeError, ValueError):
            qty = 1

        cost = item.get("cost")
        has_fee = cost not in (None, "")
        try:
            unit = float(cost) if has_fee else 0.0
        except (TypeError, ValueError):
            unit, has_fee = 0.0, False

        line = unit * qty
        total += line

        status = _STATUS_LABEL.get(str(item.get("status") or "planned").lower(), "Planned")
        # A fee nobody has set is left blank rather than printed as zero. A
        # patient reading "0" reasonably concludes the procedure is free.
        fee_cell = _money(unit, currency) if has_fee else "<span class='tbd'>To be confirmed</span>"
        total_cell = _money(line, currency) if has_fee else "<span class='tbd'>—</span>"

        rows.append(
            "<tr>"
            f"<td class='tooth'>{_esc(_teeth_label(item))}</td>"
            f"<td><strong>{_esc(item.get('procedure') or 'Procedure')}</strong>"
            + (f"<div class='diag'>{_esc(item.get('diagnosis'))}</div>" if item.get("diagnosis") else "")
            + "</td>"
            f"<td class='status'>{_esc(status)}</td>"
            f"<td class='num'>{qty}</td>"
            f"<td class='num'>{fee_cell}</td>"
            f"<td class='num'>{total_cell}</td>"
            "</tr>"
        )

    body = "".join(rows) or (
        "<tr><td colspan='6' class='empty'>No procedures have been planned yet.</td></tr>"
    )

    clinician = _esc(dentist_name or "")
    patient_name = _esc(getattr(patient, "name", "") or "")
    age = getattr(patient, "age", None)

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 16mm 14mm; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 11.5px; line-height: 1.55; }}
.hd {{ display: flex; justify-content: space-between; align-items: flex-start;
       border-bottom: 2px solid #2a276e; padding-bottom: 10px; margin-bottom: 16px; }}
.clinic {{ font-size: 17px; font-weight: bold; color: #2a276e; }}
.muted {{ color: #6b7280; font-size: 10px; }}
.title {{ text-align: right; }}
.title h1 {{ margin: 0; font-size: 18px; letter-spacing: .5px; }}
.who {{ border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px 12px; margin-bottom: 16px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 4px; }}
th {{ text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .7px;
      color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 0 8px 6px; }}
td {{ padding: 9px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }}
td.num, th.num {{ text-align: right; white-space: nowrap; }}
td.tooth {{ font-weight: bold; white-space: nowrap; }}
td.status {{ color: #6b7280; white-space: nowrap; }}
.diag {{ color: #6b7280; font-size: 10px; margin-top: 1px; }}
.tbd {{ color: #9ca3af; font-style: italic; }}
.empty {{ text-align: center; color: #9ca3af; padding: 22px 0; }}
tr.total td {{ border-bottom: none; border-top: 2px solid #2a276e; padding-top: 10px;
               font-size: 13px; font-weight: bold; }}
.note {{ background: #eef2ff; border-left: 3px solid #2a276e; padding: 10px 12px;
         border-radius: 4px; margin-top: 18px; font-size: 10.5px; }}
.foot {{ margin-top: 22px; padding-top: 9px; border-top: 1px solid #e5e7eb;
         font-size: 9px; color: #6b7280; text-align: center; }}
</style></head><body>

<div class="hd">
  <div>
    <div class="clinic">{_esc(clinic.name if clinic else '')}</div>
    <div class="muted">{_esc(getattr(clinic, 'address', '') or '')}</div>
    <div class="muted">{_esc(getattr(clinic, 'phone', '') or '')}</div>
  </div>
  <div class="title">
    <h1>TREATMENT PLAN</h1>
    <div class="muted">{_esc(when)}</div>
  </div>
</div>

<div class="who">
  <strong>{patient_name}</strong>
  {f"<span class='muted'> &nbsp;·&nbsp; {age}y</span>" if age else ""}
  {f"<span class='muted'> &nbsp;·&nbsp; planned by {clinician}</span>" if clinician else ""}
</div>

<table>
  <thead>
    <tr>
      <th>Tooth</th><th>Procedure</th><th>Status</th>
      <th class="num">Qty</th><th class="num">Fee</th><th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    {body}
    {f"<tr class='total'><td colspan='5'>Estimated total</td><td class='num'>{_money(total, currency)}</td></tr>" if items else ""}
  </tbody>
</table>

<div class="note">
  <strong>This is an estimate, not a bill.</strong> Nothing here is payable yet.
  Fees are what we expect the work to cost today, and they can change if the
  treatment does. We will always tell you before anything changes.
</div>

<div class="foot">
  Treatment plan prepared on {_esc(when)}. Keep it for your records, and call us
  with any question about it, however small.
</div>
</body></html>"""
