import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import get_db
from models import Clinic, User, Patient, Appointment, Invoice, SupportTicket
from routes.auth import get_current_admin

router = APIRouter()


@router.get("/overview")
def overview(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    total_clinics = db.query(func.count(Clinic.id)).scalar() or 0
    active_clinics = db.query(func.count(Clinic.id)).filter(Clinic.status == "active").scalar() or 0
    suspended_clinics = db.query(func.count(Clinic.id)).filter(Clinic.status == "suspended").scalar() or 0
    free_clinics = db.query(func.count(Clinic.id)).filter(Clinic.subscription_plan == "free").scalar() or 0
    paid_clinics = db.query(func.count(Clinic.id)).filter(Clinic.subscription_plan != "free").scalar() or 0

    now = datetime.datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = db.query(func.count(Clinic.id)).filter(Clinic.created_at >= month_start).scalar() or 0

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_appointments = db.query(func.count(Appointment.id)).scalar() or 0

    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    total_revenue = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).filter(
        Invoice.status.in_(["paid_verified", "paid_unverified", "partially_paid"])
    ).scalar() or 0

    open_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar() or 0
    in_progress_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "in_progress").scalar() or 0
    resolved_today = db.query(func.count(SupportTicket.id)).filter(
        SupportTicket.status == "resolved",
        SupportTicket.updated_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)
    ).scalar() or 0
    total_tickets = db.query(func.count(SupportTicket.id)).scalar() or 0

    return {
        "clinics": {
            "total": total_clinics,
            "active": active_clinics,
            "suspended": suspended_clinics,
            "free": free_clinics,
            "paid": paid_clinics,
            "new_this_month": new_this_month,
        },
        "patients": {"total": total_patients},
        "appointments": {"total": total_appointments},
        "invoices": {"total": total_invoices, "total_revenue": round(float(total_revenue), 2)},
        "tickets": {
            "total": total_tickets,
            "open": open_tickets,
            "in_progress": in_progress_tickets,
            "resolved_today": resolved_today,
        },
    }


@router.get("/growth")
def growth(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    now = datetime.datetime.utcnow()
    weeks = []
    for i in range(7, -1, -1):
        week_start = now - datetime.timedelta(weeks=i+1)
        week_end = now - datetime.timedelta(weeks=i)
        count = db.query(func.count(Clinic.id)).filter(
            and_(Clinic.created_at >= week_start, Clinic.created_at < week_end)
        ).scalar() or 0
        weeks.append({
            "label": week_start.strftime("W%W %b"),
            "new_clinics": count,
        })
    return {"weekly": weeks}


@router.get("/activity")
def activity(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    now = datetime.datetime.utcnow()
    days = []
    for i in range(29, -1, -1):
        day = now - datetime.timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + datetime.timedelta(days=1)
        appts = db.query(func.count(Appointment.id)).filter(
            and_(Appointment.created_at >= day_start, Appointment.created_at < day_end)
        ).scalar() or 0
        invs = db.query(func.count(Invoice.id)).filter(
            and_(Invoice.created_at >= day_start, Invoice.created_at < day_end)
        ).scalar() or 0
        days.append({
            "date": day.strftime("%d %b"),
            "appointments": appts,
            "invoices": invs,
        })
    return {"daily": days}
