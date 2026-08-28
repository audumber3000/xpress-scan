import os

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Clinic
from pydantic import BaseModel, EmailStr
from typing import Optional
from core.auth_utils import get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class TestEmailRequest(BaseModel):
    to_email: EmailStr

@router.post("/test-email")
async def send_test_email(
    request: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Send a test email to verify email service configuration
    """
    try:
        # Get clinic information
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if not clinic:
            raise HTTPException(status_code=404, detail="Clinic not found")
        
        # Through Nexus, which owns ZeptoMail. This used to call EmailService,
        # which talks to Zoho — a provider this product does not use and whose
        # credentials never reach the backend container. So the one endpoint
        # whose entire job is answering "is our email working?" was testing a
        # dead path, and always answered no. It could not have told anyone that
        # password resets and staff invitations were silently failing, because
        # it was failing for a different reason of its own.
        try:
            resp = requests.post(
                f"{os.getenv('NEXUS_SERVICES_URL', 'http://localhost:8001')}"
                f"/api/v1/notifications/email/test",
                json={
                    "to_email": request.to_email,
                    "subject": "Test Notification — MolarPlus",
                    "clinic_name": clinic.name or "MolarPlus",
                },
                timeout=15,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach the notification service: {type(exc).__name__}",
            )

        if resp.status_code >= 400:
            detail = resp.text[:300]
            try:
                detail = resp.json().get("detail") or detail
            except Exception:
                pass
            raise HTTPException(status_code=502, detail=f"Email provider refused it: {detail}")

        return {
            "success": True,
            "message": f"Test email sent successfully to {request.to_email}",
            "details": resp.json() if resp.content else {},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending test email: {str(e)}")

