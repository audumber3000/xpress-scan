from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
import os
import requests
from typing import Optional

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
        
        # Call Node.js WhatsApp service
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/send/{current_user.id}",
            json={"phone": phone_number, "message": message},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return {
                    "success": True,
                    "message": result.get("message", "Message sent successfully"),
                    "phone_number": phone_number,
                    "chat": result.get("chat")  # Include chat info if available
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result.get("error", "Failed to send message")
                )
        else:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", f"Service returned status {response.status_code}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
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
        error_msg = f"Error sending message: {str(e)}"
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

