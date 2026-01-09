"""
WhatsApp Contact Management Routes
Modular routes for contact management (block/unblock, check registration)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
import os
import requests
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Contacts"])

# WhatsApp Service URL (Node.js service)
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


@router.get("/check/{phone}")
async def check_is_on_whatsapp(
    phone: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a phone number is registered on WhatsApp"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/is-on-whatsapp/{current_user.id}/{phone}",
            timeout=30
        )
        
        # Always return 200 with consistent structure
        if response.status_code == 200:
            data = response.json()
            # Ensure consistent structure
            if "isRegistered" in data:
                return data
            else:
                # If error response but status 200, return false
                return {"phone": phone, "isRegistered": False, "error": data.get("error", "Unknown error")}
        else:
            # Return false with error message
            error_data = response.json() if response.text else {}
            return {"phone": phone, "isRegistered": False, "error": error_data.get("error", f"Service returned status {response.status_code}")}
    except requests.exceptions.RequestException as e:
        # Return false instead of raising exception
        return {"phone": phone, "isRegistered": False, "error": f"Failed to connect to WhatsApp service: {str(e)}"}
    except Exception as e:
        return {"phone": phone, "isRegistered": False, "error": str(e)}

