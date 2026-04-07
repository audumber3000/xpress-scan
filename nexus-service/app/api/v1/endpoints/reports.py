from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DashboardReport, Clinic, Payment, Invoice, Appointment, Patient, Expense
from app.services.infrastructure.storage_service import StorageService
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import json
import io
from datetime import datetime, timedelta
from sqlalchemy import func, and_
from redis import Redis
from rq import Queue
import openai
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

router = APIRouter()

# Redis queue for reports
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
conn = Redis.from_url(redis_url)
report_queue = Queue('reports', connection=conn)

class ReportRequest(BaseModel):
    report_type: str
    report_category: str
    title: str
    start_date: str
    end_date: str
    clinic_id: int
    clinic_name: str
    report_db_id: int  # The ID created in the main backend

class ReportResponse(BaseModel):
    success: bool
    message: str
    job_id: Optional[str] = None

def get_report_data(db: Session, report_type: str, clinic_id: int, start_date: datetime, end_date: datetime):
    """Fetch raw data from DB based on report type"""
    if report_type == "monthly_revenue":
        # Sum of successful payments
        rev = db.query(func.sum(Payment.amount)).filter(
            and_(Payment.clinic_id == clinic_id, Payment.status == "success", 
                 Payment.created_at >= start_date, Payment.created_at <= end_date)
        ).scalar() or 0
        
        # Sum of paid invoices
        inv = db.query(func.sum(Invoice.total)).filter(
            and_(Invoice.clinic_id == clinic_id, Invoice.status.in_(["paid_verified", "paid_unverified"]),
                 Invoice.updated_at >= start_date, Invoice.updated_at <= end_date)
        ).scalar() or 0
        
        return {"total_revenue": rev + inv, "payment_revenue": rev, "invoice_revenue": inv}

    elif report_type == "patient_flow":
        count = db.query(func.count(Patient.id)).filter(
            and_(Patient.clinic_id == clinic_id, Patient.created_at >= start_date, Patient.created_at <= end_date)
        ).scalar() or 0
        
        appointments = db.query(func.count(Appointment.id)).filter(
            and_(Appointment.clinic_id == clinic_id, Appointment.appointment_date >= start_date, Appointment.appointment_date <= end_date)
        ).scalar() or 0
        
        return {"new_patients": count, "total_appointments": appointments}

    elif report_type == "expense_summary":
        expenses = db.query(Expense.category, func.sum(Expense.amount)).filter(
            and_(Expense.clinic_id == clinic_id, Expense.date >= start_date, Expense.date <= end_date)
        ).group_by(Expense.category).all()
        
        return {cat: amt for cat, amt in expenses}

    # Default fallback for other types
    return {"status": "Data collection for this report type is pending implementation."}

def process_report_job(report_data: Dict[str, Any]):
    """Background task for AI analysis and PDF generation"""
    db = next(get_db())
    try:
        req = ReportRequest(**report_data)
        start_dt = datetime.fromisoformat(req.start_date.replace('Z', ''))
        end_dt = datetime.fromisoformat(req.end_date.replace('Z', ''))
        
        # 1. Fetch Data
        raw_data = get_report_data(db, req.report_type, req.clinic_id, start_dt, end_dt)
        
        # 2. AI Analysis
        openai.api_key = os.getenv("OPENAI_API_KEY")
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        prompt = f"""
        Analyze this {req.report_category} data for {req.clinic_name} ({req.report_type}):
        Data: {json.dumps(raw_data)}
        
        Provide a professional report in JSON format with:
        - summary: 2-3 sentences overview.
        - insights: 3 specific bullet points.
        - recommendations: 3 actionable steps.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are a professional dental clinic consultant."},
                      {"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        
        analysis = json.loads(response.choices[0].message.content)
        
        # 3. Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], textColor=colors.HexColor('#2a276e'), spaceAfter=12)
        normal_style = styles['Normal']
        
        story = [
            Paragraph(f"{req.title}", title_style),
            Paragraph(f"Clinic: {req.clinic_name}", styles['Heading2']),
            Paragraph(f"Period: {req.start_date} to {req.end_date}", normal_style),
            Spacer(1, 12),
            Paragraph("AI Summary", styles['Heading3']),
            Paragraph(analysis.get('summary', ''), normal_style),
            Spacer(1, 12),
            Paragraph("Key Insights", styles['Heading3'])
        ]
        
        for insight in analysis.get('insights', []):
            story.append(Paragraph(f"• {insight}", normal_style))
            
        story.append(Spacer(1, 12))
        story.append(Paragraph("Recommendations", styles['Heading3']))
        for rec in analysis.get('recommendations', []):
            story.append(Paragraph(f"• {rec}", normal_style))
            
        doc.build(story)
        
        # 4. Upload to R2
        pdf_filename = f"report_{req.report_db_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        temp_path = f"/tmp/{pdf_filename}"
        with open(temp_path, "wb") as f:
            f.write(buffer.getvalue())
            
        storage_key = StorageService.upload_report_pdf(temp_path, pdf_filename, req.clinic_id)
        file_url = f"{os.getenv('R2_PUBLIC_URL', 'https://pub-8d19e4189ab25d9511db91eb129362b5.r2.dev')}/{storage_key}"
        
        # 5. Update DB record (DashboardReport)
        report_record = db.query(DashboardReport).get(req.report_db_id)
        if report_record:
            report_record.status = "completed"
            report_record.file_url = file_url
            db.commit()
            
        os.remove(temp_path)
        
    except Exception as e:
        print(f"❌ Report Job Failed: {str(e)}")
        # Update status to failed
        try:
            report_record = db.query(DashboardReport).get(req.report_db_id)
            if report_record:
                report_record.status = "failed"
                db.commit()
        except:
            pass

@router.post("/generate", response_model=ReportResponse)
async def generate_report(request: ReportRequest):
    """Enqueue a report generation job"""
    try:
        job = report_queue.enqueue(process_report_job, request.dict())
        return ReportResponse(
            success=True,
            message=f"Report '{request.title}' is being generated.",
            job_id=job.id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
