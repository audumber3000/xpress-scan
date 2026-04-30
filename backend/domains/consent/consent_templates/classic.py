"""Classic signed-consent variant.

Ported from `nexus-service/app/services/infrastructure/pdf_service.py:_generate_consent_html`
in Phase 8 so consent rendering lives in the main backend like every other PDF
engine. Nexus now calls `POST /api/v1/internal/consent/render` instead of
holding its own renderer.

WeasyPrint-safe CSS only. Phase 0 sanitisers applied to all user-controlled
strings (color / footer / logo URL / signature data URI).
"""
from datetime import datetime

from domains.infrastructure.services.pdf_safety import (
    safe_color, safe_signature_data_uri, safe_text, safe_url,
)


def render_consent(clinic, patient_name, patient_id, template_name,
                   content, signature_base64, config=None) -> str:
    """Build a branded HTML signed-consent document. Returns HTML string;
    caller is responsible for rendering to PDF (WeasyPrint) and storage."""

    # ── Branding ────────────────────────────────────────────────────────────
    primary_color = safe_color(
        (config.primary_color if config and config.primary_color else None)
        or getattr(clinic, 'primary_color', None),
        default='#1a2a6c',
    )
    footer_text = safe_text(
        (config.footer_text if config and config.footer_text else '') if config else ''
    )

    raw_logo_url = (config.logo_url if config and config.logo_url else None) if config else None
    raw_logo_url = raw_logo_url or getattr(clinic, 'logo_url', None)
    logo_url = safe_url(raw_logo_url)
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
    else:
        initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = (
            f'<div style="width:75px;height:75px;background:#f0f4f8;border:2px dashed {primary_color};'
            f'display:flex;justify-content:center;align-items:center;color:{primary_color};'
            f'font-weight:bold;font-size:11px;text-align:center;">{initials}</div>'
        )

    # ── Clinic fields ───────────────────────────────────────────────────────
    c_name    = safe_text(clinic.name    if clinic else 'Dental Clinic')
    c_tagline = safe_text(getattr(clinic, 'tagline', '') or '')
    c_address = safe_text(getattr(clinic, 'address', '') or '')
    c_phone   = safe_text(getattr(clinic, 'phone',   '') or '')
    c_email   = safe_text(getattr(clinic, 'email',   '') or '')
    c_reg     = safe_text(getattr(clinic, 'reg_number', '') or '')
    c_doctor  = safe_text(getattr(clinic, 'doctor_name', '') or '')

    reg_line = f'<p>Reg No: {c_reg}</p>' if c_reg else ''

    # ── Signature image (Phase 0: validate before embedding) ────────────────
    sig_img_html = ''
    if signature_base64:
        sig_src = signature_base64
        if not sig_src.startswith('data:'):
            sig_src = f'data:image/png;base64,{sig_src}'
        clean = safe_signature_data_uri(sig_src)
        if clean:
            sig_img_html = (
                f'<img src="{clean}" alt="Patient signature" '
                f'style="max-width:240px;max-height:110px;display:block;margin-bottom:6px;'
                f'object-fit:contain;">'
            )

    # ── Content paragraphs ──────────────────────────────────────────────────
    content_paragraphs = ''
    for line in (content or '').split('\n'):
        stripped = line.strip()
        if stripped:
            content_paragraphs += f'<p>{safe_text(stripped)}</p>\n'

    footer_text_html = (
        f'<div style="text-align:center;color:#888;font-size:10px;margin-top:16px;'
        f'border-top:1px solid #eee;padding-top:10px;">{footer_text}</div>'
    ) if footer_text else ''

    sign_date = datetime.now().strftime('%d %B %Y, %I:%M %p')
    p_id_display = f'PT-{patient_id}' if patient_id else '—'

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
:root {{
  --primary-color: {primary_color};
  --text-main: #333;
  --text-muted: #555;
  --border-light: #ddd;
  --table-header-bg: #f8fafc;
  --highlight-bg: #f0f4f8;
}}
@page {{ size: A4; margin: 2mm; }}
body {{
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--text-main);
  line-height: 1.4;
  background: #fff;
  margin: 0;
  padding: 0;
  font-size: 13px;
}}
.consent-container {{ width: 100%; background: #fff; }}
.color-strip {{ height: 10px; background-color: var(--primary-color); }}
.consent-body {{ padding: 40px 50px 200px 50px; }}
.footer-wrapper {{
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 0 50px;
}}
.header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 15px;
  margin-bottom: 15px;
}}
.header-left {{ display: flex; align-items: center; }}
.clinic-info-left h1 {{
  margin: 0;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 24px;
  line-height: 1.1;
}}
.clinic-info-left .tagline {{ margin: 3px 0; font-size: 16px; color: var(--primary-color); font-weight: bold; }}
.clinic-info-right {{ text-align: right; }}
.clinic-info-right .doc-name {{ font-size: 14px; font-weight: bold; color: var(--primary-color); margin: 0 0 4px 0; }}
.clinic-info-right p {{ margin: 2px 0; font-size: 11px; color: var(--text-muted); font-weight: 500; }}
.consent-title {{
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  margin: 10px 0 15px 0;
  color: var(--text-main);
  text-decoration: underline;
  letter-spacing: 2px;
}}
.patient-box {{
  background: var(--highlight-bg);
  padding: 10px 12px;
  border-radius: 5px;
  border: 1px solid var(--border-light);
  margin-bottom: 15px;
}}
.info-table {{ width: 100%; border-collapse: collapse; }}
.info-table td {{ vertical-align: top; width: 33%; padding: 2px 4px; }}
.info-table p {{ margin: 3px 0; font-size: 12px; }}
.info-table strong {{ display: inline-block; min-width: 100px; color: var(--primary-color); }}
.content-section {{ margin-bottom: 20px; }}
.content-section h4 {{
  margin: 0 0 8px 0;
  color: var(--primary-color);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
}}
.content-section p {{ margin: 0 0 8px 0; font-size: 13px; line-height: 1.7; text-align: justify; }}
.signature-section {{
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid var(--border-light);
}}
.signature-section h4 {{
  color: var(--primary-color);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 10px 0;
}}
.sig-line {{
  border-top: 1px solid var(--text-main);
  margin-top: 5px;
  padding-top: 5px;
  font-weight: bold;
  color: var(--primary-color);
  font-size: 12px;
}}
.footer {{
  font-size: 11px;
  color: #666;
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid var(--border-light);
  padding-top: 15px;
}}
.terms {{ width: 65%; }}
.terms h4 {{ margin-bottom: 4px; color: var(--primary-color); text-transform: uppercase; }}
.terms ul {{ padding-left: 15px; margin: 0 0 8px 0; }}
.terms li {{ margin-bottom: 2px; }}
.signature-box {{ width: 30%; text-align: center; }}
.signature-line {{
  border-top: 1px solid var(--text-main);
  margin-top: 40px;
  padding-top: 5px;
  font-weight: bold;
  color: var(--primary-color);
  font-size: 12px;
}}
</style>
</head><body>

<div class="consent-container">
  <div class="color-strip"></div>
  <div class="consent-body">

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div style="margin-right:20px;flex-shrink:0;">{logo_html}</div>
        <div class="clinic-info-left">
          <h1>{c_name}</h1>
          {f'<div class="tagline">{c_tagline}</div>' if c_tagline else ''}
        </div>
      </div>
      <div class="clinic-info-right">
        {f'<div class="doc-name">{c_doctor}</div>' if c_doctor else ''}
        {f'<p>{c_address}</p>' if c_address else ''}
        {f'<p>Tel: {c_phone}</p>' if c_phone else ''}
        {f'<p>Email: {c_email}</p>' if c_email else ''}
        {reg_line}
      </div>
    </div>

    <div class="consent-title">CONSENT FORM</div>

    <!-- PATIENT INFO -->
    <div class="patient-box">
      <table class="info-table">
        <tr>
          <td>
            <p><strong>Patient Name:</strong> {safe_text(patient_name)}</p>
            <p><strong>Patient ID:</strong> {p_id_display}</p>
          </td>
          <td>
            <p><strong>Document:</strong> {safe_text(template_name)}</p>
            <p><strong>Date Signed:</strong> {sign_date}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- CONSENT CONTENT -->
    <div class="content-section">
      <h4>Terms &amp; Conditions</h4>
      {content_paragraphs}
    </div>

    <!-- PATIENT SIGNATURE -->
    <div class="signature-section">
      <h4>Patient's Digital Signature</h4>
      {sig_img_html}
      <p style="font-size:11px;color:#888;margin:5px 0 0 0;font-style:italic;">
        Electronically signed on {sign_date}
      </p>
    </div>

    {footer_text_html}

  </div>

  <!-- FIXED FOOTER -->
  <div class="footer-wrapper">
    <div class="footer">
      <div class="terms">
        <h4>Terms &amp; Conditions</h4>
        <ul>
          <li>This consent is specific to the procedure or treatment described above.</li>
          <li>The patient has been given the opportunity to ask questions and receive satisfactory answers.</li>
          <li>This consent may be withdrawn at any time prior to the commencement of the procedure.</li>
          <li>This is a digitally signed document and is legally valid under the IT Act, 2000.</li>
        </ul>
      </div>
      <div class="signature-box">
        <div class="signature-line">{c_doctor or 'Authorized Signatory'}</div>
        <p style="margin:5px 0 0 0;color:var(--text-muted);font-weight:bold;">{c_name}</p>
      </div>
    </div>
    <div class="color-strip"></div>
  </div>
</div>

</body></html>"""
