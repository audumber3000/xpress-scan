from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from database import get_db
from models import Invoice, Clinic
from routes.auth import get_current_admin

router = APIRouter()


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    total_revenue = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).scalar()
    total_invoices = db.query(func.count(Invoice.id)).scalar()
    paid_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.status.in_(["paid_verified", "paid_unverified"])
    ).scalar()
    pending_amount = db.query(func.coalesce(func.sum(Invoice.due_amount), 0)).filter(
        Invoice.status.in_(["finalized", "partially_paid"])
    ).scalar()
    avg_invoice = (total_revenue / paid_invoices) if paid_invoices else 0

    payment_methods = (
        db.query(Invoice.payment_mode, func.count(Invoice.id), func.sum(Invoice.paid_amount))
        .filter(Invoice.payment_mode != None)
        .group_by(Invoice.payment_mode)
        .all()
    )

    return {
        "total_revenue": round(total_revenue, 2),
        "total_invoices": total_invoices,
        "paid_invoices": paid_invoices,
        "pending_amount": round(pending_amount, 2),
        "avg_invoice": round(avg_invoice, 2),
        "payment_methods": [
            {"mode": r[0] or "Unknown", "count": r[1], "amount": round(r[2] or 0, 2)}
            for r in payment_methods
        ],
    }


@router.get("/revenue-over-time")
def revenue_over_time(months: int = 12, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    rows = (
        db.query(
            extract("year", Invoice.created_at).label("year"),
            extract("month", Invoice.created_at).label("month"),
            func.sum(Invoice.paid_amount).label("revenue"),
            func.count(Invoice.id).label("count"),
        )
        .filter(Invoice.status.in_(["paid_verified", "paid_unverified"]))
        .group_by("year", "month")
        .order_by("year", "month")
        .limit(months)
        .all()
    )
    return [
        {"year": int(r.year), "month": int(r.month), "revenue": round(r.revenue or 0, 2), "count": r.count}
        for r in rows
    ]


@router.get("/by-clinic")
def by_clinic(limit: int = 20, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    rows = (
        db.query(
            Invoice.clinic_id,
            Clinic.name,
            func.sum(Invoice.paid_amount).label("revenue"),
            func.count(Invoice.id).label("count"),
        )
        .join(Clinic, Invoice.clinic_id == Clinic.id)
        .group_by(Invoice.clinic_id, Clinic.name)
        .order_by(func.sum(Invoice.paid_amount).desc())
        .limit(limit)
        .all()
    )
    return [
        {"clinic_id": r.clinic_id, "clinic": r.name, "revenue": round(r.revenue or 0, 2), "count": r.count}
        for r in rows
    ]


@router.get("/invoices")
def list_invoices(
    page: int = 1,
    per_page: int = 50,
    clinic_id: int = None,
    status: str = None,
    payment_mode: str = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = (
        db.query(Invoice, Clinic.name.label("clinic_name"))
        .join(Clinic, Invoice.clinic_id == Clinic.id)
    )
    if clinic_id:
        q = q.filter(Invoice.clinic_id == clinic_id)
    if status:
        q = q.filter(Invoice.status == status)
    if payment_mode:
        q = q.filter(Invoice.payment_mode == payment_mode)

    total = q.count()
    rows = q.order_by(Invoice.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "clinic": clinic_name,
                "clinic_id": inv.clinic_id,
                "status": inv.status,
                "payment_mode": inv.payment_mode,
                "total": inv.total,
                "paid_amount": inv.paid_amount,
                "due_amount": inv.due_amount,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            }
            for inv, clinic_name in rows
        ],
    }
