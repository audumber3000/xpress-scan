from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User, ScheduledMessage, Patient
import os
import requests
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Inbox"])

# WhatsApp Service URL (Node.js service)
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


@router.post("/initialize")
async def initialize_whatsapp_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initialize WhatsApp Web session and get QR code"""
    try:
        # Call Node.js WhatsApp service
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/initialize/{current_user.id}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", f"Service returned status {response.status_code}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to connect to WhatsApp service: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg
        )
    except Exception as e:
        error_msg = f"Error initializing WhatsApp session: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.get("/status")
async def get_whatsapp_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current WhatsApp session status"""
    try:
        # Call Node.js WhatsApp service
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/status/{current_user.id}",
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "status": "error",
                "error": f"Service returned status {response.status_code}",
                "qr_code": None,
                "phone_number": None
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "error": f"Failed to connect to WhatsApp service: {str(e)}",
            "qr_code": None,
            "phone_number": None
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Error getting status: {str(e)}",
            "qr_code": None,
            "phone_number": None
        }


@router.post("/disconnect")
async def disconnect_whatsapp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disconnect WhatsApp session"""
    try:
        # Call Node.js WhatsApp service
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/disconnect/{current_user.id}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            return {
                "success": False,
                "error": error_data.get("error", f"Service returned status {response.status_code}")
            }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Failed to connect to WhatsApp service: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error disconnecting: {str(e)}"
        }


@router.post("/send-message")
async def send_whatsapp_message(
    request_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send WhatsApp message automatically"""
    try:
        phone_number = request_data.get("phone_number")
        message = request_data.get("message")
        
        if not phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required"
            )
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message is required"
            )
        
        # Clean phone number (remove non-digits)
        import re
        clean_phone = re.sub(r'\D', '', str(phone_number))
        
        # Validate phone number length (should be at least 10 digits, typically 10-15 with country code)
        if len(clean_phone) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid phone number. Must be at least 10 digits. Got: {len(clean_phone)} digits"
            )
        
        # If phone number is 10 digits, assume it's Indian number and add country code 91
        # This is a common case - adjust based on your primary market
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
            print(f"Added country code 91 to 10-digit number. New number: {clean_phone}")
        
        # Call Node.js WhatsApp service
        try:
            response = requests.post(
                f"{WHATSAPP_SERVICE_URL}/api/send/{current_user.id}",
                json={"phone": clean_phone, "message": message},
                timeout=60
            )
        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to connect to WhatsApp service: {str(e)}"
            )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return {
                    "success": True,
                    "message": result.get("message", "Message sent successfully"),
                    "phone_number": clean_phone,
                    "chat": result.get("chat"),  # Include chat info if available
                    "messageData": result.get("messageData")  # Include message data for immediate display
                }
            else:
                error_msg = result.get("error", "Failed to send message")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg
                )
        else:
            try:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", f"Service returned status {response.status_code}")
            except:
                error_msg = f"Service returned status {response.status_code}"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = f"Error sending message: {str(e)}"
        print(f"Error details: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.get("/chats")
async def get_whatsapp_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of WhatsApp chats/conversations"""
    try:
        # Call Node.js WhatsApp service
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/chats/{current_user.id}",
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to connect to WhatsApp service: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg
        )
    except Exception as e:
        error_msg = f"Error getting chats: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.get("/messages/{phone}")
async def get_whatsapp_messages(
    phone: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a specific chat/phone number"""
    try:
        # Call Node.js WhatsApp service
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/messages/{current_user.id}/{phone}",
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to connect to WhatsApp service: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg
        )
    except Exception as e:
        error_msg = f"Error getting messages: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


# Pydantic schemas for scheduled messages
class ScheduleMessageRequest(BaseModel):
    patient_ids: List[int]
    message: str
    scheduled_at: str  # ISO format datetime string


@router.post("/schedule-message")
async def schedule_whatsapp_message(
    request_data: ScheduleMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Schedule a WhatsApp message to be sent at a specific time"""
    try:
        # Parse scheduled_at datetime
        try:
            # Handle both with and without timezone
            scheduled_at_str = request_data.scheduled_at.replace('Z', '+00:00')
            if '+' not in scheduled_at_str and scheduled_at_str.count(':') == 2:
                # If no timezone, assume UTC
                scheduled_at_str += '+00:00'
            scheduled_datetime = datetime.fromisoformat(scheduled_at_str)
            # Convert to UTC if timezone-aware
            if scheduled_datetime.tzinfo:
                scheduled_datetime = scheduled_datetime.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid datetime format. Use ISO format (YYYY-MM-DDTHH:MM:SS). Error: {str(e)}"
            )
        
        # Validate it's in the future
        if scheduled_datetime <= datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scheduled time must be in the future"
            )
        
        # Verify patient IDs belong to the clinic
        if not request_data.patient_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one patient ID is required"
            )
        
        patients = db.query(Patient).filter(
            Patient.id.in_(request_data.patient_ids),
            Patient.clinic_id == current_user.clinic_id
        ).all()
        
        if len(patients) != len(request_data.patient_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more patient IDs are invalid or don't belong to your clinic"
            )
        
        # Validate all patients have phone numbers
        patients_without_phone = [p for p in patients if not p.phone or not str(p.phone).strip()]
        if patients_without_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Some patients don't have phone numbers: {[p.name for p in patients_without_phone]}"
            )
        
        # Create scheduled message record
        scheduled_msg = ScheduledMessage(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            message=request_data.message,
            scheduled_at=scheduled_datetime,
            recipient_count=len(request_data.patient_ids),
            patient_ids=request_data.patient_ids,
            status='pending'
        )
        
        db.add(scheduled_msg)
        db.commit()
        db.refresh(scheduled_msg)
        
        return {
            "success": True,
            "id": scheduled_msg.id,
            "scheduled_at": scheduled_msg.scheduled_at.isoformat(),
            "recipient_count": scheduled_msg.recipient_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error scheduling message: {str(e)}")
        print(error_details)
        error_msg = f"Error scheduling message: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )


@router.get("/scheduled-messages/")
async def get_scheduled_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all scheduled messages for the current user's clinic"""
    try:
        scheduled_messages = db.query(ScheduledMessage).filter(
            ScheduledMessage.clinic_id == current_user.clinic_id
        ).order_by(ScheduledMessage.scheduled_at.desc()).all()
        
        return [
            {
                "id": msg.id,
                "message": msg.message,
                "scheduled_at": msg.scheduled_at.isoformat(),
                "status": msg.status,
                "recipient_count": msg.recipient_count,
                "sent_count": msg.sent_count,
                "failed_count": msg.failed_count,
                "created_at": msg.created_at.isoformat(),
                "sent_at": msg.sent_at.isoformat() if msg.sent_at else None
            }
            for msg in scheduled_messages
        ]
    except Exception as e:
        error_msg = f"Error fetching scheduled messages: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )

