import os
from datetime import datetime
from typing import List, Dict, Any
from core.dtos import PrescriptionRequestDTO, PrescriptionItemDTO
from domains.infrastructure.services.template_service import TemplateService
from domains.infrastructure.services.pdf_service import html_template_to_pdf, generate_pdf_filename, cleanup_temp_file
from domains.infrastructure.services.r2_storage import upload_pdf_to_r2, StorageCategory
from models import PatientDocument, Patient, Clinic
from sqlalchemy.orm import Session

class PrescriptionService:
    def __init__(self, db: Session):
        self.db = db
        self.template_service = TemplateService()

    def generate_prescription_pdf(self, patient: Patient, clinic: Clinic, prescription_data: PrescriptionRequestDTO):
        """
        Generate a prescription PDF, upload to R2, and register in PatientDocument
        """
        # 1. Generate HTML for items
        items_html = ""
        for item in prescription_data.items:
            notes_html = f"<div style='font-size: 11px; color: #888; margin-top: 4px;'>{item.notes}</div>" if item.notes else ""
            items_html += f"""
            <tr>
                <td>
                    <div class="medicine-name">{item.medicine_name}</div>
                    {notes_html}
                </td>
                <td><span class="dosage">{item.dosage}</span></td>
                <td>{item.duration}</td>
                <td>{item.quantity}</td>
            </tr>
            """

        # Fetch template configuration
        from models import TemplateConfiguration
        config = self.db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == clinic.id,
            TemplateConfiguration.category == 'prescription'
        ).first()

        # Determine branding values
        primary_color = config.primary_color if config and config.primary_color else "#2a276e" # Default navy
        logo_url = config.logo_url if config and config.logo_url else clinic.logo_url
        footer_text = config.footer_text if config and config.footer_text else ""

        # 2. Prepare template data matching prescription_template.html exactly
        template_data = {
            'clinic_name': clinic.name,
            'clinic_address': clinic.address or "N/A",
            'clinic_phone': clinic.phone or "N/A",
            'clinic_email': clinic.email or "N/A",
            'clinic_logo': logo_url or "",
            'logo_display': "display: block;" if logo_url else "display: none;",
            'primary_color': primary_color,
            'footer_text': footer_text,
            'current_date': datetime.now().strftime('%B %d, %Y'),
            'patient_name': patient.name,
            'patient_id': patient.display_id or str(patient.id),
            'patient_age': str(patient.age) if patient.age else "N/A",
            'patient_gender': (patient.gender or "N/A").capitalize(),
            'patient_phone': patient.phone or "N/A",
            'prescription_items': items_html,
            'prescription_notes': prescription_data.notes or "N/A",
            'notes_display': "display: block;" if prescription_data.notes else "display: none;"
        }

        print(f"[PrescriptionService] Generating PDF for Patient: {patient.name} (ID: {patient.id})")
        print(f"[PrescriptionService] Using Branding: Color={primary_color}, Logo={logo_url}")

        # 3. Load and fill template
        try:
            template_content = self.template_service.load_template("prescription_template.html")
            html_content = self.template_service.fill_template(template_content, template_data)
        except Exception as e:
            print(f"Error filling template: {e}")
            raise e

        # 4. Convert to PDF
        temp_pdf_path = html_template_to_pdf(html_content, template_data)
        
        try:
            # 5. Upload to R2
            file_name = generate_pdf_filename(patient.name, "Prescription")
            storage_path = f"clinics/{clinic.id}/patients/{patient.id}/prescriptions/{file_name}"
            
            # Using the direct upload function (which should return the key)
            with open(temp_pdf_path, 'rb') as f:
                pdf_key = upload_pdf_to_r2(f.read(), storage_path)
            
            # 6. Register in PatientDocument
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
            
            # Also update patient's prescription JSON field with the latest items
            # This keeps a record of the items themselves, not just the PDF
            current_prescriptions = patient.prescriptions or []
            new_entry = {
                "id": len(current_prescriptions) + 1,
                "date": datetime.now().strftime('%Y-%m-%d'),
                "items": [item.dict() for item in prescription_data.items],
                "notes": prescription_data.notes,
                "pdf_key": pdf_key
            }
            current_prescriptions.insert(0, new_entry) # Add to start
            patient.prescriptions = current_prescriptions
            
            self.db.commit()
            
            return pdf_key, file_name

        finally:
            # Clean up temp file
            cleanup_temp_file(temp_pdf_path)

    def save_prescription(self, patient: Patient, prescription_data: PrescriptionRequestDTO):
        """
        Only save prescription items to the patient record without generating PDF
        """
        current_prescriptions = patient.prescriptions or []
        
        # Create new entry
        new_entry = {
            "id": len(current_prescriptions) + 1,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "items": [item.dict() for item in prescription_data.items],
            "notes": prescription_data.notes or "",
            "pdf_key": None  # Indication that PDF is not generated yet
        }
        
        # Add to prescriptions list
        current_prescriptions.insert(0, new_entry)
        patient.prescriptions = current_prescriptions
        
        self.db.commit()
        return new_entry
