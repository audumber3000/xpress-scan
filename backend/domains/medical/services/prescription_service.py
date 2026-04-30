import os
from datetime import datetime
from typing import List, Dict, Any
from core.dtos import PrescriptionRequestDTO, PrescriptionItemDTO
from domains.infrastructure.services.template_service import TemplateService
from domains.infrastructure.services.pdf_service import html_template_to_pdf, generate_pdf_filename, cleanup_temp_file
from domains.infrastructure.services.pdf_safety import safe_color, safe_signature_data_uri, safe_text, safe_url
from domains.infrastructure.services.r2_storage import upload_pdf_to_r2, StorageCategory
from models import PatientDocument, Patient, Clinic, Prescription as PrescriptionModel
from sqlalchemy.orm import Session


class PrescriptionService:
    def __init__(self, db: Session):
        self.db = db
        self.template_service = TemplateService()

    def render_prescription_html(self, patient, clinic, prescription_data, config_override=None, doctor=None) -> str:
        """Render the prescription HTML using the same logic as production PDF
        generation. Pass `config_override` (a config-shaped object with
        primary_color/footer_text/logo_url) to skip the DB lookup — used by
        the templates preview endpoint with the admin's unsaved changes.

        `doctor` is the prescribing User; if their `signature_url` is set
        (Phase 5) the signature image is embedded in the signature box.
        """
        # ── Branding ──────────────────────────────────────────────────────────
        if config_override is not None:
            config = config_override
        else:
            from models import TemplateConfiguration
            config = self.db.query(TemplateConfiguration).filter(
                TemplateConfiguration.clinic_id == clinic.id,
                TemplateConfiguration.category == 'prescription'
            ).first()

        primary_color = safe_color(
            (config.primary_color if config and config.primary_color else None)
            or getattr(clinic, 'primary_color', None),
            default='#1a2a6c',
        )
        logo_url = safe_url(
            (config.logo_url if config and config.logo_url else None)
            or getattr(clinic, 'logo_url', None)
        )
        footer_text = safe_text((config.footer_text if config and config.footer_text else '') or '')

        # ── Logo HTML ─────────────────────────────────────────────────────────
        if logo_url:
            logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
        else:
            initials = safe_text(clinic.name[:2].upper() if clinic and clinic.name else 'DC')
            logo_html = (
                f'<div style="width:75px;height:75px;background:#f0f4f8;'
                f'border:2px dashed {primary_color};display:flex;justify-content:center;'
                f'align-items:center;color:{primary_color};font-weight:bold;font-size:12px;'
                f'text-align:center;">{initials}</div>'
            )

        # ── Clinic fields ─────────────────────────────────────────────────────
        c_name    = clinic.name    if clinic else 'Dental Clinic'
        c_tagline = getattr(clinic, 'tagline', 'Comprehensive Dental & Orthodontic Care') or ''
        c_address = clinic.address if clinic and clinic.address else ''
        c_phone   = clinic.phone   if clinic and clinic.phone   else ''
        c_email   = clinic.email   if clinic and clinic.email   else ''
        c_reg     = getattr(clinic, 'reg_number', '')           or ''
        c_doctor  = getattr(clinic, 'doctor_name', '')          or ''

        doctor_name_html  = f'<div class="doc-name">{c_doctor}</div>'  if c_doctor  else ''
        clinic_address_html = f'<p>{c_address}</p>'                    if c_address else ''
        clinic_phone_html   = f'<p>Tel: {c_phone}</p>'                 if c_phone   else ''
        clinic_email_html   = f'<p>Email: {c_email}</p>'               if c_email   else ''
        clinic_reg_html     = f'<p>Reg No: {c_reg}</p>'                if c_reg     else ''

        doctor_signature_label = c_doctor if c_doctor else 'Doctor\'s Signature'

        # Doctor signature image (Phase 5) — embedded above the signature line
        # when the prescribing doctor has uploaded one.
        doctor_signature_uri = safe_signature_data_uri(getattr(doctor, 'signature_url', None) if doctor else None)
        signature_image_html = (
            f'<img src="{doctor_signature_uri}" alt="Signature" '
            f'style="display:block;max-width:140px;max-height:48px;'
            f'margin-left:auto;margin-bottom:2px;object-fit:contain;">'
        ) if doctor_signature_uri else ''

        # ── Patient fields ────────────────────────────────────────────────────
        p_name   = patient.name if patient else ''
        p_id     = getattr(patient, 'display_id', None) or str(patient.id) if patient else ''
        p_age    = str(patient.age)    if patient and patient.age    else 'N/A'
        p_gender = (patient.gender or 'N/A').capitalize() if patient else 'N/A'
        p_phone  = patient.phone       if patient and patient.phone  else 'N/A'

        # ── Clinical notes (stored in prescription_data.notes) ────────────────
        # Format: use notes as a combined clinical notes block
        notes_raw = prescription_data.notes or ''
        # Try to split "Chief Complaint: ...\nDiagnosis: ..." if the frontend sends it structured
        chief_complaint = ''
        diagnosis       = ''
        advice_lines    = []
        next_visit      = ''
        remaining_notes = notes_raw

        # Simple convention: lines starting with specific prefixes
        for line in notes_raw.splitlines():
            l = line.strip()
            if l.lower().startswith('cc:') or l.lower().startswith('chief complaint:'):
                chief_complaint = l.split(':', 1)[-1].strip()
            elif l.lower().startswith('dx:') or l.lower().startswith('diagnosis:'):
                diagnosis = l.split(':', 1)[-1].strip()
            elif l.lower().startswith('advice:') or l.lower().startswith('instructions:'):
                advice_lines.append(l.split(':', 1)[-1].strip())
            elif l.lower().startswith('next visit:') or l.lower().startswith('follow up:') or l.lower().startswith('next appointment:'):
                next_visit = l.split(':', 1)[-1].strip()
            elif l and not chief_complaint and not diagnosis:
                # If no structured prefixes, treat whole notes as general advice
                advice_lines.append(l)

        # Build clinical notes block
        if chief_complaint or diagnosis:
            clinical_notes_parts = []
            if chief_complaint:
                clinical_notes_parts.append(
                    f'<div class="clinical-notes"><h4>Chief Complaint (C/O):</h4><p>{chief_complaint}</p></div>'
                )
            if diagnosis:
                clinical_notes_parts.append(
                    f'<div class="clinical-notes"><h4>Diagnosis:</h4><p>{diagnosis}</p></div>'
                )
            clinical_notes_html = ''.join(clinical_notes_parts)
        elif notes_raw:
            clinical_notes_html = (
                f'<div class="clinical-notes"><h4>Clinical Notes:</h4>'
                f'<p>{notes_raw.replace(chr(10), "<br>")}</p></div>'
            )
        else:
            clinical_notes_html = ''

        # Build advice block
        if advice_lines:
            items_html = ''.join(f'<li>{a}</li>' for a in advice_lines if a)
            advice_html = (
                f'<div class="advice-section">'
                f'<h4>Instructions / Advice:</h4>'
                f'<ul>{items_html}</ul>'
                f'</div>'
            )
        else:
            advice_html = '<div class="advice-section"></div>'

        # Follow-up line
        if next_visit:
            follow_up_html = f'Next Appointment: {next_visit}'
        else:
            follow_up_html = ''

        # Footer text block
        footer_text_html = (
            f'<div style="text-align:center;color:#888;font-size:10px;margin-top:14px;'
            f'border-top:1px solid #eee;padding-top:10px;">{footer_text}</div>'
        ) if footer_text else ''

        # ── Medication rows ───────────────────────────────────────────────────
        items_html = ''
        for idx, item in enumerate(prescription_data.items, 1):
            # item.notes is used as "Instructions" (e.g., "After meals")
            composition_html = (
                f'<span class="med-composition">({item.notes})</span>'
                if item.notes else ''
            )
            instructions = ''  # notes already shown as composition; qty as instructions fallback
            if item.quantity:
                instructions = str(item.quantity)

            items_html += f"""
            <tr>
                <td>{idx}</td>
                <td class="text-left">
                    <span class="med-name">{item.medicine_name}</span>
                    {composition_html}
                </td>
                <td>{item.dosage}</td>
                <td>{item.duration}</td>
                <td>{instructions}</td>
            </tr>"""

        # ── Build template_data dict ──────────────────────────────────────────
        template_data = {
            'primary_color':        primary_color,
            'logo_html':            logo_html,
            'clinic_name':          c_name,
            'clinic_tagline':       c_tagline,
            'doctor_name_html':     doctor_name_html,
            'clinic_address_html':  clinic_address_html,
            'clinic_phone_html':    clinic_phone_html,
            'clinic_email_html':    clinic_email_html,
            'clinic_reg_html':      clinic_reg_html,
            'doctor_signature_label': doctor_signature_label,
            'patient_name':         p_name,
            'patient_id':           p_id,
            'patient_age':          p_age,
            'patient_gender':       p_gender,
            'patient_phone':        p_phone,
            'current_date':         datetime.now().strftime('%d %B %Y'),
            'clinical_notes_html':  clinical_notes_html,
            'prescription_items':   items_html,
            'advice_html':          advice_html,
            'follow_up_html':       follow_up_html,
            'footer_text_html':     footer_text_html,
            'signature_image_html': signature_image_html,
        }

        print(f"[PrescriptionService] Building HTML for Patient: {getattr(patient, 'name', '?')}")
        print(f"[PrescriptionService] Branding: color={primary_color}, logo={'yes' if logo_url else 'initials'}")

        # ── Render template (variant-aware via registry) ──────────────────────
        from domains.medical.prescription_templates import resolve_variant
        template_id = getattr(config, 'template_id', None) if config else None
        variant = resolve_variant(template_id)
        try:
            template_content = self.template_service.load_template(variant['template_file'])
            html_content     = self.template_service.fill_template(template_content, template_data)
        except Exception as e:
            print(f"Error filling prescription template: {e}")
            raise e

        return html_content

    def generate_prescription_pdf(self, patient: Patient, clinic: Clinic, prescription_data: PrescriptionRequestDTO, doctor=None):
        """
        Generate a prescription PDF, upload to R2, and register in PatientDocument.
        `doctor` is the prescribing User — if set, their signature is embedded.
        """
        html_content = self.render_prescription_html(patient, clinic, prescription_data, doctor=doctor)

        # ── Convert to PDF ────────────────────────────────────────────────────
        temp_pdf_path = html_template_to_pdf(html_content, {'patient_name': patient.name})

        try:
            file_name    = generate_pdf_filename(patient.name, "Prescription")
            storage_path = f"clinics/{clinic.id}/patients/{patient.id}/prescriptions/{file_name}"

            with open(temp_pdf_path, 'rb') as f:
                pdf_key = upload_pdf_to_r2(f.read(), storage_path)

            doc = PatientDocument(
                patient_id=patient.id,
                clinic_id=clinic.id,
                file_name=file_name,
                file_path=pdf_key,
                file_size=os.path.getsize(temp_pdf_path),
                file_type="pdf",
                created_at=datetime.utcnow()
            )
            self.db.add(doc)

            current_prescriptions = patient.prescriptions or []
            new_entry = {
                "id":      len(current_prescriptions) + 1,
                "date":    datetime.now().strftime('%Y-%m-%d'),
                "items":   [item.dict() for item in prescription_data.items],
                "notes":   prescription_data.notes,
                "pdf_key": pdf_key
            }
            current_prescriptions.insert(0, new_entry)
            patient.prescriptions = current_prescriptions

            self.db.commit()
            return pdf_key, file_name

        finally:
            cleanup_temp_file(temp_pdf_path)

    def save_prescription(self, patient: Patient, prescription_data: PrescriptionRequestDTO):
        """
        Only save prescription items to the patient record without generating PDF
        """
        current_prescriptions = patient.prescriptions or []
        new_entry = {
            "id":      len(current_prescriptions) + 1,
            "date":    datetime.now().strftime('%Y-%m-%d'),
            "items":   [item.dict() for item in prescription_data.items],
            "notes":   prescription_data.notes or "",
            "pdf_key": None
        }
        current_prescriptions.insert(0, new_entry)
        patient.prescriptions = current_prescriptions
        return new_entry

    def generate_prescription_pdf_from_model(self, prescription: PrescriptionModel, clinic: Clinic, config=None):
        """
        Render an HTML prescription for the WhatsApp + download flows.

        Phase 8 cleanup: this used to call a parallel legacy engine that
        ignored the variant registry — meaning a clinic that picked the
        'compact' template still got the 'classic' layout when sending via
        WhatsApp. Now both flows route through `render_prescription_html`
        so the chosen variant (classic | compact | future…) is respected
        consistently. Returns `(html, {})` to keep the existing call sites
        in `clinical/routes/prescriptions.py` working unchanged.
        """
        if not config:
            from models import TemplateConfiguration
            config = self.db.query(TemplateConfiguration).filter(
                TemplateConfiguration.clinic_id == clinic.id,
                TemplateConfiguration.category == 'prescription'
            ).first()

        # Coerce the JSON-stored item dicts into the dotted-attribute shape
        # render_prescription_html expects (mirrors PrescriptionRequestDTO).
        from types import SimpleNamespace
        items = []
        for raw in (prescription.items or []):
            if isinstance(raw, dict):
                items.append(SimpleNamespace(
                    medicine_name=raw.get('medicine_name') or raw.get('name') or '',
                    dosage=raw.get('dosage') or '',
                    duration=raw.get('duration') or '',
                    quantity=raw.get('quantity') or '',
                    notes=raw.get('notes') or '',
                ))
            else:
                items.append(raw)

        prescription_data = SimpleNamespace(
            items=items,
            notes=prescription.notes or '',
        )

        # Prescribing doctor (for Phase 5 signature embed). May be None.
        doctor = None
        try:
            appt = getattr(prescription, 'appointment', None)
            if appt:
                doctor = getattr(appt, 'doctor', None)
        except Exception:
            pass

        patient = prescription.patient
        html_content = self.render_prescription_html(
            patient, clinic, prescription_data,
            config_override=config, doctor=doctor,
        )
        return html_content, {}

    def _generate_prescription_pdf_from_model_legacy(self, prescription: PrescriptionModel, clinic: Clinic, config=None):
        """Legacy implementation kept for reference — not called anywhere."""
        patient = prescription.patient

        if not config:
            from models import TemplateConfiguration
            config = self.db.query(TemplateConfiguration).filter(
                TemplateConfiguration.clinic_id == clinic.id,
                TemplateConfiguration.category == 'prescription'
            ).first()

        primary_color = (config.primary_color if config and config.primary_color else None) \
                        or getattr(clinic, 'primary_color', None) or '#1a2a6c'
        logo_url      = (config.logo_url if config and config.logo_url else None) \
                        or getattr(clinic, 'logo_url', None)

        # ── Logo HTML ─────────────────────────────────────────────────────────
        if logo_url:
            logo_html = f'<img src="{logo_url}" alt="Logo" style="width:75px;height:75px;object-fit:contain;">'
        else:
            initials = (clinic.name[:2].upper() if clinic and clinic.name else 'DC')
            logo_html = (
                f'<div style="width:75px;height:75px;background:#f0f4f8;'
                f'border:2px dashed {primary_color};display:flex;justify-content:center;'
                f'align-items:center;color:{primary_color};font-weight:bold;font-size:12px;'
                f'text-align:center;">{initials}</div>'
            )

        # ── Clinical notes parsing (Legacy Feature) ───────────────────────────
        notes_raw = prescription.notes or ''
        chief_complaint = ''
        diagnosis       = ''
        advice_lines    = []
        next_visit      = ''

        for line in notes_raw.splitlines():
            l = line.strip()
            if not l: continue
            if l.lower().startswith('cc:') or l.lower().startswith('chief complaint:'):
                chief_complaint = l.split(':', 1)[-1].strip()
            elif l.lower().startswith('dx:') or l.lower().startswith('diagnosis:'):
                diagnosis = l.split(':', 1)[-1].strip()
            elif l.lower().startswith('advice:') or l.lower().startswith('instructions:'):
                advice_lines.append(l.split(':', 1)[-1].strip())
            elif any(l.lower().startswith(p) for p in ['next visit:', 'follow up:', 'next appointment:']):
                next_visit = l.split(':', 1)[-1].strip()
            else:
                advice_lines.append(l)

        # Build clinical notes block
        clinical_notes_parts = []
        if chief_complaint: clinical_notes_parts.append(f'<div class="clinical-notes"><h4>Chief Complaint:</h4><p>{chief_complaint}</p></div>')
        if diagnosis: clinical_notes_parts.append(f'<div class="clinical-notes"><h4>Diagnosis:</h4><p>{diagnosis}</p></div>')
        clinical_notes_html = ''.join(clinical_notes_parts) if clinical_notes_parts else (f'<div class="clinical-notes"><p>{notes_raw}</p></div>' if notes_raw else '')

        # Build advice block
        advice_html = ''
        if advice_lines:
            items_li = ''.join(f'<li>{a}</li>' for a in advice_lines)
            advice_html = f'<div class="advice-section"><h4>Advice / Instructions:</h4><ul>{items_li}</ul></div>'

        # ── Medication rows ───────────────────────────────────────────────────
        items_html = ''
        for idx, item in enumerate(prescription.items or [], 1):
            dosage = item.get('dosage', '')
            duration = item.get('duration', '')
            medicine = item.get('medicine_name', 'Unknown Medicine')
            instr = item.get('notes', '') or item.get('quantity', '')
            items_html += f"""
            <tr>
                <td>{idx}</td>
                <td class="text-left"><span class="med-name">{medicine}</span></td>
                <td>{dosage}</td>
                <td>{duration}</td>
                <td>{instr}</td>
            </tr>"""

        # ── Final Context Building (Legacy Synchronized) ──────────────────────
        template_data = {
            'primary_color':        primary_color,
            'logo_html':            logo_html,
            'clinic_name':          clinic.name,
            'clinic_tagline':       getattr(clinic, 'tagline', 'Dental Excellence'),
            'doctor_name_html':     f'<div class="doc-name">{getattr(clinic, "doctor_name", "")}</div>',
            'clinic_address_html':  f'<p>{clinic.address or ""}</p>',
            'clinic_phone_html':    f'<p>Tel: {clinic.phone or ""}</p>',
            'clinic_email_html':    f'<p>Email: {clinic.email or ""}</p>',
            'clinic_reg_html':      f'<p>Reg: {getattr(clinic, "reg_number", "")}</p>',
            'doctor_signature_label': getattr(clinic, 'doctor_name', 'Authorized Signature'),
            'patient_name':         patient.name,
            'patient_id':           getattr(patient, 'display_id', str(patient.id)),
            'patient_age':          str(patient.age or 'N/A'),
            'patient_gender':       (patient.gender or 'N/A').capitalize(),
            'patient_phone':        patient.phone or 'N/A',
            'current_date':         datetime.now().strftime('%d %B %Y'),
            'clinical_notes_html':  clinical_notes_html,
            'prescription_items':   items_html,
            'advice_html':          advice_html,
            'follow_up_html':       f'Next Appointment: {next_visit}' if next_visit else '',
            'footer_text_html':     f'<div style="text-align:center;font-size:10px;">{config.footer_text or ""}</div>' if config and config.footer_text else '',
        }

        template_content = self.template_service.load_template("prescription_template.html")
        html_content     = self.template_service.fill_template(template_content, template_data)
        
        return html_content, template_data
