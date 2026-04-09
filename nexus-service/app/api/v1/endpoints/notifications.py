from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, Optional, List
from app.services.infrastructure.notification_service import NotificationService

router = APIRouter()
notification_service = NotificationService()

# ─── Unified Event Dispatch ────────────────────────────────────────────────────

class SendEventRequest(BaseModel):
    event_type: str
    channel: str                        # "email" | "whatsapp"
    to_email: Optional[str] = ""
    to_name: Optional[str] = ""
    to_phone: Optional[str] = ""
    attachments: Optional[List[Dict[str, str]]] = None
    template_data: Dict[str, Any] = {}  # fields passed to the template builder


@router.post("/send-event")
async def send_event(request: SendEventRequest):
    """
    Dispatch a notification for any event_type via the specified channel.
    template_data must contain all fields required by the event template.
    """
    result = await notification_service.dispatch_event(
        event_type=request.event_type,
        channel=request.channel,
        to_email=request.to_email or "",
        to_name=request.to_name or "",
        to_phone=request.to_phone or "",
        attachments=request.attachments,
        **request.template_data,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Dispatch failed"))
    return result


# ─── Pydantic Models ───────────────────────────────────────────────────────────

class WhatsAppSendRequest(BaseModel):
    mobile_number: str
    template_name: str
    language_code: str = "en"
    components: Optional[List[Dict[str, Any]]] = None

class WhatsAppTestRequest(BaseModel):
    mobile_number: str
    message: str = "This is a test notification from MolarPlus."

class SMSSendRequest(BaseModel):
    mobile_number: str
    template_id: str
    flow_variables: Dict[str, str] = {}

class SMSTestRequest(BaseModel):
    mobile_number: str
    message: str = "This is a test SMS from MolarPlus."

class EmailSendRequest(BaseModel):
    to_email: EmailStr
    subject: str
    body_content: str
    clinic_name: str
    to_name: str = ""

class EmailTestRequest(BaseModel):
    to_email: EmailStr
    subject: str = "Test Notification — MolarPlus"
    clinic_name: str = "MolarPlus"


# ─── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status():
    """Return configuration status for all channels."""
    return notification_service.get_channel_status()


# ─── Media Upload (Meta) ───────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    clinic_id: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(None),
):
    """
    Upload a PDF to Meta's media endpoint and return its media_id.
    Use the media_id in template_data when sending invoice/prescription WA messages.

    Example flow:
      1. POST /media/upload  (multipart, field name: "file")
      2. Get back { "media_id": "123456789" }
      3. Pass media_id in template_data to /send-event for invoice_notification or prescription_notification
    """
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    pdf_bytes = await file.read()
    result = await notification_service.upload_media_to_meta(
        pdf_bytes, file.filename or "document.pdf",
        clinic_id=clinic_id, patient_id=patient_id
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Upload failed"))
    return {"media_id": result["media_id"], "filename": file.filename}


# ─── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────────

@router.post("/whatsapp/send")
async def send_whatsapp(request: WhatsAppSendRequest):
    """Send a WhatsApp template message via Meta Cloud API."""
    result = await notification_service.send_whatsapp(
        mobile_number=request.mobile_number,
        template_name=request.template_name,
        language_code=request.language_code,
        components=request.components,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/whatsapp/test")
async def test_whatsapp(request: WhatsAppTestRequest):
    """Send a test WhatsApp template via MSG91 (mp_appointment_booked_v2 with demo values)."""
    result = await notification_service.dispatch_event(
        event_type="appointment_booked",
        channel="whatsapp",
        to_phone=request.mobile_number,
        patient_name="Test Patient",
        clinic_name="Demo Clinic",
        appointment_date="25 Apr 2026",
        appointment_time="10:00 AM",
        clinic_phone="+91 9000000000",
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Send failed"))
    return result


# ─── SMS (MSG91) ───────────────────────────────────────────────────────────────

@router.post("/sms/send")
async def send_sms(request: SMSSendRequest):
    """Send an SMS via MSG91 Flow API."""
    result = await notification_service.send_sms(
        mobile_number=request.mobile_number,
        template_id=request.template_id,
        flow_variables=request.flow_variables,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/sms/test")
async def test_sms(request: SMSTestRequest):
    """Send a plain SMS for testing via MSG91."""
    result = await notification_service.send_sms_simple(
        mobile_number=request.mobile_number,
        message=request.message,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


# ─── Email (ZeptoMail) ─────────────────────────────────────────────────────────

@router.post("/email/send")
async def send_email(request: EmailSendRequest):
    """Send a transactional email via ZeptoMail."""
    html_content = notification_service.get_email_template(
        clinic_name=request.clinic_name,
        body_content=request.body_content,
    )
    result = await notification_service.send_platform_email(
        to_email=request.to_email,
        to_name=request.to_name,
        subject=request.subject,
        html_content=html_content,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/email/test")
async def test_email(request: EmailTestRequest):
    """Send a test email via ZeptoMail."""
    html_content = notification_service.get_email_template(
        clinic_name=request.clinic_name,
        body_content=(
            f"<p>Hi there,</p>"
            f"<p>This is a test email from <strong>{request.clinic_name}</strong> to confirm "
            f"that your ZeptoMail email delivery is configured correctly.</p>"
            f"<p>If you received this, everything is working!</p>"
        ),
    )
    result = await notification_service.send_platform_email(
        to_email=request.to_email,
        to_name="",
        subject=request.subject,
        html_content=html_content,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result
