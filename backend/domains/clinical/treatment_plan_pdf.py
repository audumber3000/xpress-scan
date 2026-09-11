"""The treatment plan, written for the patient to take home and agree to.

A companion to summary_pdf.py, and deliberately a different document. The visit
summary says what happened; this says what is proposed, why, and what it is
likely to cost. That difference is the whole reason it carries money at all:
the patient is being asked to agree to something, and a plan handed over without
fees is a plan they cannot say yes to.

It follows the shape a dental treatment plan takes wherever it is done properly,
so a patient comparing two clinics' plans can lay them side by side:

  1. who proposes it, to whom, on what date, and until when the fees hold
  2. what was found: the complaint, the diagnosis, the chart, tooth by tooth
  3. what is proposed, by tooth and surface, a fee per line and a total
  4. the terms any estimate needs, and a place for both sides to sign

It is not a bill and does not pretend to be one. It carries no invoice number,
nothing is payable on it, and it says so on its face. A patient who wants a
formal proposal to accept or decline inside the app gets a quotation, which is a
different object with its own status.

The medical history and allergies are left off on purpose. This goes out over
WhatsApp and may be read by whoever picks up the phone, so the consent line asks
the patient to confirm their history instead of printing it.

The chart is the one the doctor was looking at, serialised by the browser, for
the reason given at the top of chartSvg.js: one renderer, not two that drift.
The findings table under it says in words everything the chart shows, so the
document is complete even when no chart image was sent.

Tooth numbers are converted to FDI on the way out, matching the chart the
patient was shown in the chair.
"""
import datetime as _dt

from core.clinic_time import clinic_tzinfo
from domains.clinical.clinical_summary_pdf import (
    BPE_MEANING, CONDITION_WORDS, MARK_LEGEND, STATUS_LEGEND, TYPE_WORDS,
    _as_text, _json_obj, clinical_conditions, tooth_state,
)
from domains.clinical.tooth_notation import format_surfaces, universal_to_fdi
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri
from domains.infrastructure.services.pdf_safety import safe_color, safe_signature_data_uri

# How long the fees on a plan hold. Thirty days is what most practices print:
# long enough to think it over and arrange the money, short enough that a plan
# found in a drawer next year is not read as a promise.
VALID_DAYS = 30

_STATUS_LABEL = {
    "planned": "Planned",
    "in-progress": "In progress",
    "completed": "Completed",
}

# What a surface can carry. A problem belongs under "what we found"; a
# restoration that is already there belongs under "work on the tooth".
_SURFACE_PROBLEMS = {"caries": "Caries", "fracture": "Fracture"}
_SURFACE_WORK = {
    "filling_existing": "Filling",
    "filling_amalgam": "Amalgam filling",
    "filling_temp": "Temporary filling",
    "filling_gold": "Gold filling",
    "crown_gold": "Gold crown",
    "crown_porcelain": "Porcelain crown",
}

# Marks that are a finding rather than work. Sealant is the odd one out: it is
# something already on the tooth, so it is listed with the work.
_WORK_MARKS = {"sealant"}

# ── plumbing ──────────────────────────────────────────────────────────────

def _esc(v) -> str:
    return ("" if v is None else str(v)).replace("&", "&amp;").replace(
        "<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _css_str(v) -> str:
    """A value going inside a CSS string in an @page rule. HTML escaping does
    nothing there, and a quote in a clinic's name would end the string early
    and take the page footer with it."""
    return (str(v or "").replace("\\", "\\\\").replace('"', '\\"')
            .replace("\n", " ").replace("\r", " "))


def _money(amount, currency) -> str:
    try:
        return f"{currency}{float(amount or 0):,.0f}"
    except (TypeError, ValueError):
        return f"{currency}0"


def _local_date(value, tz):
    """A stored timestamp is naive UTC. The date printed is the clinic's, or a
    visit at 1am in Mumbai is dated the day before."""
    if not isinstance(value, _dt.datetime):
        return value if isinstance(value, _dt.date) else None
    if value.tzinfo is None:
        value = value.replace(tzinfo=_dt.timezone.utc)
    return value.astimezone(tz).date()


def _fmt_date(d) -> str:
    return d.strftime("%d %b %Y") if d else ""


def _teeth_label(item) -> str:
    """A per-tooth procedure names one tooth; a combined one (a quadrant
    scaling, say) names several. Neither is 'General': that is the third case,
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


def _plan_items(case_paper):
    """The snapshot is JSON-or-JSON-string, the same as every other clinical
    field on this record."""
    raw = _json_obj(getattr(case_paper, "treatment_plan_snapshot", None), [])
    return [i for i in raw if isinstance(i, dict)] if isinstance(raw, list) else []


def _fee(item):
    """(unit fee, qty, priced) for one line.

    Zero counts as not priced. The drawer stores a blank fee as 0, and a patient
    reading "₹0" next to a root canal reasonably concludes it is free. "To be
    confirmed" is what the clinic actually means."""
    try:
        qty = max(1, int(item.get("qty") or 1))
    except (TypeError, ValueError):
        qty = 1
    cost = item.get("cost")
    try:
        unit = float(cost) if cost not in (None, "") else 0.0
    except (TypeError, ValueError):
        unit = 0.0
    return unit, qty, unit > 0


def _status_of(item) -> str:
    s = str(item.get("status") or "planned").lower()
    return s if s in _STATUS_LABEL else "planned"


# ── the clinic, the patient, the dentist ──────────────────────────────────

def _clinic_address(clinic) -> str:
    if not clinic:
        return ""
    if getattr(clinic, "address", None):
        return clinic.address
    parts = [getattr(clinic, k, None) for k in
             ("address_line1", "address_line2", "city", "state", "postal_code")]
    return ", ".join(str(p) for p in parts if p)


def _logo(clinic, primary) -> str:
    """The clinic's mark, or its initials. A clinic without a logo is the
    common case, so the fallback is a designed element rather than a gap."""
    data = resolve_logo_data_uri(getattr(clinic, "logo_url", None)) if clinic else ""
    if data:
        return f"<img class='logo' src='{data}' alt=''>"
    initials = _esc(((getattr(clinic, "name", "") or "DC").strip() or "DC")[:2].upper())
    return f"<div class='mono' style='background:{primary}'>{initials}</div>"


def _patient_id(patient) -> str:
    if not patient:
        return ""
    if getattr(patient, "display_id", None):
        return f"#{patient.display_id}"
    pid = getattr(patient, "id", None)
    return f"PT-{pid}" if pid else ""


def _age_sex(patient) -> str:
    if not patient:
        return ""
    age = getattr(patient, "age", None)
    if not age and isinstance(getattr(patient, "date_of_birth", None), _dt.date):
        dob, today = patient.date_of_birth, _dt.date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    sex = (getattr(patient, "gender", "") or "").strip().title()
    parts = [f"{age} yrs" if age else "", sex]
    return " / ".join(p for p in parts if p)


# ── what was found ────────────────────────────────────────────────────────

def _tooth_findings(key, data: dict, note: str):
    """(what we found, work on the tooth, notes) for one tooth, in words."""
    condition, work, work_type = tooth_state(data)

    surfaces = data.get("surfaces") if isinstance(data.get("surfaces"), dict) else {}
    by_state = {}
    for surface, state in surfaces.items():
        if state and state != "none":
            by_state.setdefault(state, []).append(surface)

    def on_surfaces(word, state):
        written = format_surfaces(key, by_state[state])
        return f"{word} ({written})" if written else word

    marks = [m for m in (data.get("marks") or []) if isinstance(m, str)] \
        if isinstance(data.get("marks"), list) else []

    found = []
    if condition in CONDITION_WORDS:
        found.append(CONDITION_WORDS[condition])
    found += clinical_conditions(data)
    found += [on_surfaces(w, s) for s, w in _SURFACE_PROBLEMS.items() if s in by_state]
    for m in marks:
        if m in MARK_LEGEND and m not in _WORK_MARKS:
            word = MARK_LEGEND[m][0]
            if word not in found:
                found.append(word)

    done = []
    if work == "planned":
        done.append(f"{TYPE_WORDS[work_type]}, planned" if work_type in TYPE_WORDS
                    else "Treatment planned")
    elif work:
        done.append(TYPE_WORDS.get(work_type, "Existing work"))
    done += [on_surfaces(w, s) for s, w in _SURFACE_WORK.items() if s in by_state]
    done += [MARK_LEGEND[m][0] for m in marks if m in _WORK_MARKS]

    free = data.get("findings") if isinstance(data.get("findings"), list) else []
    notes = [str(f) for f in free if f] + ([str(note)] if note else [])
    return found, done, notes


def _findings_table(chart: dict, tooth_notes: dict) -> str:
    """One row per tooth with anything on it. A healthy tooth gets no row: a
    table of 32 teeth saying "Normal" hides the six that matter."""
    rows = []
    keys = sorted(chart.keys(), key=lambda k: int(k) if str(k).isdigit() else 999)
    for key in keys:
        data = chart.get(key)
        if not isinstance(data, dict):
            continue
        found, done, notes = _tooth_findings(key, data, (tooth_notes or {}).get(str(key)) or "")
        if not (found or done or notes):
            continue
        rows.append(
            "<tr>"
            f"<td class='tooth'>{_esc(universal_to_fdi(key))}</td>"
            f"<td>{_esc(', '.join(found)) or '<span class=m>No problem noted</span>'}</td>"
            f"<td>{_esc(', '.join(done)) or '<span class=m>None</span>'}</td>"
            f"<td>{_esc('; '.join(notes))}</td>"
            "</tr>"
        )
    if not rows:
        return ""
    return (
        "<table class='grid'><thead><tr><th class='w-tooth'>Tooth</th><th>What we found</th>"
        "<th>Work on the tooth</th><th>Notes</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def _legend(chart: dict) -> str:
    """Only the symbols this chart actually uses, so it stays a few rows a
    patient will read rather than seventeen they will skip."""
    seen, rows = set(), []
    for data in chart.values():
        if not isinstance(data, dict):
            continue
        status = data.get("status")
        if status in STATUS_LEGEND and status not in seen:
            seen.add(status)
            rows.append(STATUS_LEGEND[status])
        marks = data.get("marks") if isinstance(data.get("marks"), list) else []
        for mark in marks:
            if mark in MARK_LEGEND and MARK_LEGEND[mark][0] not in seen:
                seen.add(MARK_LEGEND[mark][0])
                rows.append(MARK_LEGEND[mark])
    if not rows:
        return ""
    cells = [f"<td><strong>{_esc(a)}</strong>: {_esc(b)}</td>" for a, b in rows]
    if len(cells) % 2:
        cells.append("<td></td>")
    body = "".join(f"<tr>{cells[i]}{cells[i + 1]}</tr>" for i in range(0, len(cells), 2))
    return f"<table class='legend'><tbody>{body}</tbody></table>"


def _gum_health(perio: dict) -> str:
    """The worst BPE score in one sentence. The full six-site chart is for the
    clinical summary; the patient needs to know whether their gums are part of
    the plan."""
    bpe = perio.get("bpe") if isinstance(perio.get("bpe"), dict) else {}
    scores = [str(v).replace("*", "") for v in bpe.values() if v]
    scores = [s for s in scores if s in BPE_MEANING and s != "X"]
    if not scores:
        return ""
    worst = max(scores)
    starred = any("*" in str(v) for v in bpe.values() if v)
    return (f"Screening score {worst}{'*' if starred else ''} of 4 at the worst point: "
            f"{BPE_MEANING[worst].lower()}."
            f"{' The star means the bone between the roots is involved.' if starred else ''}")


# ── what is proposed ──────────────────────────────────────────────────────

def _plan_rows(items, currency, start=1):
    rows, total, unpriced = [], 0.0, 0
    for n, item in enumerate(items, start=start):
        unit, qty, priced = _fee(item)
        line = unit * qty if priced else 0.0
        total += line
        unpriced += 0 if priced else 1
        detail = []
        if item.get("diagnosis"):
            detail.append(f"<div class='sub'>For: {_esc(item['diagnosis'])}</div>")
        if item.get("notes"):
            detail.append(f"<div class='sub'>{_esc(item['notes'])}</div>")
        status = _status_of(item)
        rows.append(
            "<tr>"
            f"<td class='num-l'>{n}</td>"
            f"<td class='tooth'>{_esc(_teeth_label(item))}</td>"
            f"<td><strong>{_esc(item.get('procedure') or 'Procedure')}</strong>{''.join(detail)}</td>"
            f"<td class='st st-{status}'>{_esc(_STATUS_LABEL[status])}</td>"
            f"<td class='n'>{qty}</td>"
            f"<td class='n'>{_money(unit, currency) if priced else '<span class=tbd>To be confirmed</span>'}</td>"
            f"<td class='n'>{_money(line, currency) if priced else '<span class=m>-</span>'}</td>"
            "</tr>"
        )
    return rows, total, unpriced


def _plan_block(items, currency) -> str:
    if not items:
        return "<p class='empty'>No treatment has been planned yet.</p>"

    # Still to do first, in the order the dentist put it: that is the order it
    # will happen in. What is already done follows, so the patient can see the
    # whole course and where they are in it.
    todo = [i for i in items if _status_of(i) != "completed"]
    done = [i for i in items if _status_of(i) == "completed"]

    head = ("<thead><tr><th class='w-n'>#</th><th class='w-tooth'>Tooth</th><th>Treatment</th>"
            "<th class='w-st'>Status</th><th class='n w-q'>Qty</th><th class='n w-f'>Fee</th>"
            "<th class='n w-f'>Amount</th></tr></thead>")

    todo_rows, todo_total, todo_unpriced = _plan_rows(todo, currency)
    done_rows, done_total, done_unpriced = _plan_rows(done, currency, start=len(todo) + 1)

    body = []
    if todo_rows and done_rows:
        body.append("<tr class='grp'><td colspan='7'>To be done</td></tr>")
    body += todo_rows
    if done_rows:
        body.append("<tr class='grp'><td colspan='7'>Already completed</td></tr>")
        body += done_rows
    table = f"<table class='grid plan'>{head}<tbody>{''.join(body)}</tbody></table>"

    # The totals, as a patient reads them: what is left to pay for, what has
    # been done, and the whole course.
    lines = []
    if done_rows and todo_rows:
        lines.append(("Treatment still to be done", _money(todo_total, currency), ""))
        lines.append(("Treatment already completed", _money(done_total, currency), ""))
    lines.append(("Estimated total", _money(todo_total + done_total, currency), "grand"))
    totals = "".join(
        f"<tr class='{cls}'><td>{_esc(label)}</td><td class='n'>{value}</td></tr>"
        for label, value, cls in lines
    )
    unpriced = todo_unpriced + done_unpriced
    caveat = ""
    if unpriced:
        caveat = (f"<p class='caveat'>{unpriced} item{'s are' if unpriced != 1 else ' is'} "
                  f"still to be priced and not included in this total. We will confirm "
                  f"{'those fees' if unpriced != 1 else 'the fee'} before we start.</p>")
    return (f"{table}<table class='totals'><tbody>{totals}</tbody></table>{caveat}")


def _defs(rows, extra="") -> str:
    """Label and value, one pair a line, skipping the empty ones."""
    body = "".join(f"<tr><th>{_esc(k)}</th><td>{_esc(v)}</td></tr>" for k, v in rows if v)
    return f"<table class='defs {extra}'><tbody>{body}</tbody></table>" if body else ""


# ── the document ──────────────────────────────────────────────────────────

def render_treatment_plan(case_paper, clinic, patient, dentist_name="", currency="₹",
                          chart_svg="", dentist=None) -> str:
    """The plan as HTML for WeasyPrint.

    `chart_svg` must already be sanitised: the route runs it through
    `_safe_svg` before it gets here, and it is interpolated as markup.
    `dentist` is the User who planned it, for the qualifications and the
    signature; `dentist_name` alone still works for callers without one.
    """
    cp = case_paper
    tz = clinic_tzinfo(clinic)
    issued = _dt.datetime.now(tz).date()
    valid_until = issued + _dt.timedelta(days=VALID_DAYS)
    visit = _local_date(getattr(cp, "date", None), tz)

    items = _plan_items(cp)
    chart = _json_obj(getattr(cp, "dental_chart_snapshot", None), {})
    chart = chart if isinstance(chart, dict) else {}
    tooth_notes = _json_obj(getattr(cp, "tooth_notes_snapshot", None), {})
    tooth_notes = tooth_notes if isinstance(tooth_notes, dict) else {}
    perio = _json_obj(getattr(cp, "perio_chart_snapshot", None), {})
    perio = perio if isinstance(perio, dict) else {}

    primary = safe_color(getattr(clinic, "primary_color", None), default="#2a276e")
    clinic_name = (getattr(clinic, "name", "") or "") if clinic else ""
    ref = f"TP-{int(cp.id):05d}" if str(getattr(cp, "id", "")).isdigit() else "TP"

    doc_name = (getattr(dentist, "name", None) if dentist else None) or dentist_name or ""
    quals = (getattr(dentist, "qualifications", "") or "") if dentist else ""
    signature = safe_signature_data_uri(getattr(dentist, "signature_url", None)) if dentist else ""

    # ── header
    contact = " · ".join(_esc(x) for x in (
        getattr(clinic, "phone", "") if clinic else "",
        getattr(clinic, "email", "") if clinic else "",
    ) if x)
    reg = ""
    if clinic and getattr(clinic, "license_number", None):
        reg = f"Reg. no. {_esc(clinic.license_number)}"
        if getattr(clinic, "license_authority", None):
            reg += f" ({_esc(clinic.license_authority)})"
    header = f"""
<table class="hd"><tr>
  <td class="brand">
    <table><tr>
      <td class="logo-cell">{_logo(clinic, primary)}</td>
      <td>
        <div class="clinic">{_esc(clinic_name)}</div>
        {f"<div class='tag'>{_esc(clinic.tagline)}</div>" if clinic and getattr(clinic, 'tagline', None) else ""}
        {f"<div class='muted'>{_esc(_clinic_address(clinic))}</div>" if _clinic_address(clinic) else ""}
        {f"<div class='muted'>{contact}</div>" if contact else ""}
        {f"<div class='muted'>{reg}</div>" if reg else ""}
      </td>
    </tr></table>
  </td>
  <td class="doc">
    <h1>Treatment Plan</h1>
    <table class="meta">
      <tr><th>Plan no.</th><td>{_esc(ref)}</td></tr>
      <tr><th>Issued</th><td>{_fmt_date(issued)}</td></tr>
      <tr><th>Valid until</th><td>{_fmt_date(valid_until)}</td></tr>
    </table>
  </td>
</tr></table>"""

    # ── patient and dentist
    dentist_cell = _esc(doc_name) or "<span class=m>-</span>"
    if quals:
        dentist_cell += f"<div class='sub'>{_esc(quals)}</div>"
    who = f"""
<table class="who"><tr>
  <td><div class="k">Patient</div><div class="v b">{_esc(getattr(patient, 'name', '') or '')}</div>
      <div class="sub">{_esc(' · '.join(x for x in (_patient_id(patient), _age_sex(patient)) if x))}</div></td>
  <td><div class="k">Phone</div><div class="v">{_esc(getattr(patient, 'phone', '') or '') or '<span class=m>-</span>'}</div></td>
  <td><div class="k">Treating dentist</div><div class="v">{dentist_cell}</div></td>
  <td><div class="k">Examined on</div><div class="v">{_fmt_date(visit) or '<span class=m>-</span>'}</div></td>
</tr></table>"""

    # ── what we found
    assessment_html = _defs((
        ("Your concern", _as_text(getattr(cp, "chief_complaint", None))),
        ("Examination", _as_text(getattr(cp, "clinical_examination", None))),
        ("Diagnosis", _as_text(getattr(cp, "diagnosis", None))),
        ("Gum health", _gum_health(perio)),
    ))

    chart_html = ""
    if chart_svg:
        chart_html = (
            "<div class='chart-wrap'>"
            f"<div class='chart'>{chart_svg}</div>"
            f"{_legend(chart)}"
            "<p class='fdi'>Teeth are numbered the international (FDI) way. The first digit is "
            "the quarter of the mouth: 1 upper right, 2 upper left, 3 lower left, 4 lower right. "
            "The second counts back from the front tooth, so 11 is your upper right front tooth "
            "and 48 your lower right wisdom tooth.</p>"
            "</div>"
        )
    findings = _findings_table(chart, tooth_notes)

    # ── next visit
    nxt = ""
    nv_date = getattr(cp, "next_visit_date", None)
    nv_text = _as_text(getattr(cp, "next_visit_recommendation", None))
    if nv_text.strip().lower() in ("not specified", "none"):
        nv_text = ""
    if nv_date or nv_text:
        nxt = ", ".join(x for x in (_fmt_date(nv_date) if isinstance(nv_date, _dt.date) else "",
                                    nv_text) if x)

    def section(num, title, body):
        if not body:
            return ""
        return (f"<section class='sec'><h2><span class='no'>{num}</span>{_esc(title)}</h2>"
                f"{body}</section>")

    sections, n = [], 0
    for title, body in (
        ("What we found", assessment_html),
        # Without the picture it is a list of teeth, and calling that a chart
        # sends the reader looking for one.
        ("Dental chart" if chart_html else "Tooth by tooth", chart_html + findings),
        ("Proposed treatment", _plan_block(items, currency)
         + (_defs((("Next visit", nxt),), extra="next") if nxt else "")),
    ):
        if body:
            n += 1
            sections.append(section(n, title, body))

    n += 1
    terms = section(n, "Please read", """
<ol class="terms">
  <li><strong>This is an estimate, not a bill.</strong> Nothing on it is payable yet. The fees
      hold until the date at the top of this plan.</li>
  <li>Treatment can change once it starts. A filling can turn out to need a root canal if the
      decay is deeper than it looked. If the plan or the fee has to change, we will explain why
      and agree it with you before we go ahead.</li>
  <li>We have talked you through the other options, including what is likely to happen if you
      choose not to have treatment. Ask us to go over any of them again.</li>
  <li>Tell us before each visit if your health, your medicines or a pregnancy has changed.</li>
  <li>You can ask questions, take time to decide, or stop treatment at any point.</li>
</ol>""")

    sig_img = f"<img class='sig' src='{signature}' alt=''>" if signature else ""
    consent = f"""
<section class="sec consent">
  <h2><span class="no">{n + 1}</span>Consent</h2>
  <p class="para">I have read this treatment plan. The proposed treatment, the other options,
  the likely risks and the estimated fees have been explained to me, and my questions have been
  answered. I have told the dentist about my medical history and the medicines I take. I agree
  to go ahead with the treatment listed above.</p>
  <table class="sign"><tr>
    <td>
      <div class="line"></div>
      <div class="cap">Patient or guardian signature</div>
      <div class="cap2">Name: {_esc(getattr(patient, 'name', '') or '')}</div>
      <div class="cap2">Date:</div>
    </td>
    <td class="gap"></td>
    <td>
      <div class="sig-box">{sig_img}</div>
      <div class="line"></div>
      <div class="cap">Dentist signature</div>
      <div class="cap2">{_esc(doc_name) or 'Name:'}{f", {_esc(quals)}" if quals else ""}</div>
      <div class="cap2">Date:</div>
    </td>
  </tr></table>
</section>"""

    footer_left = _css_str(f"{clinic_name} · Treatment plan {ref}" if clinic_name else f"Treatment plan {ref}")
    patient_name = _css_str(getattr(patient, "name", "") or "")

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{
  size: A4; margin: 16mm 13mm 16mm;
  @top-left {{ content: "{patient_name}"; font: 7.5px Helvetica, Arial, sans-serif; color: #9ca3af; }}
  @top-right {{ content: "Treatment plan {_css_str(ref)}"; font: 7.5px Helvetica, Arial, sans-serif; color: #9ca3af; }}
  @bottom-left {{ content: "{footer_left}"; font: 7.5px Helvetica, Arial, sans-serif; color: #9ca3af; }}
  @bottom-right {{ content: "Page " counter(page) " of " counter(pages); font: 7.5px Helvetica, Arial, sans-serif; color: #9ca3af; }}
}}
/* Page one already says all of that in its header. */
@page :first {{
  margin-top: 13mm;
  @top-left {{ content: none; }}
  @top-right {{ content: none; }}
}}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 10px; line-height: 1.45;
        orphans: 3; widows: 3; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ vertical-align: top; }}
.m {{ color: #9ca3af; }}
.b {{ font-weight: bold; }}
.muted {{ color: #6b7280; font-size: 8.5px; line-height: 1.4; }}
.sub {{ color: #6b7280; font-size: 8.5px; margin-top: 1px; }}

/* header */
table.hd {{ border-bottom: 2px solid {primary}; margin-bottom: 12px; }}
table.hd > tbody > tr > td, table.hd > tr > td {{ padding: 0 0 10px; }}
td.brand table td {{ padding: 0; vertical-align: middle; }}
td.logo-cell {{ width: 58px; padding-right: 12px !important; }}
img.logo {{ width: 50px; height: 50px; object-fit: contain; }}
.mono {{ width: 50px; height: 50px; line-height: 50px; border-radius: 8px; color: #fff; text-align: center;
         font-weight: bold; font-size: 17px; letter-spacing: .5px; }}
.clinic {{ font-size: 16px; font-weight: bold; color: {primary}; line-height: 1.2; }}
.tag {{ font-size: 9px; color: #4b5563; font-style: italic; margin-bottom: 2px; }}
td.doc {{ width: 190px; text-align: right; }}
td.doc h1 {{ margin: 0 0 6px; font-size: 17px; letter-spacing: .4px; color: #111827; text-transform: uppercase; }}
table.meta {{ width: auto; margin-left: auto; }}
table.meta th {{ text-align: right; font-weight: normal; color: #6b7280; font-size: 8.5px; padding: 1px 8px 1px 0; }}
table.meta td {{ text-align: right; font-weight: bold; font-size: 9px; padding: 1px 0; white-space: nowrap; }}

/* patient */
table.who {{ border: 1px solid #e5e7eb; margin-bottom: 14px; }}
table.who td {{ padding: 7px 10px; border-right: 1px solid #f3f4f6; }}
table.who td:last-child {{ border-right: none; }}
.k {{ font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; margin-bottom: 1px; }}
.v {{ font-size: 10px; }}
p.para .k {{ display: inline-block; margin-right: 6px; }}

/* sections: they may split across pages, a long plan should, but a heading is
   never left alone at the bottom of one with its content overleaf */
.sec {{ margin-bottom: 14px; }}
h2 {{ font-size: 10px; text-transform: uppercase; letter-spacing: .7px; color: {primary};
      border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 0 0 7px; break-after: avoid; }}
h2 .no {{ display: inline-block; width: 15px; height: 15px; line-height: 15px; border-radius: 50%;
          background: {primary}; color: #fff; text-align: center; font-size: 8px; margin-right: 7px; }}
thead {{ display: table-header-group; }}
tr {{ break-inside: avoid; }}
.para {{ margin: 6px 0 0; }}

table.defs th {{ width: 92px; text-align: left; font-weight: normal; color: #6b7280; font-size: 9px;
                 padding: 3px 10px 3px 0; }}
table.defs td {{ padding: 3px 0; white-space: pre-wrap; }}
table.defs.next {{ margin-top: 10px; }}

table.grid th {{ text-align: left; font-size: 7.5px; text-transform: uppercase; letter-spacing: .5px;
                 color: #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 5px 6px; }}
table.grid td {{ padding: 6px; border-bottom: 1px solid #f3f4f6; }}
td.tooth {{ font-weight: bold; white-space: nowrap; }}
table.grid th.n, td.n {{ text-align: right; white-space: nowrap; }}
td.num-l {{ color: #9ca3af; }}
.w-n {{ width: 16px; }} .w-tooth {{ width: 62px; }} .w-st {{ width: 64px; }}
.w-q {{ width: 28px; }} .w-f {{ width: 70px; }}
td.st {{ font-size: 8.5px; white-space: nowrap; color: #6b7280; }}
td.st-in-progress {{ color: {primary}; font-weight: bold; }}
td.st-completed {{ color: #059669; }}
tr.grp {{ break-after: avoid; }}
tr.grp td {{ background: #fff; font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px;
             color: {primary}; font-weight: bold; padding: 9px 6px 4px; border-bottom: 1px solid #e5e7eb; }}
.tbd {{ color: #9ca3af; font-style: italic; font-size: 8.5px; }}
.empty {{ color: #9ca3af; text-align: center; padding: 14px 0; margin: 0; }}

/* The total never starts a page on its own: the last line of the plan comes
   over with it, so nobody reads a figure without seeing what it adds up. */
table.totals {{ width: 260px; margin: 8px 0 0 auto; break-inside: avoid; break-before: avoid; }}
table.totals td {{ padding: 3px 6px; font-size: 9.5px; color: #4b5563; }}
table.totals tr.grand td {{ border-top: 1.5px solid {primary}; padding-top: 6px; font-size: 12px;
                            font-weight: bold; color: #111827; }}
.caveat {{ text-align: right; font-size: 8.5px; color: #6b7280; margin: 4px 0 0; }}

/* the chart and its legend are one thing: a legend alone on the next page
   explains symbols the reader can no longer see */
.chart-wrap {{ break-inside: avoid; margin-bottom: 8px; }}
.chart svg {{ width: 100%; height: auto; }}
table.legend {{ margin: 4px 0 2px; }}
table.legend td {{ width: 50%; font-size: 8.5px; color: #4b5563; padding: 1px 10px 1px 0; }}
.fdi {{ font-size: 8px; color: #9ca3af; margin: 4px 0 8px; }}

ol.terms {{ margin: 0; padding-left: 16px; font-size: 9px; color: #374151; }}
ol.terms li {{ margin-bottom: 3px; }}

.consent {{ break-inside: avoid; }}
table.sign {{ margin-top: 12px; }}
table.sign td {{ width: 46%; vertical-align: bottom; }}
table.sign td.gap {{ width: 8%; }}
.sig-box {{ height: 40px; }}
img.sig {{ max-height: 40px; max-width: 150px; object-fit: contain; }}
.line {{ border-top: 1px solid #6b7280; margin-top: 30px; }}
.sig-box + .line {{ margin-top: 0; }}
.cap {{ font-size: 8.5px; font-weight: bold; color: #374151; margin-top: 3px; }}
.cap2 {{ font-size: 8.5px; color: #6b7280; margin-top: 3px; }}
</style></head><body>
{header}
{who}
{''.join(sections)}
{terms}
{consent}
</body></html>"""
