from fastapi import APIRouter, HTTPException, Depends, status, Response
from sqlalchemy.orm import Session
from database import get_db
from models import Prescription, User, Patient
from schemas import PrescriptionCreate, PrescriptionOut
from core.auth_utils import get_current_user, require_doctor_or_owner
from typing import List, Optional
from datetime import datetime
from domains.activity.routes.activity_log import push_activity
from domains.medical.services.prescription_service import PrescriptionService
from domains.infrastructure.services.pdf_service import html_template_to_pdf
from domains.clinical.prescription_pdf_engine import generate_prescription_html
from core.notification_dispatch import notify_event
import os
import requests
import re

from models import Clinic, TemplateConfiguration

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

@router.get("/patient/{patient_id}", response_model=List[PrescriptionOut])
def get_patient_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all medication prescriptions for a patient."""
    return db.query(Prescription).filter(
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id
    ).order_by(Prescription.created_at.desc()).all()

@router.post("", response_model=PrescriptionOut)
def create_prescription(
    prescription: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """
    Create a new medication prescription.
    Stores the prescription data in the main backend.
    PDF generation triggers separately via Nexus.
    """
    # Convert item models to dicts for JSON storage
    items_data = [item.model_dump() for item in prescription.items]
    
    db_prescription = Prescription(
        **prescription.model_dump(exclude={"clinic_id", "items"}),
        items=items_data,
        clinic_id=current_user.clinic_id
    )
    db.add(db_prescription)
    db.commit()
    db.refresh(db_prescription)
    try:
        patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
        actor = getattr(current_user, 'name', None) or getattr(current_user, 'email', 'Doctor')
        push_activity(db, current_user.clinic_id, 'prescription_saved',
            f"Prescription saved for {patient.name if patient else 'patient'}",
            link=f"/patients/{prescription.patient_id}",
            actor_name=actor)
        db.commit()
    except Exception:
        pass
    return db_prescription

@router.delete("/{prescription_id}")
def delete_prescription(
    prescription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Delete a medication prescription."""
    db_prescription = db.query(Prescription).filter(
        Prescription.id == prescription_id,
        Prescription.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
        
    db.delete(db_prescription)
    db.commit()
    return {"message": "Prescription deleted successfully"}

@router.get("/{prescription_id}/pdf")
def download_prescription_pdf(
    prescription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and return a prescription PDF — mirrors the invoice /pdf endpoint."""
    prescription = db.query(Prescription).filter(
        Prescription.id == prescription_id,
        Prescription.clinic_id == current_user.clinic_id
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == 'prescription'
    ).first()

    html_content = generate_prescription_html(prescription, clinic, config)
    pdf_path = html_template_to_pdf(html_content)

    with open(pdf_path, 'rb') as f:
        pdf_content = f.read()
    try:
        os.remove(pdf_path)
    except Exception:
        pass

    return Response(
        content=pdf_content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="prescription_{prescription_id}.pdf"'}
    )


@router.post("/{prescription_id}/send-whatsapp")
async def send_prescription_via_whatsapp(
    prescription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate Prescription PDF and send to patient via professional WhatsApp Service.
    """
    try:
        # 1. Fetch prescription and clinic info
        prescription = db.query(Prescription).filter(
            Prescription.id == prescription_id,
            Prescription.clinic_id == current_user.clinic_id
        ).first()
        if not prescription:
            raise HTTPException(status_code=404, detail="Prescription not found")
        
        patient = prescription.patient
        if not patient or not patient.phone:
            raise HTTPException(status_code=400, detail="Patient phone number is required")
            
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        config = db.query(TemplateConfiguration).filter(
            TemplateConfiguration.clinic_id == current_user.clinic_id,
            TemplateConfiguration.category == 'prescription'
        ).first()

        # 2. Generate PDF using Legacy Engine (Supports CC/Dx parsing)
        service = PrescriptionService(db)
        html_content, _ = service.generate_prescription_pdf_from_model(prescription, clinic, config)
        pdf_path = html_template_to_pdf(html_content)
        
        # 3. Upload to Nexus Media Service (Official Legacy Flow)
        NEXUS_SERVICES_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
        try:
            with open(pdf_path, 'rb') as f:
                files = {'file': (f'Prescription_{prescription_id}.pdf', f, 'application/pdf')}
                data = {'clinic_id': str(current_user.clinic_id), 'patient_id': str(patient.id)}
                resp = requests.post(f"{NEXUS_SERVICES_URL}/api/v1/notifications/media/upload", files=files, data=data, timeout=30)
                
            # Cleanup temp file
            if os.path.exists(pdf_path): os.remove(pdf_path)
            
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Nexus Upload Failed: {resp.text}")
            
            media_id = resp.json().get("media_id") # Nexus returns public R2 URL as media_id
        except Exception as e:
            if os.path.exists(pdf_path): os.remove(pdf_path)
            raise HTTPException(status_code=500, detail=f"Nexus Connection Error: {str(e)}")

        # 4. Dispatch WhatsApp event via Nexus (Universal Service)
        notify_event(
            "prescription_notification",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=patient.phone,
            to_name=patient.name,
            template_data={
                "patient_name": patient.name,
                "clinic_name": clinic.name,
                "doctor_name": getattr(clinic, "doctor_name", "your doctor"),
                "clinic_phone": clinic.phone or "",
                "media_id": media_id  # Nexus handles this public R2 URL
            }
        )
        
        return {"success": True, "message": "Prescription sharing initiated via official Nexus service"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp Error: {str(e)}")
