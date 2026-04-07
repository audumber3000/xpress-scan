from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import ActivityLog, Clinic
from routes.auth import get_current_admin

router = APIRouter()


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    total = db.query(func.count(ActivityLog.id)).scalar()
    by_type = (
        db.query(ActivityLog.event_type, func.count(ActivityLog.id))
        .group_by(ActivityLog.event_type)
        .order_by(func.count(ActivityLog.id).desc())
        .limit(10).all()
    )
    return {
        "total": total,
        "by_event_type": [{"event_type": r[0], "count": r[1]} for r in by_type],
    }


@router.get("/")
def list_activity(
    page: int = 1,
    per_page: int = 100,
    clinic_id: int = None,
    event_type: str = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = db.query(ActivityLog, Clinic.name.label("clinic_name")).join(
        Clinic, ActivityLog.clinic_id == Clinic.id
    )
    if clinic_id:
        q = q.filter(ActivityLog.clinic_id == clinic_id)
    if event_type:
        q = q.filter(ActivityLog.event_type == event_type)

    total = q.count()
    rows = q.order_by(ActivityLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "logs": [
            {
                "id": log.id,
                "clinic_id": log.clinic_id,
                "clinic": clinic_name,
                "event_type": log.event_type,
                "description": log.description,
                "actor_name": log.actor_name,
                "link": log.link,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, clinic_name in rows
        ],
    }


@router.get("/event-types")
def event_types(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    rows = db.query(ActivityLog.event_type).distinct().all()
    return [r[0] for r in rows if r[0]]
