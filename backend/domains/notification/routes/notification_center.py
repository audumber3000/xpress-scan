"""
Read side of the in-app notification centre.

Everything here is scoped to the calling user's own rows. Notifications are
fanned out per recipient at write time, so "my notifications" is a plain
user_id filter and there is no way to read a colleague's inbox.
"""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import Notification

router = APIRouter()


def _serialise(n: Notification) -> dict:
    return {
        "id": n.id,
        "event_type": n.event_type,
        "severity": n.severity or "info",
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "count": n.count or 1,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "read": n.read_at is not None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Return rows older than this id"),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """This user's notifications, newest first.

    Keyset paginated on id rather than offset: the list grows at the head while
    somebody is reading it, and an offset would quietly repeat or skip rows as
    new notifications arrive between pages.
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    if before_id:
        query = query.filter(Notification.id < before_id)

    rows = query.order_by(Notification.id.desc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    return {
        "notifications": [_serialise(n) for n in rows],
        "has_more": has_more,
        "next_before_id": rows[-1].id if rows and has_more else None,
    }


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Just the badge number. Polled far more often than the list itself, so it
    stays a single indexed count rather than loading rows to measure them."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .count()
    )
    return {"unread": count}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    if row.read_at is None:
        row.read_at = dt.datetime.utcnow()
        db.commit()
    return {"status": "ok"}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Clear this user's badge.

    Unlike the old activity feed's Clear, which wiped the feed for the whole
    clinic, this only touches the caller's own rows. Marking read is also not
    deleting: the entries stay readable, they just stop counting.
    """
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .update({Notification.read_at: dt.datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "marked": updated}
