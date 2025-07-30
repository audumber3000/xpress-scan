from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from services.google_docs_service_personal import copy_template_and_fill, list_reports_from_folder, get_credentials
from services.google_docs_pdf_service import GoogleDocsPDFService
from services.whatsapp_service import WhatsAppService
from supabase_client import supabase
from sqlalchemy.orm import Session
from database import get_db
from models import Report, Patient
from typing import List, Optional
from datetime import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from auth import get_current_user

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
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ReportResponse])
def get_all_reports(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all reports with patient information from database and Google Drive - scoped by clinic"""
    try:
        # Get patients and reports for current clinic only
        db_patients = db.query(Patient).filter(Patient.clinic_id == current_user.clinic_id).all()
        db_reports = db.query(Report).join(Patient).filter(Patient.clinic_id == current_user.clinic_id).all()
        
        report_list = []
        for patient in db_patients:
            try:
                report = next((r for r in db_reports if r.patient_id == patient.id), None)
                if report:
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
                        created_at=report.created_at if report.created_at else patient.created_at
                    ))
                else:
                    report_list.append(ReportResponse(
                        id=None,
                        patient_name=patient.name,
                        patient_age=patient.age,
                        patient_gender=patient.gender,
                        scan_type=patient.scan_type,
                        referred_by=patient.referred_by,
                        docx_url=None,
                        pdf_url=None,
                        status="Not generated",
                        created_at=patient.created_at if patient.created_at else datetime.utcnow()
                    ))
            except Exception as entry_error:
                print(f"[REPORTS API] Skipped patient id={getattr(patient, 'id', None)} due to error: {entry_error}")
                continue
        return report_list
    except Exception as e:
        print(f"[REPORTS API] Fatal error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch reports. Please check server logs for details.")

@router.get("/from-drive")
def get_reports_from_drive():
    """Get all reports directly from Google Drive folder"""
    try:
        drive_files = list_reports_from_folder()
        return {
            "files": drive_files,
            "total": len(drive_files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-storage-config")
def test_storage_config():
    """Test endpoint to check storage configuration"""
    try:
        credentials = get_storage_credentials()
        return {
            "message": "Storage configuration test",
            "credentials": credentials,
            "supabase_url": supabase.supabase_url if hasattr(supabase, 'supabase_url') else "Not configured",
            "note": "Please provide your Supabase project URL and anon/service key for full functionality"
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/test-supabase-connection")
def test_supabase_connection():
    """Test if Supabase connection is working"""
    try:
        # Try to list files from the bucket
        files = supabase.storage.from_("xpress-scan-bucket").list()
        return {
            "message": "Supabase connection successful",
            "bucket": "xpress-scan-bucket",
            "files_count": len(files) if files else 0,
            "supabase_url": supabase.supabase_url
        }
    except Exception as e:
        return {
            "message": "Supabase connection failed",
            "error": str(e),
            "error_type": type(e).__name__,
            "supabase_url": supabase.supabase_url
        }

@router.post("/create-public-bucket")
def create_public_bucket():
    """Test endpoint to create a public bucket for PDF storage"""
    try:
        from services.google_docs_pdf_service import GoogleDocsPDFService
        
        google_service = GoogleDocsPDFService()
        success = google_service.create_public_bucket("xpress-scan-bucket")
        
        if success:
            return {
                "success": True,
                "message": "Public bucket created successfully",
                "bucket_name": "xpress-scan-bucket",
                "note": "Bucket is now public and accessible via direct URLs"
            }
        else:
            return {
                "success": False,
                "message": "Failed to create public bucket, check Supabase dashboard for bucket creation status"
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error creating public bucket"
        }

@router.post("/test-public-upload")
def test_public_upload():
    """Test endpoint for uploading a file to a public bucket and getting a public URL"""
    try:
        from services.google_docs_pdf_service import GoogleDocsPDFService
        
        # Create a simple test PDF content
        test_pdf_content = b'%PDF-1.4\n%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 0 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000000 00000 n \n0000000000 00000 n \n0000000000 00000 n \n0000000000 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF'
        
        google_service = GoogleDocsPDFService()
        
        # Upload test file
        filename = f"test_public_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        public_url = google_service.upload_pdf_to_supabase(test_pdf_content, filename)
        
        if public_url:
            return {
                "success": True,
                "message": "Test file uploaded successfully",
                "filename": filename,
                "public_url": public_url,
                "note": "Try accessing the URL directly in your browser to test public access"
            }
        else:
            return {
                "success": False,
                "message": "Failed to upload test file, check bucket permissions and Supabase configuration"
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error testing public upload"
        }

@router.get("/test-whatsapp-connection")
def test_whatsapp_connection():
    """Test WhatsApp API connection"""
    try:
        whatsapp_service = WhatsAppService()
        result = whatsapp_service.test_connection()
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "WhatsApp service test failed"
        }

@router.post("/test-google-docs-service")
def test_google_docs_service():
    """Test Google Docs service connection"""
    try:
        google_service = GoogleDocsPDFService()
        # Test if we can access Google Drive API
        return {
            "success": True,
            "message": "Google Docs service initialized successfully",
            "credentials_loaded": True
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Google Docs service test failed"
        }

@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get a specific report by ID - scoped by clinic"""
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
            created_at=report.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete report - scoped by clinic"""
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
        google_service = GoogleDocsPDFService()
        whatsapp_service = WhatsAppService()
        
        # Step 1: Export Google Docs as PDF in memory
        print(f"Exporting Google Doc {doc_id} as PDF...")
        pdf_content = google_service.export_doc_as_pdf(doc_id)
        
        if not pdf_content:
            raise HTTPException(status_code=500, detail="Failed to export Google Doc as PDF")
        
        # Step 2: Get document title for filename
        doc_title = google_service.get_doc_title(doc_id)
        filename = f"{doc_title or 'Report'}_{doc_id}.pdf"
        
        # Step 3: Upload PDF to Supabase storage
        print(f"Uploading PDF to Supabase...")
        pdf_url = google_service.upload_pdf_to_supabase(pdf_content, filename)
        
        if not pdf_url:
            raise HTTPException(status_code=500, detail="Failed to upload PDF to Supabase")
        
        # Step 4: Send PDF link via WhatsApp
        print(f"Sending WhatsApp message to {phone_number}...")
        whatsapp_result = whatsapp_service.send_pdf_link(phone_number, pdf_url)
        
        return {
            "success": True,
            "message": "PDF sent successfully via WhatsApp",
            "pdf_url": pdf_url,
            "filename": filename,
            "whatsapp_result": whatsapp_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@router.post("/send_whatsapp")
def send_whatsapp():
    return {"message": "Send WhatsApp endpoint (to be implemented)"}

@router.post("/test-pdf")
def test_pdf_generation():
    """Test endpoint for PDF generation"""
    try:
        # Test HTML content
        test_html = """
        <h1>Test Report</h1>
        <p>This is a <strong>test paragraph</strong> with some <em>formatted text</em>.</p>
        <ul>
            <li>Bullet point 1</li>
            <li>Bullet point 2</li>
        </ul>
        """
        
        # Test patient data
        test_patient = {
            'name': 'Test Patient',
            'age': 35,
            'gender': 'Male',
            'scan_type': 'CT Scan',
            'referred_by': 'Dr. Smith',
            'village': 'Test Village',
            'phone': '1234567890'
        }
        
        # Generate PDF
        pdf_path = html_to_pdf(test_html, test_patient)
        
        # Generate filename
        pdf_filename = generate_pdf_filename(test_patient['name'], test_patient['scan_type'])
        
        # Ensure bucket exists
        create_bucket_if_not_exists("xpress-scan-bucket")
        
        # Upload to Supabase
        pdf_url = upload_pdf_to_supabase(pdf_path, pdf_filename, "xpress-scan-bucket")
        
        # Clean up
        cleanup_temp_file(pdf_path)
        
        return {
            "message": "PDF generation test successful",
            "pdf_url": pdf_url,
            "filename": pdf_filename
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.post("/voice-doc")
def create_voice_doc(transcript_data: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a Google Doc from voice transcript and upload exported PDF to Supabase - scoped by clinic"""
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
        
        # Prepare patient data for template
        patient_data = {
            'name': patient.name,
            'age': patient.age,
            'gender': patient.gender,
            'scan_type': patient.scan_type,
            'referred_by': patient.referred_by,
            'village': patient.village,
            'phone': patient.phone,
            'transcript': transcript  # Keep as 'transcript' since {{report}} is not working
        }
        
        # Create Google Doc from template with patient data + transcript
        edit_url = copy_template_and_fill(patient_data)
        
        # Extract document ID from the edit URL
        try:
            doc_id = edit_url.split('/d/')[1].split('/')[0]
        except Exception:
            raise HTTPException(status_code=500, detail="Could not extract Google Doc ID from edit URL")
        
        # Export Google Doc as PDF in memory
        google_service = GoogleDocsPDFService()
        pdf_content = google_service.export_doc_as_pdf(doc_id)
        if not pdf_content:
            raise HTTPException(status_code=500, detail="Failed to export Google Doc as PDF")
        
        # Get document title for filename
        doc_title = google_service.get_doc_title(doc_id)
        filename = f"{doc_title or 'Report'}_{doc_id}.pdf"
        
        # Upload PDF to Supabase storage
        pdf_url = google_service.upload_pdf_to_supabase(pdf_content, filename)
        if not pdf_url:
            raise HTTPException(status_code=500, detail="Failed to upload PDF to Supabase")
        
        # Save report to database with both Google Doc and PDF URLs
        new_report = Report(
            patient_id=patient.id,
            docx_url=edit_url,
            pdf_url=pdf_url,
            status="completed"
        )
        db.add(new_report)
        db.commit()
        db.refresh(new_report)

        # Send WhatsApp message with PDF link
        whatsapp_service = WhatsAppService()
        whatsapp_result = whatsapp_service.send_pdf_link(patient.phone, pdf_url)

        return {
            "edit_url": edit_url,
            "pdf_url": pdf_url,
            "report_id": new_report.id,
            "whatsapp_result": whatsapp_result,
            "message": "Voice report created successfully with Google Docs PDF uploaded to cloud and WhatsApp message sent"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 