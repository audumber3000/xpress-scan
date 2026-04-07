from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ActivityLog
from core.auth_utils import get_current_user
import datetime

router = APIRouter()


def push_activity(db: Session, clinic_id: int, event_type: str, description: str, link: str = None, actor_name: str = None):
    """Add an activity log entry, enforcing FIFO with max 10 per clinic."""
    entry = ActivityLog(
        clinic_id=clinic_id,
        event_type=event_type,
        description=description,
        link=link,
        actor_name=actor_name,
    )
    db.add(entry)
    db.flush()

    # Keep only latest 10 per clinic
    all_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.clinic_id == clinic_id)
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    if len(all_logs) > 10:
        oldest_ids = [log.id for log in all_logs[10:]]
        db.query(ActivityLog).filter(ActivityLog.id.in_(oldest_ids)).delete(synchronize_session=False)


@router.get("")
def get_activity_logs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    clinic_id = current_user.clinic_id
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated")
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.clinic_id == clinic_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "description": log.description,
            "link": log.link,
            "actor_name": log.actor_name,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.post("")
def add_activity_log(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    clinic_id = current_user.clinic_id
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated")
    actor_name = current_user.full_name or current_user.email.split("@")[0]
    push_activity(
        db,
        clinic_id=clinic_id,
        event_type=payload.get("event_type", "general"),
        description=payload.get("description", ""),
        link=payload.get("link"),
        actor_name=actor_name,
    )
    db.commit()
    return {"status": "ok"}
