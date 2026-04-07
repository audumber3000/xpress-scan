import datetime
import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import SupportTicket, SupportMessage, User
from core.auth_utils import get_current_user

router = APIRouter()

NEXUS_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
SUPPORT_TEAM_EMAIL = os.getenv("SUPPORT_TEAM_EMAIL", "support@molarplus.com")


def _notify_email(to: str, subject: str, body: str):
    try:
        requests.post(
            f"{NEXUS_URL}/email/send",
            json={"to": to, "subject": subject, "body": body},
            timeout=5,
        )
    except Exception:
        pass


class CreateTicketBody(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "other"
    priority: str = "normal"


class CreateMessageBody(BaseModel):
    body: str


@router.post("")
def create_ticket(
    body: CreateTicketBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with your account")

    ticket = SupportTicket(
        clinic_id=current_user.clinic_id,
        created_by=current_user.id,
        title=body.title,
        description=body.description,
        category=body.category,
        priority=body.priority,
        status="open",
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    )
    db.add(ticket)
    db.flush()

    if body.description:
        msg = SupportMessage(
            ticket_id=ticket.id,
            sender_id=current_user.id,
            body=body.description,
            is_staff=False,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(msg)

    db.commit()
    db.refresh(ticket)

    _notify_email(
        SUPPORT_TEAM_EMAIL,
        f"[New Ticket] {body.title}",
        f"A new support ticket has been raised.\n\nClinic: {current_user.clinic_id}\nUser: {current_user.name} ({current_user.email})\nCategory: {body.category}\nPriority: {body.priority}\n\nDescription:\n{body.description or 'N/A'}",
    )

    return {"id": ticket.id, "status": ticket.status, "created_at": ticket.created_at.isoformat()}


@router.get("")
def list_my_tickets(
    status: str = "",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.clinic_id:
        return {"tickets": [], "total": 0}

    query = db.query(SupportTicket).filter(SupportTicket.clinic_id == current_user.clinic_id)
    if status:
        query = query.filter(SupportTicket.status == status)

    total = query.count()
    tickets = query.order_by(SupportTicket.updated_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "tickets": [
            {
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "status": t.status,
                "priority": t.priority,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                "message_count": db.query(SupportMessage).filter(SupportMessage.ticket_id == t.id).count(),
            }
            for t in tickets
        ],
        "total": total,
    }


@router.get("/{ticket_id}")
def get_my_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.clinic_id == current_user.clinic_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    messages = db.query(SupportMessage).filter(
        SupportMessage.ticket_id == ticket_id
    ).order_by(SupportMessage.created_at.asc()).all()

    return {
        "ticket": {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "category": ticket.category,
            "status": ticket.status,
            "priority": ticket.priority,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        },
        "messages": [
            {
                "id": m.id,
                "body": m.body,
                "is_staff": m.is_staff,
                "sender_name": "MolarPlus Support" if m.is_staff else current_user.name,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.post("/{ticket_id}/messages")
def reply_my_ticket(
    ticket_id: int,
    body: CreateMessageBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.clinic_id == current_user.clinic_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Ticket is closed")

    msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        body=body.body,
        is_staff=False,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(msg)
    ticket.updated_at = datetime.datetime.utcnow()
    if ticket.status == "resolved":
        ticket.status = "open"
    db.commit()

    _notify_email(
        SUPPORT_TEAM_EMAIL,
        f"[Clinic Reply] {ticket.title}",
        f"A clinic has replied to ticket #{ticket_id}.\n\nClinic: {current_user.clinic_id}\nUser: {current_user.name}\n\n{body.body}",
    )

    return {"success": True, "message_id": msg.id}
