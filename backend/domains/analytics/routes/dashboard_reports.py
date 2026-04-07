from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import DashboardReport, Clinic
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from core.auth_utils import get_current_user
import uuid
import httpx
import os
import boto3
from botocore.config import Config
import io

router = APIRouter()

# R2 Client Configuration
def get_r2_client():
    access_key_id = os.getenv("R2_ACCESS_KEY_ID")
    secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
    endpoint_url = os.getenv("R2_ENDPOINT_URL")
    
    if not all([access_key_id, secret_access_key, endpoint_url]):
        return None
        
    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name='auto',
        config=Config(signature_version='s3v4')
    )

class ReportGenerateRequest(BaseModel):
    report_type: str
    report_category: str
    title: str
    start_date: str
    end_date: str

class DashboardReportResponse(BaseModel):
    id: int
    report_category: str
    report_type: str
    title: str
    parameters: Dict
    status: str
    file_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/history", response_model=List[DashboardReportResponse])
def get_report_history(
    category: Optional[str] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get history of generated dashboard reports"""
    query = db.query(DashboardReport).filter(DashboardReport.clinic_id == current_user.clinic_id)
    
    if category:
        query = query.filter(DashboardReport.report_category == category)
    if report_type:
        query = query.filter(DashboardReport.report_type == report_type)
        
    reports = query.order_by(DashboardReport.created_at.desc()).all()
    return reports

@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Securely download a report PDF from R2 without redirecting to a public URL"""
    report = db.query(DashboardReport).filter(
        DashboardReport.id == report_id,
        DashboardReport.clinic_id == current_user.clinic_id
    ).first()
    
    if not report or not report.file_url:
        raise HTTPException(status_code=404, detail="Report or file not found")
        
    if report.status != "completed":
        raise HTTPException(status_code=400, detail="Report is not ready for download")

    # Extract the R2 key from the URL or metadata
    # file_url format: https://.../clinics/{id}/reports/dashboard/{filename}
    # We can reconstruct the key from the record meta or parse the URL
    url_parts = report.file_url.split('.dev/')
    if len(url_parts) < 2:
        # Fallback to reconstructing key if URL is unexpected
        filename = report.file_url.split('/')[-1]
        key = f"clinics/{report.clinic_id}/reports/dashboard/{filename}"
    else:
        key = url_parts[1]

    client = get_r2_client()
    if not client:
        raise HTTPException(status_code=500, detail="Storage service not configured")

    try:
        bucket_name = os.getenv("R2_BUCKET_NAME")
        response = client.get_object(Bucket=bucket_name, Key=key)
        
        # Stream the file content back to the client directly from R2 response body
        return StreamingResponse(
            response['Body'], 
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{report.title.replace(" ", "_")}.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        print(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve file from storage")

@router.get("/{report_id}", response_model=DashboardReportResponse)
def get_report_status(
    report_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Check the status of a specific report"""
    report = db.query(DashboardReport).filter(
        DashboardReport.id == report_id,
        DashboardReport.clinic_id == current_user.clinic_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return report

@router.post("/generate", response_model=DashboardReportResponse)
async def generate_dashboard_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Trigger generation of a dashboard report via nexus-service"""
    # Create the report record in database with 'generating' status
    new_report = DashboardReport(
        clinic_id=current_user.clinic_id,
        report_category=request.report_category,
        report_type=request.report_type,
        title=request.title,
        parameters={
            "start_date": request.start_date,
            "end_date": request.end_date,
            "generated_by": f"{current_user.first_name} {current_user.last_name}"
        },
        status="generating",
        file_url=None,
        created_by=current_user.id
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    try:
        # Call nexus-service for AI-powered report generation
        nexus_url = os.getenv("NEXUS_URL", "http://localhost:8001")
        
        # Get clinic information
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        clinic_name = clinic.name if clinic else "Unknown Clinic"
        
        # Map report_type to specific Nexus URL
        nexus_url_map = {
            "monthly_revenue": "/api/v1/reports/financial/revenue",
            "outstanding_invoices": "/api/v1/reports/financial/revenue",
            "expense_summary": "/api/v1/reports/financial/revenue",
            "patient_flow": "/api/v1/reports/operational/flow",
            "appointment_utilization": "/api/v1/reports/operational/flow",
            "treatment_plans": "/api/v1/reports/clinical/treatment",
            "procedure_breakdown": "/api/v1/reports/clinical/treatment"
        }
        
        target_path = nexus_url_map.get(request.report_type, "/api/v1/reports/generate")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{nexus_url}{target_path}",
                json={
                    "report_type": request.report_type,
                    "report_category": request.report_category,
                    "title": request.title,
                    "start_date": request.start_date,
                    "end_date": request.end_date,
                    "clinic_id": current_user.clinic_id,
                    "clinic_name": clinic_name,
                    "report_db_id": new_report.id
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    return new_report
                else:
                    new_report.status = "failed"
                    db.commit()
                    raise HTTPException(status_code=500, detail=result.get("message", "Report enqueuing failed"))
            else:
                new_report.status = "failed"
                db.commit()
                raise HTTPException(status_code=500, detail=f"Nexus service error: {response.status_code}")
                
    except httpx.RequestError as e:
        new_report.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to connect to nexus service: {str(e)}")
    except Exception as e:
        new_report.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@router.post("/send")
async def send_report(
    report_id: int,
    method: str, # "email" or "whatsapp"
    destination: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mock endpoint for sending reports via email or whatsapp"""
    report = db.query(DashboardReport).filter(
        DashboardReport.id == report_id,
        DashboardReport.clinic_id == current_user.clinic_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return {
        "status": "success",
        "message": f"Report '{report.title}' has been sent via {method} to {destination}."
    }
