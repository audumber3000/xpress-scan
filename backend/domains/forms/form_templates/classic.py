"""Classic signed medical-history variant.

Sits beside consent_templates/classic.py and shares its branding sources, so a
clinic's consent and its medical history come out looking like the same
practice produced them.

Where it deliberately differs from the consent renderer: a consent is prose the
patient agreed to, so it renders the text and a signature. A history is a
questionnaire, and the answers alone are not the record. What was *not* ticked
matters as much as what was — "the patient did not declare a bleeding disorder"
is the sentence a clinic needs six months later, and it can only be said if the
document shows the whole list with the empty boxes still on it. So the
condition grid prints in full, ticked and unticked, exactly like the paper form
it replaces.

WeasyPrint-safe CSS only. Every user-controlled string goes through the Phase 0
sanitisers before it reaches the markup.
"""
from datetime import datetime

from domains.infrastructure.services.pdf_safety import (
    safe_color, safe_signature_data_uri, safe_text,
)
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri
from domains.infrastructure.services.pdf_fields import resolve_field_visibility

# Layout types carry no answer, so they are headings here rather than rows.
_LAYOUT = {"section"}
_BLANK = "—"


def _answer_text(field, answers):
    """One field's answer as display text, or None when it isn't a simple row.

    Returns None for the types that need their own markup (the grid, the
    declaration, the signature) so the caller can render those properly instead
    of flattening a forty-item list into a comma-soup nobody reads.
    """
    v = answers.get(field["key"])
    ftype = field["type"]

    if ftype in ("checkbox_grid", "declaration", "signature"):
        return None
    if ftype == "yes_no_explain":
        if not isinstance(v, dict):
            # Older or hand-posted answers may be a bare string.
            return safe_text(v) if v else _BLANK
        said = (v.get("answer") or "").strip()
        why = (v.get("explain") or "").strip()
        if not said:
            return _BLANK
        return f"<strong>{safe_text(said)}</strong>" + (f" &mdash; {safe_text(why)}" if why else "")
    if ftype == "boolean":
        return "Yes" if v is True else ("No" if v is False else _BLANK)
    if ftype == "multi_select":
        return safe_text(", ".join(str(x) for x in v)) if isinstance(v, list) and v else _BLANK
    if v in (None, "", []):
        return _BLANK
    return safe_text(v)


def _grid_html(field, answers, primary_color):
    """The tick list, printed whole.

    Both states are drawn, because a list showing only the ticked boxes is a
    summary and this document has to be evidence of what the patient was asked.
    """
    picked = answers.get(field["key"])
    picked = set(picked) if isinstance(picked, list) else set()
    options = field.get("options") or []

    # Four columns, filled down each one so the printed order reads the way the
    # paper form does rather than jumping across the page.
    cols = 4
    per_col = (len(options) + cols - 1) // cols or 1
    chunks = [options[i:i + per_col] for i in range(0, len(options), per_col)] or [[]]
    while len(chunks) < cols:
        chunks.append([])

    cells = ""
    for chunk in chunks:
        items = ""
        for opt in chunk:
            on = opt in picked
            box = (
                f'<span class="tick on" style="border-color:{primary_color};'
                f'background:{primary_color};">&#10003;</span>' if on
                else '<span class="tick"></span>'
            )
            items += (f'<div class="tick-row{" ticked" if on else ""}">'
                      f'{box}<span>{safe_text(opt)}</span></div>')
        cells += f'<td class="grid-col">{items}</td>'

    none_note = ('<p class="none-note">The patient ticked none of the above.</p>'
                 if not picked else '')
    return (f'<table class="grid-table"><tr>{cells}</tr></table>{none_note}')


def _declaration_html(field, answers):
    agreed = answers.get(field["key"]) is True
    body = ""
    for para in (field.get("help") or "").split("\n"):
        para = para.strip()
        if para:
            body += f"<p>{safe_text(para)}</p>"
    mark = ('<span class="agreed">&#10003; Agreed by the patient</span>' if agreed
            else '<span class="not-agreed">Not agreed</span>')
    return f'<div class="declaration">{body}<div class="agree-line">{mark}</div></div>'


def render_medical_form(clinic, patient_name, patient_id, template_name,
                        schema, answers, signature_base64, config=None,
                        submitted_at=None, reference=None, signed_ip=None) -> str:
    """Build the branded HTML for a completed medical history.

    Returns an HTML string; the caller renders it to PDF and stores it, the
    same division of labour the consent renderer uses.
    """
    schema = schema or []
    answers = answers or {}

    # ── Branding, identical sources to the consent document ─────────────────
    primary_color = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default='#1a2a6c',
    )
    vis = resolve_field_visibility(config)
    footer_text = safe_text(
        (config.footer_text if config and config.footer_text else '') if config else ''
    ) if vis.footer else ''

    logo_url = resolve_logo_data_uri(
        (config.logo_url if config else None), getattr(clinic, 'logo_url', None),
    )
    if logo_url:
        logo_html = (f'<img src="{logo_url}" alt="Logo" '
                     f'style="width:70px;height:70px;object-fit:contain;">')
    else:
        initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'MP')
        logo_html = (
            f'<div style="width:70px;height:70px;background:#f0f4f8;'
            f'border:2px dashed {primary_color};color:{primary_color};'
            f'font-weight:bold;font-size:11px;text-align:center;line-height:70px;">'
            f'{initials}</div>'
        )

    c_name    = safe_text(clinic.name if clinic else 'Clinic')
    c_tagline = safe_text((getattr(clinic, 'tagline', '') or '') if vis.tagline else '')
    c_address = safe_text((getattr(clinic, 'address', '') or '') if vis.address else '')
    c_phone   = safe_text((getattr(clinic, 'phone', '') or '') if vis.contact else '')
    c_email   = safe_text((getattr(clinic, 'email', '') or '') if vis.contact else '')
    c_reg     = safe_text((getattr(clinic, 'license_number', '') or '') if vis.license_number else '')
    c_doctor  = safe_text(getattr(clinic, 'doctor_name', '') or '')

    # ── Body: headings open a section, everything else is a row inside it ────
    body = ""
    open_section = False
    rows_buffer = ""

    def flush():
        nonlocal rows_buffer
        out = f'<table class="answers">{rows_buffer}</table>' if rows_buffer else ''
        rows_buffer = ""
        return out

    for field in schema:
        ftype = field["type"]

        if ftype in _LAYOUT:
            body += flush()
            if open_section:
                body += '</div>'
            hint = safe_text(field.get("help") or "")
            body += (
                f'<div class="section">'
                f'<div class="section-head" style="border-left:4px solid {primary_color};">'
                f'<span style="color:{primary_color};">{safe_text(field["label"])}</span>'
                f'{f"<em>{hint}</em>" if hint else ""}</div>'
            )
            open_section = True
            continue

        if ftype == "checkbox_grid":
            body += flush()
            body += (f'<div class="q-block"><div class="q-label">'
                     f'{safe_text(field["label"])}</div>'
                     f'{_grid_html(field, answers, primary_color)}</div>')
            continue

        if ftype == "declaration":
            body += flush()
            body += (f'<div class="q-block"><div class="q-label">'
                     f'{safe_text(field["label"])}</div>'
                     f'{_declaration_html(field, answers)}</div>')
            continue

        if ftype == "signature":
            continue  # rendered in its own block below, never mid-form

        text = _answer_text(field, answers)
        blank = ' class="blank"' if text == _BLANK else ''
        rows_buffer += (
            f'<tr><td class="q">{safe_text(field["label"])}</td>'
            f'<td class="a"><span{blank}>{text}</span></td></tr>'
        )

    body += flush()
    if open_section:
        body += '</div>'

    # ── Signature block ─────────────────────────────────────────────────────
    sig_field = next((f for f in schema if f["type"] == "signature"), None)
    sig_value = answers.get(sig_field["key"]) if sig_field else None
    sig_src = signature_base64 or sig_value or ''
    if sig_src and not sig_src.startswith('data:'):
        sig_src = f'data:image/png;base64,{sig_src}'
    clean_sig = safe_signature_data_uri(sig_src)
    sig_img_html = (
        f'<img src="{clean_sig}" alt="Patient signature" class="sig-img">' if clean_sig
        else '<p class="blank">No signature was captured.</p>'
    )

    when = submitted_at or datetime.utcnow()
    signed_on = when.strftime('%d %B %Y, %I:%M %p')
    p_id_display = f'PT-{patient_id}' if patient_id else _BLANK
    ref = safe_text(reference or _BLANK)
    ip_line = f' &middot; Submitted from {safe_text(signed_ip)}' if signed_ip else ''

    footer_text_html = (
        f'<div class="clinic-footer">{footer_text}</div>' if footer_text else ''
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
:root {{
  --primary-color: {primary_color};
  --text-main: #333;
  --text-muted: #666;
  --border-light: #ddd;
}}
@page {{ size: A4; margin: 12mm 10mm 14mm 10mm; }}
body {{
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--text-main); line-height: 1.35; background: #fff;
  margin: 0; padding: 0; font-size: 11px;
}}
.color-strip {{ height: 8px; background-color: var(--primary-color); }}
.header {{
  border-bottom: 2px solid var(--border-light);
  padding: 14px 0 10px 0; margin-bottom: 10px;
}}
.header table {{ width: 100%; border-collapse: collapse; }}
.header td {{ vertical-align: top; }}
.clinic-name {{
  margin: 0; color: var(--primary-color); text-transform: uppercase;
  letter-spacing: 1px; font-size: 20px; line-height: 1.1;
}}
.tagline {{ margin: 3px 0 0 0; font-size: 12px; color: var(--primary-color); font-weight: bold; }}
.clinic-right {{ text-align: right; }}
.clinic-right p {{ margin: 2px 0; font-size: 10px; color: var(--text-muted); }}
.doc-title {{
  text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 2px;
  text-transform: uppercase; margin: 6px 0 10px 0; text-decoration: underline;
}}
.ident {{ width: 100%; border-collapse: collapse; margin-bottom: 12px;
          background: #f8fafc; border: 1px solid #eef2f6; }}
.ident td {{ padding: 5px 8px; font-size: 10.5px; width: 25%; vertical-align: top; }}
.ident strong {{ display: block; color: var(--primary-color); font-size: 9px;
                 text-transform: uppercase; letter-spacing: .6px; margin-bottom: 2px; }}
.section {{ margin-bottom: 12px; }}
.section-head {{
  padding: 4px 0 4px 8px; margin-bottom: 6px; font-size: 12px;
  font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
  background: #f8fafc;
}}
.section-head em {{
  display: block; font-weight: normal; text-transform: none; letter-spacing: 0;
  font-size: 9.5px; color: var(--text-muted); font-style: italic; margin-top: 2px;
}}
.answers {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; }}
.answers td {{ padding: 4px 6px; border-bottom: 1px solid #f0f2f5; vertical-align: top; }}
.answers td.q {{ width: 42%; color: var(--text-muted); }}
.answers td.a {{ width: 58%; font-weight: bold; }}
.blank {{ color: #b9c0c8; font-weight: normal; }}
.q-block {{ margin: 8px 0 12px 0; }}
.q-label {{ font-weight: bold; margin-bottom: 6px; font-size: 11.5px; }}
.grid-table {{ width: 100%; border-collapse: collapse;
               border: 1px solid #e6eaee; padding: 4px; }}
.grid-col {{ vertical-align: top; width: 25%; padding: 6px 8px; }}
.tick-row {{ font-size: 10px; margin-bottom: 3px; color: var(--text-muted); }}
.tick-row.ticked {{ color: var(--text-main); font-weight: bold; }}
.tick {{
  display: inline-block; width: 9px; height: 9px; border: 1px solid #98a2ad;
  margin-right: 5px; text-align: center; line-height: 9px; font-size: 8px;
}}
.tick.on {{ color: #fff; }}
.none-note {{ font-size: 9.5px; color: var(--text-muted); font-style: italic; margin: 4px 0 0 0; }}
.declaration {{ border: 1px solid #e6eaee; padding: 10px 12px; background: #fcfdfe; }}
/* What must never be split by a page break: a declaration whose agreement line
   lands on the next page reads as unsigned, and a signature separated from the
   name under it is the one thing a challenge would go after. The condition grid
   is deliberately allowed to break — it is forty rows and forcing it whole
   would push a mostly empty page in front of it. */
.declaration, .agree-line, .sig-section {{ page-break-inside: avoid; }}
.answers tr, .tick-row {{ page-break-inside: avoid; }}
.section-head {{ page-break-after: avoid; }}
.declaration p {{ margin: 0 0 6px 0; font-size: 10px; text-align: justify; line-height: 1.5; }}
.agree-line {{ margin-top: 6px; padding-top: 6px; border-top: 1px solid #e6eaee; }}
.agreed {{ color: #0f7b52; font-weight: bold; font-size: 11px; }}
.not-agreed {{ color: #b42318; font-weight: bold; font-size: 11px; }}
.sig-section {{ margin-top: 14px; padding-top: 10px; border-top: 2px solid var(--border-light); }}
.sig-section h4 {{
  color: var(--primary-color); font-size: 10px; text-transform: uppercase;
  letter-spacing: 1px; margin: 0 0 6px 0;
}}
.sig-img {{ max-width: 230px; max-height: 90px; display: block; object-fit: contain; }}
.sig-line {{ border-top: 1px solid var(--text-main); width: 250px; margin-top: 4px;
             padding-top: 4px; font-size: 10px; font-weight: bold; }}
.audit {{
  margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-light);
  font-size: 8.5px; color: #8a939c; line-height: 1.5;
}}
.clinic-footer {{ text-align: center; color: #888; font-size: 9px; margin-top: 10px; }}
</style>
</head><body>

<div class="color-strip"></div>

<div class="header">
  <table>
    <tr>
      <td style="width:80px;">{logo_html}</td>
      <td>
        <h1 class="clinic-name">{c_name}</h1>
        {f'<div class="tagline">{c_tagline}</div>' if c_tagline else ''}
      </td>
      <td class="clinic-right">
        {f'<p><strong>{c_doctor}</strong></p>' if c_doctor else ''}
        {f'<p>{c_address}</p>' if c_address else ''}
        {f'<p>Tel: {c_phone}</p>' if c_phone else ''}
        {f'<p>{c_email}</p>' if c_email else ''}
        {f'<p>Reg No: {c_reg}</p>' if c_reg else ''}
      </td>
    </tr>
  </table>
</div>

<div class="doc-title">{safe_text(template_name)}</div>

<table class="ident">
  <tr>
    <td><strong>Patient</strong>{safe_text(patient_name)}</td>
    <td><strong>Patient ID</strong>{p_id_display}</td>
    <td><strong>Completed on</strong>{signed_on}</td>
    <td><strong>Reference</strong>{ref}</td>
  </tr>
</table>

{body}

<div class="sig-section">
  <h4>Signature of patient, parent or guardian</h4>
  {sig_img_html}
  <div class="sig-line">{safe_text(patient_name)}</div>
  <p style="font-size:9.5px;color:#8a939c;margin:6px 0 0 0;font-style:italic;">
    Signed electronically on {signed_on}. By signing, the patient agrees that
    the main member is aware of this form where it is signed by a dependant.
  </p>
</div>

<div class="audit">
  Completed by the patient on their own device and submitted to {c_name} on
  {signed_on}{ip_line}. Reference {ref}. This is a digitally signed record and
  is valid under the Information Technology Act, 2000. The answers above are
  the patient's own; the clinic has not altered them.
</div>

{footer_text_html}

</body></html>"""
