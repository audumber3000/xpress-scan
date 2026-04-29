import datetime


def generate_prescription_html(prescription, clinic, config=None) -> str:
    """
    Generate a complete HTML prescription document.
    Mirrors the invoice_pdf_engine pattern — pure Python, no template files.
    """

    # ── Branding ───────────────────────────────────────────────────────────────
    primary_color = (
        (config.primary_color if config and config.primary_color else None) or
        getattr(clinic, 'primary_color', None) or
        '#1a2a6c'
    )
    footer_text = (config.footer_text if config and config.footer_text else '') if config else ''

    logo_url = (config.logo_url if config and config.logo_url else None) if config else None
    logo_url = logo_url or getattr(clinic, 'logo_url', None)
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
    else:
        initials = (clinic.name[:2].upper() if clinic and clinic.name else 'DC')
        logo_html = (
            f'<div style="width:75px;height:75px;background:#f0f4f8;border:2px dashed {primary_color};'
            f'display:flex;justify-content:center;align-items:center;color:{primary_color};'
            f'font-weight:bold;font-size:11px;text-align:center;">{initials}</div>'
        )

    # ── Clinic fields ──────────────────────────────────────────────────────────
    c_name    = clinic.name    if clinic else 'Dental Clinic'
    c_tagline = getattr(clinic, 'tagline', '') if clinic else ''
    c_address = clinic.address if clinic and clinic.address else ''
    c_phone   = clinic.phone   if clinic and clinic.phone   else ''
    c_email   = clinic.email   if clinic and clinic.email   else ''
    c_reg     = getattr(clinic, 'reg_number', '') if clinic else ''
    c_doctor  = getattr(clinic, 'doctor_name', '') if clinic else ''

    reg_line = f'<p>Reg No: {c_reg}</p>' if c_reg else ''

    # Doctor signature (Phase 5): from prescription.appointment.doctor if linked.
    from domains.infrastructure.services.pdf_safety import safe_signature_data_uri
    doctor_signature_uri = ''
    try:
        appt = getattr(prescription, 'appointment', None)
        if appt:
            doc = getattr(appt, 'doctor', None)
            if doc:
                doctor_signature_uri = safe_signature_data_uri(getattr(doc, 'signature_url', None))
    except Exception:
        pass
    signature_image_html = (
        f'<img src="{doctor_signature_uri}" alt="Signature" '
        f'style="display:block;max-width:140px;max-height:48px;'
        f'margin-left:auto;margin-bottom:2px;object-fit:contain;">'
    ) if doctor_signature_uri else ''

    # ── Patient fields ─────────────────────────────────────────────────────────
    patient  = prescription.patient
    p_name   = patient.name if patient else ''
    p_id     = getattr(patient, 'display_id', None) or (f'PT-{patient.id}' if patient else '—')
    p_age    = str(getattr(patient, 'age', '') or '') if patient else ''
    p_gender = (getattr(patient, 'gender', '') or '').capitalize() if patient else ''
    p_phone  = (patient.phone if patient and patient.phone else '—')
    age_gender = ' / '.join(filter(None, [p_age, p_gender]))

    # ── Date ──────────────────────────────────────────────────────────────────
    created_at = getattr(prescription, 'created_at', None)
    rx_date = created_at.strftime('%d %B %Y') if created_at else datetime.date.today().strftime('%d %B %Y')

    # ── Parse structured clinical notes ───────────────────────────────────────
    # Convention: "CC: ...", "DX: ...", "Advice: ...", "Next Visit: ..."
    notes_raw = prescription.notes or ''
    chief_complaint = ''
    diagnosis       = ''
    advice_lines    = []
    next_visit      = ''

    for line in notes_raw.splitlines():
        l = line.strip()
        if not l:
            continue
        ll = l.lower()
        if ll.startswith('cc:') or ll.startswith('chief complaint:'):
            chief_complaint = l.split(':', 1)[-1].strip()
        elif ll.startswith('dx:') or ll.startswith('diagnosis:'):
            diagnosis = l.split(':', 1)[-1].strip()
        elif ll.startswith('next visit:') or ll.startswith('follow up:') or ll.startswith('next appointment:'):
            next_visit = l.split(':', 1)[-1].strip()
        elif ll.startswith('advice:') or ll.startswith('instructions:'):
            advice_lines.append(l.split(':', 1)[-1].strip())
        else:
            advice_lines.append(l)

    # ── Clinical notes block ───────────────────────────────────────────────────
    clinical_notes_html = ''
    if chief_complaint:
        clinical_notes_html += (
            f'<div class="clinical-notes">'
            f'<h4>Chief Complaint (C/O):</h4>'
            f'<p>{chief_complaint}</p>'
            f'</div>'
        )
    if diagnosis:
        clinical_notes_html += (
            f'<div class="clinical-notes">'
            f'<h4>Diagnosis:</h4>'
            f'<p>{diagnosis}</p>'
            f'</div>'
        )

    # ── Advice block ──────────────────────────────────────────────────────────
    if advice_lines:
        items_li = ''.join(f'<li>{a}</li>' for a in advice_lines if a)
        advice_html = (
            f'<div class="advice-section">'
            f'<h4>Instructions / Advice:</h4>'
            f'<ul>{items_li}</ul>'
            f'</div>'
        )
    else:
        advice_html = '<div class="advice-section"></div>'

    # ── Medication rows ────────────────────────────────────────────────────────
    rows = ''
    for idx, item in enumerate(prescription.items or [], 1):
        medicine = item.get('medicine_name', '—')
        dosage   = item.get('dosage',   '—')
        duration = item.get('duration', '—')
        notes    = item.get('notes',    '')
        # instructions > quantity fallback
        instr    = item.get('instructions', '') or item.get('quantity', '') or '—'
        composition_html = f'<span class="med-composition">({notes})</span>' if notes else ''
        rows += (
            f'<tr>'
            f'<td>{idx}</td>'
            f'<td class="text-left"><span class="med-name">{medicine}</span>{composition_html}</td>'
            f'<td>{dosage}</td>'
            f'<td>{duration}</td>'
            f'<td>{instr}</td>'
            f'</tr>'
        )

    # ── Follow-up ─────────────────────────────────────────────────────────────
    follow_up_html = (
        f'<p class="follow-up">Next Appointment: {next_visit}</p>'
        if next_visit else ''
    )

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
body {{
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: var(--text-main);
  line-height: 1.3;
  background: #fff;
  margin: 0;
  padding: 0;
  font-size: 13px;
}}
.prescription-container {{
  width: 100%;
  background: #fff;
}}
.color-strip {{ height: 10px; background-color: var(--primary-color); }}
.prescription-body {{ padding: 40px 50px 200px 50px; }}
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
.prescription-title {{
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
.info-table strong {{ display: inline-block; min-width: 90px; color: var(--primary-color); }}
.clinical-notes {{ margin-bottom: 12px; }}
.clinical-notes h4 {{ margin: 0 0 3px 0; color: var(--primary-color); font-size: 13px; }}
.clinical-notes p {{ margin: 0 0 8px 0; font-size: 13px; }}
.rx-symbol {{ font-size: 32px; font-weight: bold; color: var(--primary-color); margin-bottom: 8px; line-height: 1; font-family: serif; }}
.med-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
.med-table th, .med-table td {{ border: 1px solid var(--border-light); padding: 6px 8px; text-align: center; }}
.med-table th {{ background-color: var(--table-header-bg); color: var(--primary-color); font-weight: bold; font-size: 11px; }}
.med-table .text-left {{ text-align: left; }}
.med-name {{ font-weight: bold; font-size: 13px; color: var(--text-main); }}
.med-composition {{ font-size: 10px; color: var(--text-muted); display: block; margin-top: 2px; font-style: italic; }}
.advice-section {{ margin-bottom: 10px; }}
.advice-section h4 {{ color: var(--primary-color); margin: 0 0 5px 0; text-transform: uppercase; font-size: 12px; }}
.advice-section ul {{ margin: 0; padding-left: 20px; }}
.advice-section li {{ margin-bottom: 4px; font-size: 12px; }}
.footer {{ font-size: 11px; color: #666; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--border-light); padding-top: 15px; }}
.terms {{ width: 65%; }}
.terms h4 {{ margin-bottom: 4px; color: var(--primary-color); text-transform: uppercase; }}
.terms ul {{ padding-left: 15px; margin: 0 0 8px 0; }}
.terms li {{ margin-bottom: 2px; }}
.follow-up {{ font-size: 13px; font-weight: bold; color: #d32f2f; margin-top: 8px; }}
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

<div class="prescription-container">
  <div class="color-strip"></div>
  <div class="prescription-body">

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
        {f'<p>📞 {c_phone}</p>' if c_phone else ''}
        {f'<p>✉️ {c_email}</p>' if c_email else ''}
        {reg_line}
      </div>
    </div>

    <div class="prescription-title">PRESCRIPTION</div>

    <!-- PATIENT INFO -->
    <div class="patient-box">
      <table class="info-table">
        <tr>
          <td>
            <p><strong>Patient Name:</strong> {p_name}</p>
            <p><strong>Patient ID:</strong> {p_id}</p>
          </td>
          <td>
            <p><strong>Age / Sex:</strong> {age_gender or '—'}</p>
            <p><strong>Date:</strong> {rx_date}</p>
          </td>
          <td>
            <p><strong>Contact:</strong> {p_phone}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- CLINICAL NOTES (CC / Diagnosis) -->
    {clinical_notes_html}

    <!-- Rx SECTION -->
    <div class="rx-symbol">&#8478;</div>
    <table class="med-table">
      <thead>
        <tr>
          <th style="width:30px;">S.No.</th>
          <th class="text-left" style="width:40%;">Medicine Name</th>
          <th style="width:80px;">Dosage<br><small>(M-A-N)</small></th>
          <th style="width:70px;">Duration</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>

    <!-- ADVICE / INSTRUCTIONS -->
    {advice_html}

    {f'<div style="text-align:center;color:#888;font-size:10px;margin-top:16px;border-top:1px solid #eee;padding-top:10px;">{footer_text}</div>' if footer_text else ''}

  </div>

  <!-- FIXED FOOTER -->
  <div class="footer-wrapper">
    <div class="footer">
      <div class="terms">
        <h4>Terms &amp; Conditions</h4>
        <ul>
          <li>This prescription is valid for 7 days from the date of issue.</li>
          <li>Medicines must be taken strictly as directed. Do not alter the dosage without consulting the doctor.</li>
          <li>Complete the full course of antibiotics even if symptoms subside early.</li>
          <li>In case of any allergic reaction or adverse effects, stop medication and contact the clinic immediately.</li>
          <li>This prescription is issued for the named patient only and is non-transferable.</li>
          <li>This is a computer-generated prescription and does not require a physical signature.</li>
        </ul>
        {follow_up_html}
      </div>
      <div class="signature-box">
        {signature_image_html}
        <div class="signature-line">{c_doctor or 'Authorized Signatory'}</div>
        <p style="margin:5px 0 0 0;color:var(--text-muted);font-weight:bold;">{c_name}</p>
      </div>
    </div>
    <div class="color-strip"></div>
  </div>
</div>

</body></html>"""
