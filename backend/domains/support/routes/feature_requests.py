"""
Feature-request board routes.

A single GLOBAL board shared across all clinics so upvotes aggregate demand
(Canny-style). Clinic owners can submit requests; any logged-in user can upvote
(one vote each, toggleable).
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import FeatureRequest, FeatureRequestVote, User
from core.auth_utils import get_current_user, require_clinic_owner

router = APIRouter()


class CreateFeatureBody(BaseModel):
    title: str
    description: Optional[str] = None


class UpdateFeatureBody(BaseModel):
    title: str
    description: Optional[str] = None


def _serialize(fr: FeatureRequest, vote_count: int, has_voted: bool, current_user_id=None) -> dict:
    creator = fr.creator
    clinic = fr.clinic
    return {
        "id": fr.id,
        "title": fr.title,
        "description": fr.description,
        "status": fr.status,
        "vote_count": vote_count,
        "has_voted": has_voted,
        "requester_name": getattr(creator, "name", None) or "A clinic",
        "clinic_name": getattr(clinic, "name", None),
        "created_at": fr.created_at.isoformat() if fr.created_at else None,
        # The creator can edit/delete their own request.
        "can_edit": fr.created_by is not None and fr.created_by == current_user_id,
    }


def _vote_state(db: Session, request_id: int, user_id: int):
    """Return (vote_count, has_voted) for a single request."""
    count = db.query(func.count(FeatureRequestVote.id)).filter(
        FeatureRequestVote.feature_request_id == request_id
    ).scalar() or 0
    voted = db.query(FeatureRequestVote.id).filter(
        FeatureRequestVote.feature_request_id == request_id,
        FeatureRequestVote.user_id == user_id,
    ).first() is not None
    return count, voted


@router.get("")
def list_feature_requests(
    sort: str = "top",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all feature requests (global). sort=top (most votes) | new (newest)."""
    # Vote counts per request in one grouped query (avoids N+1).
    counts = dict(
        db.query(FeatureRequestVote.feature_request_id, func.count(FeatureRequestVote.id))
        .group_by(FeatureRequestVote.feature_request_id)
        .all()
    )
    # Which requests has the current user voted on?
    voted_ids = {
        rid for (rid,) in db.query(FeatureRequestVote.feature_request_id)
        .filter(FeatureRequestVote.user_id == current_user.id)
        .all()
    }

    requests = db.query(FeatureRequest).all()
    items = [
        _serialize(fr, counts.get(fr.id, 0), fr.id in voted_ids, current_user.id)
        for fr in requests
    ]

    if sort == "new":
        items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    else:  # "top"
        items.sort(key=lambda x: (x["vote_count"], x["created_at"] or ""), reverse=True)

    return {"requests": items}


@router.post("")
def create_feature_request(
    body: CreateFeatureBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """Submit a new feature request (clinic owners only)."""
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    fr = FeatureRequest(
        created_by=current_user.id,
        clinic_id=current_user.clinic_id,
        title=title,
        description=(body.description or "").strip() or None,
        status="open",
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return _serialize(fr, vote_count=0, has_voted=False, current_user_id=current_user.id)


@router.put("/{request_id}")
def update_feature_request(
    request_id: int,
    body: UpdateFeatureBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a feature request (creator only)."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not fr:
        raise HTTPException(status_code=404, detail="Feature request not found")
    if fr.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own requests")

    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    fr.title = title
    fr.description = (body.description or "").strip() or None
    fr.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(fr)

    vote_count, has_voted = _vote_state(db, request_id, current_user.id)
    return _serialize(fr, vote_count, has_voted, current_user.id)


@router.delete("/{request_id}")
def delete_feature_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a feature request (creator only). Votes cascade-delete."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not fr:
        raise HTTPException(status_code=404, detail="Feature request not found")
    if fr.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own requests")

    db.delete(fr)
    db.commit()
    return {"status": "deleted", "id": request_id}


@router.post("/{request_id}/vote")
def toggle_vote(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle the current user's upvote on a request (any logged-in user)."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not fr:
        raise HTTPException(status_code=404, detail="Feature request not found")

    existing = db.query(FeatureRequestVote).filter(
        FeatureRequestVote.feature_request_id == request_id,
        FeatureRequestVote.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        has_voted = False
    else:
        db.add(FeatureRequestVote(
            feature_request_id=request_id,
            user_id=current_user.id,
            created_at=datetime.datetime.utcnow(),
        ))
        has_voted = True
    db.commit()

    vote_count = db.query(func.count(FeatureRequestVote.id)).filter(
        FeatureRequestVote.feature_request_id == request_id
    ).scalar() or 0

    return {"id": request_id, "vote_count": vote_count, "has_voted": has_voted}
