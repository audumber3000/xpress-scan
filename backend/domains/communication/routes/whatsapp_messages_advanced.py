"""
WhatsApp Advanced Message Types Routes
Modular routes for button, list, and contact messages
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.auth_utils import get_current_user
from models import User
import os
import requests
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(tags=["WhatsApp Advanced Messages"])

# WhatsApp Service URL (Node.js service)
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")


# Pydantic schemas
class Button(BaseModel):
    id: str
    body: str


class ListSectionRow(BaseModel):
    id: str
    title: str
    description: Optional[str] = None


class ListSection(BaseModel):
    title: str
    rows: List[ListSectionRow]


class SendButtonMessageRequest(BaseModel):
    phone: str
    message: str
    buttons: List[Button]
    footer: Optional[str] = None
    media: Optional[str] = None  # base64 encoded
    mediaType: Optional[str] = None


class SendListMessageRequest(BaseModel):
    phone: str
    title: str
    description: Optional[str] = None
    buttonText: str
    sections: List[ListSection]
    footer: Optional[str] = None


class ContactInfo(BaseModel):
    name: str
    number: str
    displayName: Optional[str] = None


class SendContactMessageRequest(BaseModel):
    phone: str
    contact: ContactInfo


@router.post("/button")
async def send_button_message(
    request: SendButtonMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a button message"""
    try:
        # Convert buttons to format expected by WhatsApp service
        buttons = [{"id": btn.id, "body": btn.body} for btn in request.buttons]
        
        payload = {
            "phone": request.phone,
            "message": request.message,
            "buttons": buttons,
            "footer": request.footer
        }
        
        if request.media:
            payload["media"] = request.media
            payload["mediaType"] = request.mediaType or "image/jpeg"
        
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/send-button/{current_user.id}",
            json=payload,
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


@router.post("/list")
async def send_list_message(
    request: SendListMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a list message"""
    try:
        # Convert sections to format expected by WhatsApp service
        sections = []
        for section in request.sections:
            rows = [{"id": row.id, "title": row.title, "description": row.description} for row in section.rows]
            sections.append({
                "title": section.title,
                "rows": rows
            })
        
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/send-list/{current_user.id}",
            json={
                "phone": request.phone,
                "title": request.title,
                "description": request.description,
                "buttonText": request.buttonText,
                "sections": sections,
                "footer": request.footer
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


@router.post("/contact")
async def send_contact_message(
    request: SendContactMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a contact card message"""
    try:
        response = requests.post(
            f"{WHATSAPP_SERVICE_URL}/api/send-contact/{current_user.id}",
            json={
                "phone": request.phone,
                "contact": {
                    "name": request.contact.name,
                    "number": request.contact.number,
                    "displayName": request.contact.displayName
                }
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

