"""What was done today, written for the patient rather than for the file.

A case paper is a clinical record: abbreviations, tooth numbers, a diagnosis in
the words a dentist uses with another dentist. This is the same visit told to
the person who had it — what was found, what was done, what to do now, and when
to come back.

Deliberately narrow. It carries no prices (the invoice does that), no chart, and
no medical history — a document sent over WhatsApp may be read by whoever picks
up the phone, so it says as little about the patient as it can while still being
useful to them.
"""
from datetime import date


def _esc(v) -> str:
    return (str(v or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _as_text(value) -> str:
    """Clinical free text is stored as JSON-or-plain, the same everywhere."""
    if not value:
        return ""
    if isinstance(value, list):
        return ", ".join(str(x) for x in value if x)
    if isinstance(value, dict):
        return ", ".join(str(x) for x in value.values() if x)
    raw = str(value).strip()
    if raw.startswith("[") or raw.startswith("{"):
        try:
            import json
            return _as_text(json.loads(raw))
        except Exception:
            return raw
    return raw


def _section(title, body):
    if not body:
        return ""
    return (f"<div class='sec'><div class='lbl'>{_esc(title)}</div>"
            f"<div class='body'>{_esc(body)}</div></div>")


def render_summary(case_paper, clinic, dentist_name="", is_dental=True) -> str:
    cp = case_paper
    when = cp.date.strftime("%d %B %Y") if cp.date else ""

    done = _as_text(getattr(cp, "treatment_done", None)) or _as_text(cp.clinical_examination)
    complaint = _as_text(cp.chief_complaint)
    diagnosis = _as_text(cp.diagnosis)
    advice = _as_text(cp.notes)

    nxt = ""
    if cp.next_visit_date:
        nxt = cp.next_visit_date.strftime("%d %B %Y")
        if cp.next_visit_recommendation:
            nxt += f" — {_as_text(cp.next_visit_recommendation)}"
    elif cp.next_visit_recommendation:
        nxt = _as_text(cp.next_visit_recommendation)

    clinician = _esc(dentist_name or "")
    role = "Dentist" if is_dental else "Doctor"

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
.sec {{ margin-bottom: 13px; }}
.lbl {{ font-size: 9px; text-transform: uppercase; letter-spacing: .7px; color: #6b7280; margin-bottom: 2px; }}
.body {{ white-space: pre-wrap; }}
.next {{ background: #eef2ff; border-left: 3px solid #2a276e; padding: 10px 12px; border-radius: 4px; }}
.next .lbl {{ color: #2a276e; }}
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
    <h1>VISIT SUMMARY</h1>
    <div class="muted">{_esc(when)}</div>
  </div>
</div>

<div class="who">
  <strong>{_esc(cp.patient.name if cp.patient else '')}</strong>
  {f"<span class='muted'> &nbsp;·&nbsp; seen by {clinician} ({role})</span>" if clinician else ""}
</div>

{_section("What you came in for", complaint)}
{_section("What we found", diagnosis)}
{_section("What we did", done)}
{_section("Advice", advice)}

{f"<div class='sec next'><div class='lbl'>Your next visit</div><div class='body'>{_esc(nxt)}</div></div>" if nxt else ""}

<div class="foot">
  A summary of your visit on {_esc(when)}. Keep it for your records.
  Please call us if anything changes or you are unsure about something.
</div>
</body></html>"""
