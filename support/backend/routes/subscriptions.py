from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Subscription, Clinic
from routes.auth import get_current_admin

router = APIRouter()


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    total = db.query(func.count(Subscription.id)).scalar()
    by_status = (
        db.query(Subscription.status, func.count(Subscription.id))
        .group_by(Subscription.status).all()
    )
    by_plan = (
        db.query(Subscription.plan_name, func.count(Subscription.id))
        .group_by(Subscription.plan_name).all()
    )
    by_provider = (
        db.query(Subscription.provider, func.count(Subscription.id))
        .group_by(Subscription.provider).all()
    )
    return {
        "total": total,
        "by_status": {r[0]: r[1] for r in by_status},
        "by_plan": {r[0]: r[1] for r in by_plan},
        "by_provider": {r[0]: r[1] for r in by_provider},
    }


@router.get("/")
def list_subscriptions(
    page: int = 1,
    per_page: int = 50,
    status: str = None,
    plan_name: str = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = db.query(Subscription, Clinic.name.label("clinic_name")).outerjoin(
        Clinic, Subscription.clinic_id == Clinic.id
    )
    if status:
        q = q.filter(Subscription.status == status)
    if plan_name:
        q = q.filter(Subscription.plan_name == plan_name)

    total = q.count()
    rows = q.order_by(Subscription.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "subscriptions": [
            {
                "id": s.id,
                "clinic_id": s.clinic_id,
                "clinic": clinic_name or "—",
                "plan_name": s.plan_name,
                "status": s.status,
                "provider": s.provider,
                "provider_order_id": s.provider_order_id,
                "provider_subscription_id": s.provider_subscription_id,
                "current_start": s.current_start.isoformat() if s.current_start else None,
                "current_end": s.current_end.isoformat() if s.current_end else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s, clinic_name in rows
        ],
    }
