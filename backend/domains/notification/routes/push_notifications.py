"""
Push Notification routes — register/unregister device tokens and send notifications.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import PushToken, User
from core.auth_utils import get_current_user
from domains.notification.services.push_service import push_service

router = APIRouter()


class RegisterTokenRequest(BaseModel):
    token: str
    platform: str  # 'ios' | 'android'


class UnregisterTokenRequest(BaseModel):
    token: str


class SendNotificationRequest(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None


@router.post("/register-token")
def register_push_token(
    payload: RegisterTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register or update an Expo push token for the current user's clinic."""
    if not payload.token:
        raise HTTPException(status_code=400, detail="Token is required")

    # Check if token already exists
    existing = db.query(PushToken).filter(PushToken.token == payload.token).first()
    if existing:
        # Update ownership if needed
        existing.user_id = current_user.id
        existing.clinic_id = current_user.clinic_id
        existing.platform = payload.platform
        existing.is_active = True
        db.commit()
        return {"message": "Token updated", "id": existing.id}

    # Create new token entry
    push_token = PushToken(
        user_id=current_user.id,
        clinic_id=current_user.clinic_id,
        token=payload.token,
        platform=payload.platform,
        is_active=True,
    )
    db.add(push_token)
    db.commit()
    db.refresh(push_token)
    return {"message": "Token registered", "id": push_token.id}


@router.post("/unregister-token")
def unregister_push_token(
    payload: UnregisterTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a push token (e.g. on logout)."""
    existing = db.query(PushToken).filter(
        PushToken.token == payload.token,
        PushToken.user_id == current_user.id,
    ).first()
    if existing:
        existing.is_active = False
        db.commit()
    return {"message": "Token unregistered"}


@router.post("/send")
def send_push_notification(
    payload: SendNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a push notification to all devices in the current user's clinic."""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User has no clinic")

    result = push_service.send_to_clinic(
        db=db,
        clinic_id=current_user.clinic_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )
    return result


@router.post("/send-test")
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification to the current user's devices only."""
    result = push_service.send_to_user(
        db=db,
        user_id=current_user.id,
        title="🔔 Test Notification",
        body="Push notifications are working! You'll receive alerts for appointments, dues, and more.",
        data={"type": "test"},
    )
    return result
