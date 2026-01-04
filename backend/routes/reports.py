from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from services.pdf_service import html_template_to_pdf, generate_pdf_filename, cleanup_temp_file
from services.supabase_storage import upload_pdf_to_supabase, create_bucket_if_not_exists
from services.template_service import TemplateService
from sqlalchemy.orm import Session
from database import get_db
from models import Report, Patient
from typing import List, Optional
from datetime import datetime
from auth import get_current_user

import os

router = APIRouter()

class PatientInfo(BaseModel):
    name: str
    age: int
    gender: str
    scan_type: str
    referred_by: str
    # Add more fields as needed

    class Config:
        from_attributes = True

class ReportResponse(BaseModel):
    id: int
    patient_name: str
    patient_age: int
    patient_gender: str
    scan_type: str
    referred_by: str
    docx_url: Optional[str] = None
    pdf_url: Optional[str] = None
    status: str
    whatsapp_sent_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ReportResponse])
def get_all_reports(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all reports with patient information from database - scoped by clinic"""
    # Check if user has permission to view reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view reports")
    
    try:
        # Get all reports for current clinic with patient information
        reports = db.query(Report).join(Patient).filter(
            Patient.clinic_id == current_user.clinic_id
        ).order_by(Report.created_at.desc()).all()
        
        report_list = []
        for report in reports:
            try:
                patient = report.patient
                report_list.append(ReportResponse(
                    id=report.id,
                    patient_name=patient.name,
                    patient_age=patient.age,
                    patient_gender=patient.gender,
                    scan_type=patient.scan_type,
                    referred_by=patient.referred_by,
                    docx_url=report.docx_url,
                    pdf_url=report.pdf_url,
                    status=report.status,
                    whatsapp_sent_count=report.whatsapp_sent_count or 0,
                    created_at=report.created_at if report.created_at else datetime.utcnow(),
                    updated_at=getattr(report, 'updated_at', report.created_at if report.created_at else datetime.utcnow()),
                    synced_at=getattr(report, 'synced_at', None),
                    sync_status=getattr(report, 'sync_status', 'local')
                ))
            except Exception as entry_error:
                print(f"[REPORTS API] Skipped report id={getattr(report, 'id', None)} due to error: {entry_error}")
                continue
        
        return report_list
    except Exception as e:
        print(f"[REPORTS API] Fatal error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch reports. Please check server logs for details.")

@router.get("/from-drive")
def get_reports_from_drive():
    """Get all reports directly from Google Drive folder"""
    try:
        # This functionality was removed from the original file, so this endpoint is now a placeholder.
        # If you need to retrieve reports from Google Drive, you'll need to re-implement the Google Docs service.
        return {"message": "Reports from Google Drive are not currently available."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get a specific report by ID - scoped by clinic"""
    # Check if user has permission to view reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view reports")
    
    try:
        # Get report that belongs to current clinic
        report = db.query(Report).join(Patient).filter(
            Report.id == report_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        return ReportResponse(
            id=report.id,
            patient_name=patient.name,
            patient_age=patient.age,
            patient_gender=patient.gender,
            scan_type=patient.scan_type,
            referred_by=patient.referred_by,
            docx_url=report.docx_url,
            pdf_url=report.pdf_url,
            status=report.status,
            whatsapp_sent_count=report.whatsapp_sent_count or 0,
            created_at=report.created_at,
            updated_at=getattr(report, 'updated_at', report.created_at),
            synced_at=getattr(report, 'synced_at', None),
            sync_status=getattr(report, 'sync_status', 'local')
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete report - scoped by clinic"""
    # Check if user has permission to delete reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("delete", False):
            raise HTTPException(status_code=403, detail="You don't have permission to delete reports")
    
    # Get report that belongs to current clinic
    report = db.query(Report).join(Patient).filter(
        Report.id == report_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}

@router.post("/generate")
def generate_report():
    return {"message": "Generate report endpoint (to be implemented)"}

@router.post("/create-doc")
def create_doc(patient: PatientInfo, db: Session = Depends(get_db)):
    # Remove patient creation logic from here. Only allow report creation from voice reporting.
    raise HTTPException(status_code=403, detail="Report creation is only allowed from Voice Reporting.")

@router.post("/upload")
def upload_report():
    return {"message": "Upload report endpoint (to be implemented)"}

@router.post("/send-patient-pdf")
def send_patient_pdf(request_data: dict):
    """
    Send Google Docs PDF via WhatsApp
    
    Expected JSON body:
    {
        "doc_id": "Google Docs document ID",
        "phone_number": "919876543210"
    }
    """
    try:
        doc_id = request_data.get("doc_id")
        phone_number = request_data.get("phone_number")
        
        if not doc_id:
            raise HTTPException(status_code=400, detail="doc_id is required")
        if not phone_number:
            raise HTTPException(status_code=400, detail="phone_number is required")
        
        # Initialize services
        # This functionality was removed from the original file, so this endpoint is now a placeholder.
        # If you need to send a PDF via WhatsApp, you'll need to re-implement the Google Docs PDF service.
        raise HTTPException(status_code=501, detail="PDF sending via WhatsApp is not currently implemented.")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@router.post("/voice-doc")
def create_voice_doc(transcript_data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a report from voice transcript and save as draft - scoped by clinic"""
    # Check if user has permission to edit reports (creating reports is considered editing)
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to create reports")
    
    try:
        transcript = transcript_data.get("transcript", "")
        patient_id = transcript_data.get("patient_id")
        
        if not transcript:
            raise HTTPException(status_code=400, detail="Transcript is required")
        if not patient_id:
            raise HTTPException(status_code=400, detail="Patient ID is required")
        
        # Get patient data from database - scoped by clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Prepare patient data for report
        patient_data = {
            'name': patient.name,
            'age': patient.age,
            'gender': patient.gender,
            'scan_type': patient.scan_type,
            'referred_by': patient.referred_by,
            'village': patient.village,
            'phone': patient.phone,
            'transcript': transcript
        }
        
        # Save report to database as draft (no PDF generation yet)
        new_report = Report(
            clinic_id=current_user.clinic_id,
            patient_id=patient.id,
            content=transcript,  # Save the transcript content
            docx_url=None,  # No Google Doc URL
            pdf_url=None,   # No PDF URL yet
            status="draft"  # Save as draft
        )
        db.add(new_report)
        db.commit()
        db.refresh(new_report)

        return {
            "report_id": new_report.id,
            "status": "draft",
            "message": "Voice report saved as draft successfully. You can edit and finalize it later."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 

@router.post("/{report_id}/finalize")
def finalize_report(report_id: int, final_data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Finalize a draft report and generate PDF - scoped by clinic"""
    # Check if user has permission to edit reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to finalize reports")
    
    try:
        # Get report from database - scoped by clinic
        report = db.query(Report).filter(
            Report.id == report_id,
            Report.clinic_id == current_user.clinic_id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft reports can be finalized")
        
        # Get patient data
        patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get the final report content
        report_content = final_data.get("content", "")
        if not report_content:
            raise HTTPException(status_code=400, detail="Report content is required")
        
        # Prepare patient data for template
        patient_data = {
            'name': patient.name,
            'age': patient.age,
            'gender': patient.gender,
            'scan_type': patient.scan_type,
            'referred_by': patient.referred_by,
            'village': patient.village,
            'phone': patient.phone,
            'clinic_name': current_user.clinic.name if hasattr(current_user, 'clinic') else 'Radiology Clinic',
            'doctor_name': f"{current_user.first_name} {current_user.last_name}"
        }
        
        # Use template service to generate HTML report
        template_service = TemplateService()
        html_report = template_service.render_report(
            template_name="radiology_template.html",
            patient_data=patient_data,
            report_content=report_content
        )
        
        # Generate PDF from HTML template
        pdf_path = html_template_to_pdf(html_report, patient_data)
        
        # Generate filename
        filename = generate_pdf_filename(patient.name, patient.scan_type)
        
        # Ensure bucket exists
        create_bucket_if_not_exists("betterclinic-bdent")
        
        # Upload to R2 Storage in patient-medical-reports folder
        pdf_url = upload_pdf_to_supabase(pdf_path, filename, "betterclinic-bdent")
        
        # Clean up temporary file
        cleanup_temp_file(pdf_path)
        
        # Update report status to final
        report.status = "final"
        report.pdf_url = pdf_url  # This might be None if upload failed
        report.docx_url = None  # No Google Doc URL
        db.commit()
        
        if pdf_url:
            return {
                "report_id": report.id,
                "status": "final",
                "pdf_url": pdf_url,
                "filename": filename,
                "message": "Report finalized successfully. PDF uploaded to cloud storage."
            }
        else:
            return {
                "report_id": report.id,
                "status": "final",
                "pdf_url": None,
                "filename": None,
                "message": "Report finalized successfully, but PDF upload failed. You can retry PDF generation later."
            }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{report_id}/draft")
def get_draft_report(report_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get draft report data for editing - scoped by clinic"""
    # Check if user has permission to view reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view reports")
    
    try:
        # Get report from database - scoped by clinic
        report = db.query(Report).filter(
            Report.id == report_id,
            Report.clinic_id == current_user.clinic_id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft reports can be edited")
        
        # Get patient data
        patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        return {
            "report_id": report.id,
            "content": report.content or "",
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "scan_type": patient.scan_type,
                "referred_by": patient.referred_by,
                "village": patient.village,
                "phone": patient.phone
            },
            "status": report.status,
            "created_at": report.created_at
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{report_id}/draft")
def update_draft_report(report_id: int, draft_data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update a draft report content - scoped by clinic"""
    # Check if user has permission to edit reports
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        reports_permissions = permissions.get("reports", {})
        if not reports_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit reports")
    
    try:
        # Get report from database - scoped by clinic
        report = db.query(Report).filter(
            Report.id == report_id,
            Report.clinic_id == current_user.clinic_id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft reports can be updated")
        
        # Update report content
        new_content = draft_data.get("content", "")
        report.content = new_content
        db.commit()
        
        return {
            "report_id": report.id,
            "status": "draft",
            "message": "Draft report updated successfully."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Template endpoints moved to main.py as public endpoints
# These are now accessible via /public/templates and /public/templates/{template_name} 