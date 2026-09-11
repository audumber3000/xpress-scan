"""
Dashboard routes — aggregate counts and metrics for the lab dashboard.
"""
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from database import get_db
from core.auth import get_current_user
from models import LabUser, Case, Client, Payment

router = APIRouter()


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """Aggregate dashboard statistics."""
    lab_id = user.lab_id
    if not lab_id:
        return {"stats": {}}

    today = datetime.date.today()
    month_start = today.replace(day=1)
    month_start_dt = datetime.datetime.combine(month_start, datetime.time.min)

    # Case counts
    cases_received_today = db.query(func.count(Case.id)).filter(
        Case.lab_id == lab_id,
        Case.received_date == today,
    ).scalar()

    cases_in_production = db.query(func.count(Case.id)).filter(
        Case.lab_id == lab_id,
        Case.status == "in_production",
    ).scalar()

    cases_due_today = db.query(func.count(Case.id)).filter(
        Case.lab_id == lab_id,
        Case.due_date == today,
        Case.status.notin_(["delivered", "cancelled"]),
    ).scalar()

    cases_overdue = db.query(func.count(Case.id)).filter(
        Case.lab_id == lab_id,
        Case.due_date < today,
        Case.status.notin_(["delivered", "cancelled"]),
    ).scalar()

    # Delivered this month — keyed off delivery time (consistent with billing),
    # not received_date, so work bills/counts in the month it actually shipped.
    cases_delivered_month = db.query(func.count(Case.id)).filter(
        Case.lab_id == lab_id,
        Case.status == "delivered",
        Case.delivered_at.isnot(None),
        Case.delivered_at >= month_start_dt,
    ).scalar()

    # Revenue this month (delivered cases, by delivery date)
    revenue_month = db.query(func.coalesce(func.sum(Case.total_amount), 0.0)).filter(
        Case.lab_id == lab_id,
        Case.status == "delivered",
        Case.delivered_at.isnot(None),
        Case.delivered_at >= month_start_dt,
    ).scalar()

    # Total active clients
    active_clients = db.query(func.count(Client.id)).filter(
        Client.lab_id == lab_id,
        Client.is_active == True,
    ).scalar()

    return {
        "stats": {
            "cases_received_today": cases_received_today or 0,
            "cases_in_production": cases_in_production or 0,
            "cases_due_today": cases_due_today or 0,
            "cases_overdue": cases_overdue or 0,
            "cases_delivered_month": cases_delivered_month or 0,
            "revenue_month": float(revenue_month or 0),
            "active_clients": active_clients or 0,
        }
    }


@router.get("/top-clients")
def get_top_clients(
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """Top clients by revenue (delivered cases)."""
    lab_id = user.lab_id
    if not lab_id:
        return {"clients": []}

    results = db.query(
        Client.id,
        Client.name,
        Client.clinic_name,
        func.count(Case.id).label("case_count"),
        func.coalesce(func.sum(Case.total_amount), 0.0).label("total_revenue"),
    ).join(Case, Case.client_id == Client.id).filter(
        Client.lab_id == lab_id,
        Case.status == "delivered",
    ).group_by(Client.id, Client.name, Client.clinic_name).order_by(
        func.sum(Case.total_amount).desc()
    ).limit(10).all()

    return {
        "clients": [
            {
                "client_id": r.id,
                "client_name": r.name,
                "clinic_name": r.clinic_name,
                "case_count": r.case_count,
                "total_revenue": float(r.total_revenue),
            }
            for r in results
        ]
    }


@router.get("/case-trend")
def get_case_trend(
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """Cases by status — for pie/bar charts."""
    lab_id = user.lab_id
    if not lab_id:
        return {"trend": []}

    results = db.query(
        Case.status,
        func.count(Case.id).label("count"),
    ).filter(
        Case.lab_id == lab_id,
    ).group_by(Case.status).all()

    return {
        "trend": [
            {"status": r.status, "count": r.count}
            for r in results
        ]
    }
