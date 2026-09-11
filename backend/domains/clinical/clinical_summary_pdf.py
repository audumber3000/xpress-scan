"""The whole visit on paper: chart, findings, plan, medicines, perio.

Distinct from the two documents that already exist, and deliberately so:

  * summary_pdf.py is written FOR THE PATIENT — no prices, no chart, no
    history, because it goes over WhatsApp and may be read by whoever picks
    up the phone.
  * treatment_plan_pdf.py is one proposal, priced.
  * this is the CLINICAL record — everything, for a colleague, a specialist
    referral, an insurer, or the file.

Two things drive the layout. Allergies and medical conditions sit in a red band
at the top of page one, because that is the one thing on here that can hurt
somebody if it is missed. And the legend under the chart lists only the symbols
that actually appear on THIS chart, so it stays four or five rows a doctor will
read rather than seventeen they will skip.
"""
from datetime import datetime

from domains.clinical.tooth_notation import universal_to_fdi, format_surfaces


# ── plumbing ──────────────────────────────────────────────────────────────

def _esc(v) -> str:
    return (str(v or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _as_list(value):
    """Clinical list fields are stored as a list, a JSON string, or plain text."""
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    if isinstance(value, dict):
        return [str(v) for v in value.values() if v]
    raw = str(value).strip()
    if raw.startswith("["):
        try:
            import json
            return _as_list(json.loads(raw))
        except Exception:
            return [raw]
    return [raw] if raw else []


def _as_text(value) -> str:
    return ", ".join(_as_list(value))


def _json_obj(value, default):
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str) and value.strip():
        try:
            import json
            return json.loads(value)
        except Exception:
            return default
    return default


def _money(amount, currency) -> str:
    try:
        return f"{currency}{float(amount or 0):,.0f}"
    except (TypeError, ValueError):
        return f"{currency}0"


def _section(title, body_html) -> str:
    """A section, or nothing at all. An empty section is a heading followed by
    a gap, which reads as data that failed to load rather than data that was
    never entered."""
    if not body_html:
        return ""
    return f"<section class='sec'><h2>{_esc(title)}</h2>{body_html}</section>"


def _pills(values) -> str:
    if not values:
        return ""
    return "<div class='pills'>" + "".join(
        f"<span class='pill'>{_esc(v)}</span>" for v in values) + "</div>"


# ── the chart's vocabulary, for the legend ────────────────────────────────
# Only what a tooth on THIS chart is actually carrying gets a row.

STATUS_LEGEND = {
    "missing": ("Missing / extracted", "A black cross through the tooth"),
    "to_extract": ("To be extracted", "A red diagonal through the tooth"),
    "impacted": ("Impacted", "Diagonal hatching over the tooth"),
    "fractured": ("Fractured", "A red zigzag on the crown"),
    "planned": ("Planned work", "Shaded amber, with a dashed ring"),
    "existing": ("Existing work", "Filled blue"),
    "implant": ("Implant", "A screw symbol"),
    "rootCanal": ("Root canal", "Two red canal lines"),
    "post_core": ("Post and core", "A red post down the canal"),
    "crown_gold": ("Gold crown", "Red diagonal hatch"),
    "crown_porcelain": ("Porcelain crown", "Ivory fill, red outline"),
    "crown_ss": ("Stainless steel crown", "Marked SS"),
    "veneer": ("Veneer", "A red band across the facing"),
    "bridge": ("Fixed bridge", "Hatched, joined by a bar"),
}

MARK_LEGEND = {
    "sealant": ("Sealant", "Marked S on the biting surface"),
    "abscess": ("Periapical abscess", "A red ring at the root apex"),
    "drifting": ("Drifting", "A red arrow showing the movement"),
    "diastema_mesial": ("Diastema", "Two red uprights in the gap"),
    "diastema_distal": ("Diastema", "Two red uprights in the gap"),
}

CONDITION_WORDS = {"missing": "Missing / extracted", "impacted": "Impacted", "fractured": "Fractured"}

# The tooth's own `conditions` list, as words. Mirrors CONDITION_GROUPS in
# frontend/src/components/patient/dentalConstants.js — the four that live
# elsewhere (impacted, fractured, missing, periapical abscess) are absent here
# on purpose, because they are never written into this list. A test reads the
# JS file and fails if the two drift apart.
CLINICAL_CONDITION_WORDS = {
    "caries": "Dental caries",
    "pulpitis": "Pulpitis",
    "pericoronitis": "Pericoronitis",
    "root_canal_infection": "Root canal infection",
    "erosion": "Erosion",
    "attrition": "Attrition",
    "abrasion": "Abrasion",
    "abfraction": "Abfraction",
    "bruxism": "Bruxism",
    "dental_trauma": "Dental trauma",
    "malocclusion": "Malocclusion",
    "hyperdontia": "Hyperdontia",
    "hypodontia": "Hypodontia / anodontia",
    "fluorosis": "Dental fluorosis",
    "enamel_hypoplasia": "Enamel hypoplasia",
    "macro_microdontia": "Macrodontia / microdontia",
    "gingivitis": "Gingivitis",
    "periodontitis": "Periodontitis",
    "gingival_recession": "Gingival recession",
    "tooth_mobility": "Mobility",
    "dentin_hypersensitivity": "Dentin hypersensitivity",
    "intrinsic_discoloration": "Intrinsic discoloration",
    "extrinsic_discoloration": "Extrinsic discoloration",
    "root_resorption": "Root resorption",
}


def clinical_conditions(data: dict) -> list:
    """A tooth's condition list as words, in the order recorded.

    Unknown values are printed as written rather than dropped: a condition added
    on the frontend before this map learned its name should still reach the
    paper, spelled as its key, instead of silently vanishing from the record.
    """
    raw = data.get("conditions")
    # A list or nothing. The chart is clinic-writable JSON, and iterating
    # whatever is there would turn a stray 7 into a crash that costs the whole
    # summary, and a bare string into a row of single letters.
    if not isinstance(raw, (list, tuple)):
        return []
    out = []
    for value in raw:
        if isinstance(value, str) and value:
            out.append(CLINICAL_CONDITION_WORDS.get(value, value.replace("_", " ")))
    return out
WORK_WORDS = {"existing": "Already present", "planned": "Planned"}
TYPE_WORDS = {
    "filling": "Filling", "crown_porcelain": "Porcelain crown", "crown_gold": "Gold crown",
    "crown_ss": "Stainless steel crown", "veneer": "Veneer", "bridge": "Bridge",
    "root_canal": "Root canal", "post_core": "Post and core", "implant": "Implant",
    "extraction": "Extraction", "crown": "Crown",
}


def _chart_legend(chart: dict) -> str:
    """Only the symbols this chart actually uses."""
    seen, rows = set(), []
    for data in (chart or {}).values():
        if not isinstance(data, dict):
            continue
        status = data.get("status")
        if status in STATUS_LEGEND and status not in seen:
            seen.add(status)
            rows.append(STATUS_LEGEND[status])
        for mark in (data.get("marks") or []):
            if mark in MARK_LEGEND and MARK_LEGEND[mark][0] not in seen:
                seen.add(MARK_LEGEND[mark][0])
                rows.append(MARK_LEGEND[mark])
    if not rows:
        return ""
    return "<div class='legend'>" + "".join(
        f"<div class='lg'><strong>{_esc(a)}</strong> — {_esc(b)}</div>" for a, b in rows
    ) + "</div>"


def _tooth_rows(chart: dict, tooth_notes: dict) -> str:
    """One row per tooth that has anything recorded on it."""
    rows = []
    for key in sorted((chart or {}).keys(), key=lambda k: int(k) if str(k).isdigit() else 999):
        data = chart.get(key)
        if not isinstance(data, dict):
            continue

        condition = ", ".join(x for x in (
            [CONDITION_WORDS.get(data.get("condition"), "")] + clinical_conditions(data)
        ) if x)
        work = data.get("work")
        work_text = ""
        if work:
            work_text = f"{TYPE_WORDS.get(data.get('workType'), 'Work')} — {WORK_WORDS.get(work, work)}"

        marked = [s for s, cond in (data.get("surfaces") or {}).items() if cond and cond != "none"]
        surfaces = format_surfaces(key, marked)
        findings = ", ".join(data.get("findings") or [])
        marks = ", ".join(MARK_LEGEND[m][0] for m in (data.get("marks") or []) if m in MARK_LEGEND)
        note = (tooth_notes or {}).get(str(key)) or ""

        detail = " · ".join(x for x in [findings, marks, note] if x)
        if not any([condition, work_text, surfaces, detail]):
            continue

        rows.append(
            "<tr>"
            f"<td class='b'>{_esc(universal_to_fdi(key))}</td>"
            f"<td>{_esc(condition) or '<span class=m>Normal</span>'}</td>"
            f"<td>{_esc(work_text) or '<span class=m>—</span>'}</td>"
            f"<td class='b'>{_esc(surfaces) or '<span class=m>—</span>'}</td>"
            f"<td>{_esc(detail) or '<span class=m>—</span>'}</td>"
            "</tr>"
        )
    if not rows:
        return ""
    return (
        "<table><thead><tr><th>Tooth</th><th>Condition</th><th>Work</th>"
        "<th>Surfaces</th><th>Findings and notes</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def _plan_table(items, currency) -> str:
    if not items:
        return ""
    rows, total = [], 0.0
    for item in items:
        if not isinstance(item, dict):
            continue
        teeth = item.get("teeth")
        anchor = item.get("tooth") or (teeth[0] if isinstance(teeth, list) and teeth else None)
        if isinstance(teeth, list) and teeth:
            where = ", ".join(str(universal_to_fdi(t)) for t in teeth)
        elif item.get("tooth"):
            where = str(universal_to_fdi(item["tooth"]))
        else:
            where = "General"
        written = format_surfaces(anchor, item.get("surfaces"))
        if written:
            where = f"{where} ({written})"

        try:
            qty = max(1, int(item.get("qty") or 1))
        except (TypeError, ValueError):
            qty = 1
        cost = item.get("cost")
        priced = cost not in (None, "")
        try:
            unit = float(cost) if priced else 0.0
        except (TypeError, ValueError):
            unit, priced = 0.0, False
        line = unit * qty
        total += line

        status = str(item.get("status") or "planned").replace("-", " ").title()
        rows.append(
            "<tr>"
            f"<td class='b'>{_esc(where)}</td>"
            f"<td>{_esc(item.get('procedure') or 'Procedure')}</td>"
            f"<td>{_esc(item.get('diagnosis') or '')}</td>"
            f"<td>{_esc(status)}</td>"
            f"<td class='n'>{qty}</td>"
            f"<td class='n'>{_money(unit, currency) if priced else '<span class=m>—</span>'}</td>"
            f"<td class='n'>{_money(line, currency) if priced else '<span class=m>—</span>'}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Tooth</th><th>Procedure</th><th>Diagnosis</th>"
        "<th>Status</th><th class='n'>Qty</th><th class='n'>Fee</th><th class='n'>Total</th></tr></thead>"
        f"<tbody>{''.join(rows)}"
        f"<tr class='tot'><td colspan='6'>Estimated total</td><td class='n'>{_money(total, currency)}</td></tr>"
        "</tbody></table>"
        "<p class='note'>Fees are an estimate of what the work is expected to cost today, "
        "not a bill. They can change if the treatment does.</p>"
    )


# ── perio ─────────────────────────────────────────────────────────────────

SEXTANTS = [("s1", "17-14"), ("s2", "13-23"), ("s3", "24-27"),
            ("s4", "47-44"), ("s5", "43-33"), ("s6", "34-37")]

BPE_MEANING = {
    "0": "Healthy", "1": "Bleeding on probing", "2": "Calculus or plaque-retentive factor",
    "3": "Pocketing 3.5-5.5mm", "4": "Pocketing 6mm or more", "X": "Not scorable",
}


def _perio_block(perio: dict) -> str:
    if not perio:
        return ""
    bpe = perio.get("bpe") or {}
    teeth = perio.get("teeth") or {}
    out = []

    if bpe:
        cells = "".join(
            f"<td><div class='sx'>{_esc(label)}</div>"
            f"<div class='sc'>{_esc(bpe.get(key) or '—')}</div></td>"
            for key, label in SEXTANTS[:3]
        )
        cells2 = "".join(
            f"<td><div class='sx'>{_esc(label)}</div>"
            f"<div class='sc'>{_esc(bpe.get(key) or '—')}</div></td>"
            for key, label in SEXTANTS[3:]
        )
        scores = [str(v).replace("*", "") for v in bpe.values() if v and str(v).replace("*", "") != "X"]
        worst = max(scores) if scores else None
        out.append(
            "<table class='bpe'><tbody>"
            f"<tr>{cells}</tr><tr>{cells2}</tr></tbody></table>"
        )
        if worst:
            starred = any("*" in str(v) for v in bpe.values())
            out.append(
                f"<p class='note'><strong>Worst sextant score {_esc(worst)}"
                f"{'*' if starred else ''}</strong> — {_esc(BPE_MEANING.get(worst, ''))}."
                f"{' A starred sextant means furcation involvement.' if starred else ''}</p>"
            )

    if teeth:
        recorded = deep = severe = bleeding = 0
        depth_sum = 0.0
        deep_sites = []
        for tooth, rec in teeth.items():
            for site, value in (rec.get("pd") or {}).items():
                try:
                    mm = float(value)
                except (TypeError, ValueError):
                    continue
                recorded += 1
                depth_sum += mm
                if mm >= 4:
                    deep += 1
                if mm >= 6:
                    severe += 1
                    deep_sites.append(f"{universal_to_fdi(tooth)} {site.upper()} {mm:.0f}mm")
            bleeding += len(rec.get("bop") or [])

        if recorded:
            pct = round(bleeding / recorded * 100)
            out.append(
                "<table class='kv'><tbody>"
                f"<tr><th>Sites recorded</th><td>{recorded}</td>"
                f"<th>Mean depth</th><td>{depth_sum / recorded:.1f}mm</td></tr>"
                f"<tr><th>Bleeding on probing</th><td>{pct}%</td>"
                f"<th>Sites 4mm+</th><td>{deep}</td></tr>"
                f"<tr><th>Sites 6mm+</th><td>{severe}</td><th></th><td></td></tr>"
                "</tbody></table>"
            )
        if deep_sites:
            out.append("<p class='note'><strong>Deep sites:</strong> "
                       + _esc(", ".join(deep_sites)) + "</p>")

    if perio.get("notes"):
        out.append(f"<p class='body'>{_esc(perio['notes'])}</p>")
    return "".join(out)


# ── the document ──────────────────────────────────────────────────────────

def render_clinical_summary(case_paper, clinic, patient, dentist_name="",
                            currency="₹", chart_svg="", prescriptions=None,
                            lab_orders=None, consumptions=None) -> str:
    cp = case_paper
    when = cp.date.strftime("%d %B %Y") if cp.date else ""
    chart = _json_obj(getattr(cp, "dental_chart_snapshot", None), {}) or {}
    plan = _json_obj(getattr(cp, "treatment_plan_snapshot", None), []) or []
    notes_by_tooth = _json_obj(getattr(cp, "tooth_notes_snapshot", None), {}) or {}
    perio = _json_obj(getattr(cp, "perio_chart_snapshot", None), {}) or {}

    allergies = _as_list(cp.allergies)
    conditions = _as_list(cp.medical_history)

    # The one block on this page that can hurt somebody if it is missed.
    alert = ""
    if allergies or conditions:
        parts = []
        if allergies:
            parts.append(f"<div><span class='k'>Allergies</span> {_esc(', '.join(allergies))}</div>")
        if conditions:
            parts.append(f"<div><span class='k'>Medical conditions</span> {_esc(', '.join(conditions))}</div>")
        alert = f"<div class='alert'>{''.join(parts)}</div>"
    else:
        alert = ("<div class='alert none'><div><span class='k'>Allergies and medical history</span> "
                 "None recorded. Confirm with the patient before treating.</div></div>")

    age = getattr(patient, "age", None)
    who = "<table class='kv'><tbody>"
    who += (f"<tr><th>Patient</th><td class='b'>{_esc(getattr(patient, 'name', ''))}</td>"
            f"<th>Visit</th><td>{_esc(when)}</td></tr>")
    who += (f"<tr><th>Age</th><td>{_esc(age) if age else '—'}</td>"
            f"<th>Seen by</th><td>{_esc(dentist_name or '—')}</td></tr>")
    who += (f"<tr><th>Phone</th><td>{_esc(getattr(patient, 'phone', '') or '—')}</td>"
            f"<th>Record</th><td>#{_esc(cp.id)}</td></tr>")
    who += "</tbody></table>"

    rx_rows = []
    for rx in (prescriptions or []):
        for item in (rx.items or []):
            if not (item or {}).get("medicine_name"):
                continue
            rx_rows.append(
                "<tr>"
                f"<td class='b'>{_esc(item.get('medicine_name'))}</td>"
                f"<td>{_esc(item.get('dosage') or '—')}</td>"
                f"<td>{_esc(item.get('frequency') or '—')}</td>"
                f"<td>{_esc(item.get('duration') or '—')}</td>"
                f"<td>{_esc(item.get('instructions') or '')}</td>"
                "</tr>"
            )
    rx_table = ("<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th>"
                "<th>Duration</th><th>Instructions</th></tr></thead>"
                f"<tbody>{''.join(rx_rows)}</tbody></table>") if rx_rows else ""

    lab_rows = "".join(
        "<tr>"
        f"<td class='b'>{_esc(o.work_type)}</td>"
        f"<td>{_esc(o.tooth_number or '—')}</td>"
        f"<td>{_esc(o.shade or '—')}</td>"
        f"<td>{_esc(o.status or '—')}</td>"
        f"<td>{_esc(o.due_date.strftime('%d %b %Y') if o.due_date else '—')}</td>"
        "</tr>" for o in (lab_orders or [])
    )
    lab_table = ("<table><thead><tr><th>Work</th><th>Tooth</th><th>Shade</th>"
                 "<th>Status</th><th>Due</th></tr></thead>"
                 f"<tbody>{lab_rows}</tbody></table>") if lab_rows else ""

    stock_rows = "".join(
        f"<tr><td class='b'>{_esc(c.item_name)}</td>"
        f"<td class='n'>{_esc(c.quantity)}{_esc(' ' + c.unit if c.unit else '')}</td></tr>"
        for c in (consumptions or [])
    )
    stock_table = ("<table><thead><tr><th>Item</th><th class='n'>Used</th></tr></thead>"
                   f"<tbody>{stock_rows}</tbody></table>") if stock_rows else ""

    nxt = ""
    if cp.next_visit_date:
        nxt = cp.next_visit_date.strftime("%d %B %Y")
        if cp.next_visit_recommendation:
            nxt += f" — {_as_text(cp.next_visit_recommendation)}"
    elif cp.next_visit_recommendation:
        nxt = _as_text(cp.next_visit_recommendation)

    chart_block = ""
    if chart_svg:
        chart_block = (f"<div class='chart-wrap'><div class='chart'>{chart_svg}</div>"
                       f"{_chart_legend(chart)}</div>")
    elif chart:
        chart_block = ("<p class='note'>The chart image could not be included in this export. "
                       "The findings recorded on it are listed below.</p>")

    body = "".join([
        alert,
        who,
        _section("Chief complaint", _pills(_as_list(cp.chief_complaint))),
        _section("Dental history", _pills(_as_list(cp.dental_history))),
        _section("Examination", f"<p class='body'>{_esc(_as_text(cp.clinical_examination))}</p>"
                 if _as_text(cp.clinical_examination) else ""),
        _section("Diagnosis", f"<p class='body'>{_esc(_as_text(cp.diagnosis))}</p>"
                 if _as_text(cp.diagnosis) else ""),
        _section("Clinical notes", f"<p class='body'>{_esc(cp.notes)}</p>" if cp.notes else ""),
        _section("Dental chart", chart_block + _tooth_rows(chart, notes_by_tooth)),
        _section("Treatment plan", _plan_table(plan, currency)),
        _section("Periodontal", _perio_block(perio)),
        _section("Prescriptions", rx_table),
        _section("Laboratory orders", lab_table),
        _section("Medicines and materials used", stock_table),
        _section("Next visit", f"<p class='body next'>{_esc(nxt)}</p>" if nxt else ""),
    ])

    patient_name = _esc(getattr(patient, "name", ""))
    clinic_name = _esc(getattr(clinic, "name", "") if clinic else "")

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{
  size: A4; margin: 16mm 13mm 14mm;
  @top-left {{ content: "{patient_name} · Clinical summary"; font-size: 8px; color: #9ca3af; }}
  @top-right {{ content: "Page " counter(page) " of " counter(pages); font-size: 8px; color: #9ca3af; }}
  @bottom-center {{ content: "{clinic_name} · generated {_esc(datetime.now().strftime('%d %b %Y, %H:%M'))}";
                    font-size: 8px; color: #9ca3af; }}
}}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 10.5px; line-height: 1.5;
        orphans: 3; widows: 3; }}
.hd {{ display: flex; justify-content: space-between; align-items: flex-start;
       border-bottom: 2px solid #2a276e; padding-bottom: 9px; margin-bottom: 12px; }}
.clinic {{ font-size: 16px; font-weight: bold; color: #2a276e; }}
.muted {{ color: #6b7280; font-size: 9px; }}
.title {{ text-align: right; }}
.title h1 {{ margin: 0; font-size: 16px; letter-spacing: .5px; }}

.alert {{ border: 1.5px solid #dc2626; background: #fef2f2; border-radius: 5px;
          padding: 8px 11px; margin-bottom: 12px; }}
.alert.none {{ border-color: #e5e7eb; background: #f9fafb; }}
.alert .k {{ display: inline-block; min-width: 118px; font-size: 8px; font-weight: bold;
             text-transform: uppercase; letter-spacing: .6px; color: #b91c1c; }}
.alert.none .k {{ color: #6b7280; }}

/* Sections may split across a page — a long treatment plan should — but a
   heading must never be the last thing on a page with its table overleaf. */
.sec {{ margin-bottom: 13px; }}
h2 {{ font-size: 9px; text-transform: uppercase; letter-spacing: .8px; color: #2a276e;
      border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin: 0 0 6px;
      break-after: avoid; }}
thead {{ break-after: avoid; }}
.body {{ white-space: pre-wrap; margin: 0; }}
.next {{ background: #eef2ff; border-left: 3px solid #2a276e; padding: 7px 10px; border-radius: 3px; }}

.pills span.pill {{ display: inline-block; border: 1px solid #d1d5db; border-radius: 3px;
                    padding: 1px 7px; margin: 0 4px 4px 0; font-size: 10px; }}

table {{ width: 100%; border-collapse: collapse; }}
th {{ text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .5px;
      color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 0 6px 4px; }}
td {{ padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }}
tr {{ break-inside: avoid; }}
td.n, th.n {{ text-align: right; white-space: nowrap; }}
td.b {{ font-weight: bold; white-space: nowrap; }}
.m {{ color: #9ca3af; }}
tr.tot td {{ border-bottom: none; border-top: 1.5px solid #2a276e; padding-top: 7px;
             font-size: 12px; font-weight: bold; }}
table.kv th {{ width: 78px; border: none; padding: 3px 6px 3px 0; vertical-align: middle; }}
table.kv td {{ border: none; padding: 3px 14px 3px 0; }}

/* The chart and its legend are one thing; the legend alone on the next page
   explains symbols the reader can no longer see. */
.chart-wrap {{ break-inside: avoid; }}
.chart {{ width: 100%; margin-bottom: 8px; }}
.chart svg {{ width: 100%; height: auto; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 3px 16px; margin-bottom: 10px; }}
.lg {{ font-size: 8.5px; color: #4b5563; width: 46%; }}

table.bpe td {{ text-align: center; border: 1px solid #e5e7eb; padding: 5px 2px; }}
.sx {{ font-size: 7.5px; color: #9ca3af; }}
.sc {{ font-size: 15px; font-weight: bold; }}
.note {{ font-size: 9px; color: #6b7280; margin: 5px 0 0; }}
</style></head><body>

<div class="hd">
  <div>
    <div class="clinic">{clinic_name}</div>
    <div class="muted">{_esc(getattr(clinic, 'address', '') or '')}</div>
    <div class="muted">{_esc(getattr(clinic, 'phone', '') or '')}</div>
  </div>
  <div class="title">
    <h1>CLINICAL SUMMARY</h1>
    <div class="muted">{_esc(when)}</div>
  </div>
</div>

{body}

<div style="margin-top:26px; break-inside:avoid;">
  <div style="border-top:1px solid #9ca3af; width:190px; padding-top:4px;
              font-size:9px; color:#6b7280;">
    {_esc(dentist_name or 'Treating dentist')}
  </div>
</div>
</body></html>"""
