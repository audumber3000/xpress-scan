from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.models import DashboardReport, Payment, Invoice, Expense
from app.services.infrastructure.storage_service import StorageService
from app.services.reports.base_generator import BaseReportJob
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime
from redis import Redis
from rq import Queue
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

router = APIRouter()
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
    report_db_id: int

def process_revenue_report(data: dict):
    """Background job for Financial/Revenue report with Premium AI Visuals"""
    db = next(get_db())
    job = BaseReportJob(data)
    try:
        start_dt = datetime.fromisoformat(data['start_date'].replace('Z', ''))
        end_dt = datetime.fromisoformat(data['end_date'].replace('Z', ''))
        
        # 1. Fetch Data
        rev = db.query(func.sum(Payment.amount)).filter(
            and_(Payment.clinic_id == data['clinic_id'], Payment.status == "success", 
                 Payment.created_at >= start_dt, Payment.created_at <= end_dt)
        ).scalar() or 0
        inv = db.query(func.sum(Invoice.total)).filter(
            and_(Invoice.clinic_id == data['clinic_id'], Invoice.status.in_(["paid_verified", "paid_unverified"]),
                 Invoice.updated_at >= start_dt, Invoice.updated_at <= end_dt)
        ).scalar() or 0
        
        raw_data = {
            "payment_revenue": float(rev),
            "invoice_revenue": float(inv),
            "total_revenue": float(rev + inv),
            "period": f"{data['start_date']} to {data['end_date']}"
        }
        
        # 2. AI Analysis
        analysis = job.get_ai_analysis(raw_data, "revenue growth and collection efficiency")
        
        # 3. PDF Story with Advanced Visuals
        elements = [
            Paragraph(data['title'], job.styles['ReportTitle']),
            Paragraph(f"Period: {data['start_date']} to {data['end_date']}", job.styles['SummaryText']),
            Paragraph("AI Executive Summary", job.styles['SectionHeader']),
            Paragraph(analysis.get('summary', ''), job.styles['SummaryText']),
            
            # Premium Visual: Donut Chart
            Paragraph("Revenue Mix Distribution", job.styles['SectionHeader']),
            job.generate_modern_donut_chart(
                [float(rev), float(inv)], 
                ["Direct Payments", "Invoice Collections"],
                title="Revenue Source Analysis"
            ),
            Spacer(1, 12),
            
            Paragraph("Key Insights", job.styles['SectionHeader']),
        ]
        
        # Insights Table for better structure
        for insight in analysis.get('insights', []):
            elements.append(Paragraph(f"• {insight}", job.styles['InsightItem']))
            
        elements.append(Paragraph("Strategic Recommendations", job.styles['SectionHeader']))
        for rec in analysis.get('recommendations', []):
            elements.append(Paragraph(f"• {rec}", job.styles['InsightItem']))
            
        # 4. Finalize
        file_url = job.create_pdf(elements, f"revenue_rpt_{data['report_db_id']}.pdf")
        
        # 5. Update Status
        report_record = db.query(DashboardReport).get(data['report_db_id'])
        if report_record:
            report_record.status = "completed"
            report_record.file_url = file_url
            db.commit()
            
    except Exception as e:
        print(f"❌ Revenue Job Failed: {str(e)}")
        report_record = db.query(DashboardReport).get(data['report_db_id'])
        if report_record:
            report_record.status = "failed"
            db.commit()

@router.post("/revenue")
async def generate_revenue(request: ReportRequest):
    job = report_queue.enqueue(process_revenue_report, request.dict())
    return {"success": True, "job_id": job.id}
