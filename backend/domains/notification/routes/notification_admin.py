import os
import httpx
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr

from database import SessionLocal
from models import (
    Clinic, User,
    NotificationPreference, NotificationLog,
    NotificationWallet, WalletTransaction,
    MessageTemplate,
)
from core.auth_utils import get_current_user
from core.nexus_notify import notify
from domains.finance.services.cashfree.cashfree_provider import CashfreeProvider

router = APIRouter()

NEXUS_BASE = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")

DEFAULT_EVENT_TYPES = [
    "appointment_booked",
    "appointment_confirmation",
    "checked_in",
    "invoice_notification",
    "prescription_notification",
    "appointment_reminder",
    "google_review",
    "consent_form",
    "daily_summary",
]

# Events hidden from the preferences UI (system-scheduled, not user-configurable)
_HIDDEN_EVENT_TYPES = {"daily_report"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_wallet(clinic_id: int, db: Session) -> NotificationWallet:
    wallet = db.query(NotificationWallet).filter(
        NotificationWallet.clinic_id == clinic_id
    ).first()
    if not wallet:
        wallet = NotificationWallet(clinic_id=clinic_id, balance=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class PreferenceItem(BaseModel):
    event_type: str
    channels: List[str] = []        # ["whatsapp", "email", "sms"] — multi-select
    is_enabled: bool = True

class PreferencesUpdateRequest(BaseModel):
    preferences: List[PreferenceItem]

class WalletTopupRequest(BaseModel):
    amount: float

class TestWhatsAppRequest(BaseModel):
    mobile_number: str
    message: str = "This is a test notification from MolarPlus."

class TestWhatsAppTemplateRequest(BaseModel):
    mobile_number: str
    clinic_name: str = "Demo Clinic"
    clinic_phone: str = "+91 9594078777"

class TestEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str = "Test Notification — MolarPlus"

class TestSMSRequest(BaseModel):
    mobile_number: str
    message: str = "This is a test SMS from MolarPlus."

class TemplateSendRequest(BaseModel):
    event_type: str
    channel: str          # whatsapp | email | sms
    recipient: str        # phone number or email


# ─── Channel Status ────────────────────────────────────────────────────────────

@router.get("/channel-status")
async def get_channel_status(current_user: User = Depends(get_current_user)):
    """Check configuration status of all notification channels via Nexus."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{NEXUS_BASE}/api/v1/notifications/status")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {
        "whatsapp": {"configured": False, "channel": "Meta Cloud API"},
        "email": {"configured": False, "channel": "ZeptoMail"},
        "sms": {"configured": False, "channel": "MSG91"},
    }


# ─── Notification Preferences ─────────────────────────────────────────────────

@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all notification preferences for the clinic, seeding defaults if needed."""
    clinic_id = current_user.clinic_id
    existing = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == clinic_id
    ).all()
    existing_types = {p.event_type for p in existing}

    # Seed defaults for any missing event types
    for event_type in DEFAULT_EVENT_TYPES:
        if event_type not in existing_types:
            pref = NotificationPreference(
                clinic_id=clinic_id,
                event_type=event_type,
                channels=["whatsapp"],
                is_enabled=True,
            )
            db.add(pref)

    db.commit()

    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == clinic_id
    ).all()

    return [
        {
            "id": p.id,
            "event_type": p.event_type,
            # migrate legacy single-channel records on the fly
            "channels": p.channels if p.channels else ([p.channel] if p.channel else ["whatsapp"]),
            "is_enabled": p.is_enabled,
        }
        for p in prefs
        if p.event_type not in _HIDDEN_EVENT_TYPES
    ]


@router.put("/preferences")
def update_preferences(
    body: PreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-update notification preferences for the clinic."""
    clinic_id = current_user.clinic_id

    for item in body.preferences:
        pref = db.query(NotificationPreference).filter(
            NotificationPreference.clinic_id == clinic_id,
            NotificationPreference.event_type == item.event_type,
        ).first()

        if pref:
            pref.channels = item.channels
            pref.is_enabled = item.is_enabled
        else:
            pref = NotificationPreference(
                clinic_id=clinic_id,
                event_type=item.event_type,
                channels=item.channels,
                is_enabled=item.is_enabled,
            )
            db.add(pref)

    db.commit()
    return {"success": True, "message": "Preferences updated"}


# ─── Notification Logs ─────────────────────────────────────────────────────────

@router.get("/logs")
def get_notification_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated notification logs for the clinic."""
    clinic_id = current_user.clinic_id
    query = db.query(NotificationLog).filter(
        NotificationLog.clinic_id == clinic_id
    )
    if channel:
        query = query.filter(NotificationLog.channel == channel)
    if status:
        query = query.filter(NotificationLog.status == status)

    total = query.count()
    logs = (
        query.order_by(NotificationLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "logs": [
            {
                "id": l.id,
                "channel": l.channel,
                "recipient": l.recipient,
                "event_type": l.event_type,
                "template_name": l.template_name,
                "status": l.status,
                "cost": l.cost,
                "error_message": l.error_message,
                "provider_message_id": getattr(l, 'provider_message_id', None),
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "updated_at": l.updated_at.isoformat() if getattr(l, 'updated_at', None) else None,
            }
            for l in logs
        ],
    }


@router.get("/stats")
def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Notification counts and cost grouped by channel for the clinic."""
    clinic_id = current_user.clinic_id
    rows = (
        db.query(
            NotificationLog.channel,
            func.count(NotificationLog.id).label("sent"),
            func.sum(NotificationLog.cost).label("total_cost"),
        )
        .filter(NotificationLog.clinic_id == clinic_id)
        .group_by(NotificationLog.channel)
        .all()
    )

    stats = {}
    for row in rows:
        stats[row.channel] = {
            "sent": row.sent,
            "total_cost": round(row.total_cost or 0.0, 4),
        }

    # Ensure all channels present
    for ch in ("whatsapp", "email", "sms"):
        if ch not in stats:
            stats[ch] = {"sent": 0, "total_cost": 0.0}

    return stats


# ─── Wallet ───────────────────────────────────────────────────────────────────

@router.get("/wallet")
def get_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get wallet balance and recent transactions."""
    clinic_id = current_user.clinic_id
    wallet = _get_or_create_wallet(clinic_id, db)

    transactions = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.clinic_id == clinic_id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "balance": wallet.balance,
        "last_topup_at": wallet.last_topup_at.isoformat() if wallet.last_topup_at else None,
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "transaction_type": t.transaction_type,
                "description": t.description,
                "order_id": t.order_id,
                "status": t.status,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ],
    }


@router.post("/wallet/topup")
def initiate_wallet_topup(
    body: WalletTopupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Cashfree order to top up the notification wallet."""
    if body.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum top-up amount is ₹100")

    clinic_id = current_user.clinic_id
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    order_id = f"WALLET_{clinic_id}_{int(datetime.utcnow().timestamp())}"

    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173")
    wallet_return_url = f"{frontend_base}/admin/notifications?wallet_success=1&order_id={order_id}"

    try:
        provider = CashfreeProvider()
        res = provider.create_order(
            amount=body.amount,
            customer_id=str(current_user.id),
            order_id=order_id,
            notes={
                "clinic_name": clinic.name,
                "plan": "Wallet Top-up",
                "phone": clinic.phone or "",
                "email": clinic.email or "",
                "user_id": current_user.id,
                "return_url": wallet_return_url,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    payment_session_id = res.get("payment_session_id") or res.get("data", {}).get("payment_session_id")
    if not payment_session_id:
        raise HTTPException(status_code=500, detail="Failed to create payment session")

    # Record a pending transaction
    txn = WalletTransaction(
        clinic_id=clinic_id,
        amount=body.amount,
        transaction_type="credit",
        description=f"Wallet Top-up ₹{body.amount}",
        order_id=order_id,
        status="pending",
    )
    db.add(txn)
    db.commit()

    return {
        "payment_session_id": payment_session_id,
        "order_id": order_id,
        "provider": "cashfree",
    }


@router.get("/wallet/verify")
def verify_wallet_topup(
    order_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify and credit wallet after Cashfree payment."""
    clinic_id = current_user.clinic_id

    txn = db.query(WalletTransaction).filter(
        WalletTransaction.clinic_id == clinic_id,
        WalletTransaction.order_id == order_id,
    ).first()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status == "completed":
        return {"success": True, "message": "Already credited", "balance": _get_or_create_wallet(clinic_id, db).balance}

    try:
        provider = CashfreeProvider()
        order_data = provider.get_subscription(order_id)
        cf_status = order_data.get("order_status")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if cf_status == "PAID":
        txn.status = "completed"
        wallet = _get_or_create_wallet(clinic_id, db)
        wallet.balance += txn.amount
        wallet.last_topup_at = datetime.utcnow()
        db.commit()
        db.refresh(wallet)
        owner = db.query(User).filter(User.clinic_id == clinic_id, User.role == 'clinic_owner').first()
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if owner and clinic:
            owner_name = getattr(owner, 'first_name', None) or owner.email.split('@')[0]
            notify(
                "wallet_topup", channel="email",
                to_email=owner.email, to_name=owner_name,
                template_data={
                    "owner_name": owner_name,
                    "clinic_name": clinic.name,
                    "amount": txn.amount,
                    "new_balance": wallet.balance,
                }
            )
        return {"success": True, "message": "Wallet credited successfully", "balance": wallet.balance}

    return {"success": False, "status": cf_status, "message": f"Payment status: {cf_status}"}


@router.post("/wallet/webhook")
async def wallet_cashfree_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle Cashfree webhook for wallet top-up payments."""
    try:
        payload = await request.json()
        order_id = payload.get("data", {}).get("order", {}).get("order_id", "")
        payment_status = payload.get("data", {}).get("payment", {}).get("payment_status")

        if order_id.startswith("WALLET_") and payment_status == "SUCCESS":
            txn = db.query(WalletTransaction).filter(
                WalletTransaction.order_id == order_id,
                WalletTransaction.status == "pending",
            ).first()

            if txn:
                txn.status = "completed"
                wallet = _get_or_create_wallet(txn.clinic_id, db)
                wallet.balance += txn.amount
                wallet.last_topup_at = datetime.utcnow()
                db.commit()
                owner = db.query(User).filter(User.clinic_id == txn.clinic_id, User.role == 'clinic_owner').first()
                clinic = db.query(Clinic).filter(Clinic.id == txn.clinic_id).first()
                if owner and clinic:
                    owner_name = getattr(owner, 'first_name', None) or owner.email.split('@')[0]
                    notify(
                        "wallet_topup", channel="email",
                        to_email=owner.email, to_name=owner_name,
                        template_data={
                            "owner_name": owner_name,
                            "clinic_name": clinic.name,
                            "amount": txn.amount,
                            "new_balance": wallet.balance,
                        }
                    )

        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── Test endpoints ────────────────────────────────────────────────────────────

@router.post("/test/whatsapp")
async def test_whatsapp(
    body: TestWhatsAppRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test WhatsApp message via Nexus."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEXUS_BASE}/api/v1/notifications/whatsapp/test",
                json={"mobile_number": body.mobile_number, "message": body.message},
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"success": True, "data": data}
            raise HTTPException(status_code=resp.status_code, detail=data.get("detail", "Failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/whatsapp-template")
async def test_whatsapp_template(
    body: TestWhatsAppTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a real approved WhatsApp template (mp_appointment_booked_v2) with sample data."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEXUS_BASE}/api/v1/notifications/send-event",
                json={
                    "event_type": "appointment_booked",
                    "channel": "whatsapp",
                    "to_phone": body.mobile_number,
                    "template_data": {
                        "patient_name": "Test Patient",
                        "clinic_name": body.clinic_name,
                        "appointment_date": "25 Apr 2026",
                        "appointment_time": "10:00 AM",
                        "clinic_phone": body.clinic_phone,
                    },
                },
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"success": True, "data": data}
            raise HTTPException(status_code=resp.status_code, detail=data.get("detail", "Failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/email")
async def test_email(
    body: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test email via Nexus."""
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    clinic_name = clinic.name if clinic else "MolarPlus"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEXUS_BASE}/api/v1/notifications/email/test",
                json={
                    "to_email": body.to_email,
                    "subject": body.subject,
                    "clinic_name": clinic_name,
                },
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"success": True, "data": data}
            raise HTTPException(status_code=resp.status_code, detail=data.get("detail", "Failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/sms")
async def test_sms(
    body: TestSMSRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test SMS via Nexus."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEXUS_BASE}/api/v1/notifications/sms/test",
                json={"mobile_number": body.mobile_number, "message": body.message},
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"success": True, "data": data}
            raise HTTPException(status_code=resp.status_code, detail=data.get("detail", "Failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Message Templates (for preview) ──────────────────────────────────────────

@router.get("/templates")
def get_notification_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all message templates for the clinic keyed by name."""
    clinic_id = current_user.clinic_id
    templates = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == clinic_id,
        MessageTemplate.is_active == True,
    ).all()
    return {
        t.name: {
            "id": t.id,
            "title": t.title,
            "content": t.content,
            "variables": t.variables or [],
        }
        for t in templates
    }


# ─── Template-based test send (deducts wallet) ────────────────────────────────

CHANNEL_COST = {"whatsapp": 0.74, "email": 0.02, "sms": 0.15}

SAMPLE_VARS = {
    "patient_name": "Rahul Sharma",
    "doctor_name": "Dr. Mehta",
    "appointment_date": "Tomorrow, 10:30 AM",
    "appointment_time": "10:30 AM",
    "invoice_amount": "₹850",
    "invoice_number": "INV-2024-001",
    "prescription_id": "RX-001",
    "review_link": "https://g.page/r/example",
    "consent_link": "https://molarplus.com/consent/demo",
    "report_date": "Today",
}

def _render(content: str, clinic_name: str) -> str:
    """Render template with sample variables."""
    variables = {**SAMPLE_VARS, "clinic_name": clinic_name}
    for key, value in variables.items():
        content = content.replace(f"{{{key}}}", str(value))
        content = content.replace(f"{{{{{key}}}}}", str(value))
    return content


@router.post("/test/template-send")
async def template_test_send(
    body: TemplateSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a template-based test notification and deduct cost from wallet."""
    clinic_id = current_user.clinic_id
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    clinic_name = clinic.name if clinic else "MolarPlus"

    channel = body.channel.lower()
    if channel not in CHANNEL_COST:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}")

    cost = CHANNEL_COST[channel]

    # Check wallet balance
    wallet = _get_or_create_wallet(clinic_id, db)
    if wallet.balance < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient wallet balance. Need ₹{cost:.2f}, have ₹{wallet.balance:.2f}.",
        )

    # Fetch template from DB (name matches event_type)
    template = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == clinic_id,
        MessageTemplate.name == body.event_type,
        MessageTemplate.is_active == True,
    ).first()

    if template:
        rendered = _render(template.content, clinic_name)
        template_name = template.name
    else:
        # Fallback: generic message
        rendered = f"[MolarPlus Test] {body.event_type.replace('_', ' ').title()} — {clinic_name}"
        template_name = body.event_type

    # Per-event demo data for WhatsApp templates
    WA_DEMO_DATA = {
        "appointment_booked": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "appointment_date": "25 Apr 2026", "appointment_time": "10:30 AM",
            "clinic_phone": "+91 9000000000",
        },
        "appointment_confirmation": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "appointment_date": "25 Apr 2026", "appointment_time": "10:30 AM",
            "clinic_phone": "+91 9000000000",
        },
        "checked_in": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "doctor_name": "Dr. Mehta", "clinic_phone": "+91 9000000000",
        },
        "appointment_reminder": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "appointment_date": "25 Apr 2026", "appointment_time": "10:30 AM",
            "clinic_phone": "+91 9000000000",
        },
        "invoice_notification": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "invoice_number": "INV-2026-001", "total_amount": 850.0,
            "clinic_phone": "+91 9000000000",
            "media_id": os.getenv("SAMPLE_PDF_URL", "https://www.africau.edu/images/default/sample.pdf"),
        },
        "prescription_notification": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "doctor_name": "Dr. Mehta", "clinic_phone": "+91 9000000000",
            "media_id": os.getenv("SAMPLE_PDF_URL", "https://www.africau.edu/images/default/sample.pdf"),
        },
        "consent_form": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "consent_link": "https://molarplus.com/consent/demo",
            "procedure_name": "Root Canal", "clinic_phone": "+91 9000000000",
        },
        "google_review": {
            "patient_name": "Rahul Sharma", "clinic_name": clinic_name,
            "review_link": "https://g.page/r/demo-review",
            "clinic_phone": "+91 9000000000",
        },
        "daily_summary": {
            "doctor_name": "Dr. Mehta", "clinic_name": clinic_name,
            "date": "09 Apr 2026", "total_patients": 12,
            "total_appointments": 15, "total_revenue": 18500.0,
            "cash_revenue": 12000.0, "online_revenue": 6500.0,
        },
    }

    # Send via Nexus
    success = False
    error_msg = None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if channel == "whatsapp":
                demo = WA_DEMO_DATA.get(body.event_type, {
                    "patient_name": "Test Patient", "clinic_name": clinic_name,
                    "appointment_date": "25 Apr 2026", "appointment_time": "10:00 AM",
                    "clinic_phone": "+91 9000000000",
                })
                resp = await client.post(
                    f"{NEXUS_BASE}/api/v1/notifications/send-event",
                    json={
                        "event_type": body.event_type,
                        "channel": "whatsapp",
                        "to_phone": body.recipient,
                        "template_data": demo,
                    },
                )
            elif channel == "email":
                resp = await client.post(
                    f"{NEXUS_BASE}/api/v1/notifications/email/test",
                    json={
                        "to_email": body.recipient,
                        "subject": f"[Test] {template_name.replace('_', ' ').title()} — {clinic_name}",
                        "clinic_name": clinic_name,
                        "body": rendered,
                    },
                )
            else:  # sms
                resp = await client.post(
                    f"{NEXUS_BASE}/api/v1/notifications/sms/test",
                    json={"mobile_number": body.recipient, "message": rendered},
                )
            success = resp.status_code == 200
            if not success:
                error_msg = resp.json().get("detail", "Send failed")
    except Exception as e:
        error_msg = str(e)

    # Deduct from wallet and log regardless of send result (charge on attempt)
    if success:
        wallet.balance = round(wallet.balance - cost, 4)
        db.add(WalletTransaction(
            clinic_id=clinic_id,
            amount=cost,
            transaction_type="debit",
            description=f"Test: {template_name} via {channel}",
            status="completed",
        ))

    db.add(NotificationLog(
        clinic_id=clinic_id,
        channel=channel,
        recipient=body.recipient,
        event_type=body.event_type,
        template_name=template_name,
        status="sent" if success else "failed",
        cost=cost if success else 0.0,
        error_message=error_msg,
    ))
    db.commit()
    db.refresh(wallet)

    if not success:
        raise HTTPException(status_code=500, detail=error_msg or "Send failed")

    return {
        "success": True,
        "rendered_message": rendered,
        "cost": cost,
        "new_balance": wallet.balance,
    }


# ─── Internal log status update (called by Nexus after sending) ───────────────

class LogUpdateRequest(BaseModel):
    status: str                              # sent, failed
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None


@router.patch("/logs/{log_id}")
async def update_notification_log(
    log_id: int,
    body: LogUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint — called by Nexus after dispatching to update the log
    entry status and provider_message_id (MSG91 request_id).
    No auth required: only reachable from within the private network.
    """
    import datetime as dt
    log = db.query(NotificationLog).filter(NotificationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")

    log.status = body.status
    if body.provider_message_id:
        log.provider_message_id = body.provider_message_id
    if body.error_message:
        log.error_message = body.error_message
    log.updated_at = dt.datetime.utcnow()
    db.commit()
    return {"ok": True}


# ─── MSG91 delivery webhook ───────────────────────────────────────────────────

@router.post("/webhook/msg91")
async def msg91_delivery_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receive delivery status callbacks from MSG91 WhatsApp webhooks.

    MSG91 actual payload fields (from Custom Webhook builder):
      requestId    — correlates to provider_message_id stored on NotificationLog
      eventName    — DELIVERED | READ | FAILED | SENT  (uppercase)
      reason       — error reason if eventName is FAILED
      customerNumber, companyId, ts, templateName, etc.

    Set up 4 webhooks in MSG91 → same URL, different "Select Event":
      • On Delivered Events  → eventName = DELIVERED
      • On Read Events       → eventName = READ
      • On Failed Events     → eventName = FAILED
      • On Sent Events       → eventName = SENT
    """
    import datetime as dt
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # MSG91 sends a single flat object per webhook call (one event per POST)
    # Normalise eventName (uppercase) → our status (lowercase)
    EVENT_NAME_MAP = {
        "DELIVERED": "delivered",
        "READ":      "read",
        "FAILED":    "failed",
        "SENT":      "sent",
        # lowercase fallbacks just in case
        "delivered": "delivered",
        "read":      "read",
        "failed":    "failed",
        "sent":      "sent",
        "undelivered": "failed",
        "submitted":   "sent",
    }

    request_id = (
        payload.get("requestId") or
        payload.get("request_id") or
        payload.get("oneApiRequestId") or
        payload.get("crqid")
    )
    event_name = payload.get("eventName") or payload.get("status") or ""
    status = EVENT_NAME_MAP.get(event_name.strip())
    reason = payload.get("reason") or None

    if not request_id or not status:
        logger.debug(f"MSG91 webhook: unrecognised payload — requestId={request_id} eventName={event_name}")
        return {"ok": True, "updated": 0}

    log = db.query(NotificationLog).filter(
        NotificationLog.provider_message_id == request_id
    ).first()

    if log:
        log.status = status
        if reason and status == "failed":
            log.error_message = reason
        log.updated_at = dt.datetime.utcnow()
        db.commit()
        return {"ok": True, "updated": 1}

    logger.debug(f"MSG91 webhook: no log found for requestId={request_id}")
    return {"ok": True, "updated": 0}
