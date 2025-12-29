from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Clinic
from pydantic import BaseModel, EmailStr
from typing import Optional
from auth import get_current_user
from services.email_service import EmailService

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
        
        # Initialize email service
        email_service = EmailService()
        
        # Send test email
        result = email_service.send_test_email(
            to_email=request.to_email,
            clinic_name=clinic.name
        )
        
        if result.get("success"):
            return {
                "success": True,
                "message": f"Test email sent successfully to {request.to_email}",
                "details": result
            }
        else:
            error_message = result.get("message", "Failed to send test email")
            error_detail = result.get("error", "")
            if error_detail:
                error_message = f"{error_message}. Error: {error_detail}"
            raise HTTPException(
                status_code=500,
                detail=error_message
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending test email: {str(e)}")

