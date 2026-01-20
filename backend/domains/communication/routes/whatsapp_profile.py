"""
WhatsApp Profile & Status Management Routes
Modular routes for profile and status features
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.auth_utils import get_current_user
from models import User
import os
import requests
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Profile"])

# WhatsApp Service URL (Node.js service)
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


# Pydantic schemas
class SetStatusRequest(BaseModel):
    status: str


class UpdateProfilePictureRequest(BaseModel):
    image: str  # base64 encoded
    imageType: str = "image/jpeg"


@router.post("/status/set")
async def set_status(
    request: SetStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set WhatsApp status"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/status/set/{current_user.id}",
            json={"status": request.status},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.get("/status/user/{phone}")
async def get_user_status(
    phone: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get status of a specific user"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/status/user/{current_user.id}/{phone}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.post("/picture/update")
async def update_profile_picture(
    request: UpdateProfilePictureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update profile picture"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/profile/picture/{current_user.id}",
            json={
                "image": request.image,
                "imageType": request.imageType
            },
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )


@router.get("/picture/{phone}")
async def get_profile_picture(
    phone: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get profile picture of a user"""
    try:
        response = requests.get(
            f"{WHATSAPP_SERVICE_URL}/api/profile/picture/{current_user.id}/{phone}",
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_data.get("error", f"Service returned status {response.status_code}")
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to WhatsApp service: {str(e)}"
        )

