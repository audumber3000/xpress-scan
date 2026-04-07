import datetime
import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import SupportTicket, SupportMessage, Clinic, User
from routes.auth import get_current_admin

router = APIRouter()

NEXUS_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")


def _notify_clinic(clinic_id: int, subject: str, body: str, db: Session):
    try:
        owner = db.query(User).filter(
            User.clinic_id == clinic_id,
            User.role == "clinic_owner",
            User.is_active == True,
        ).first()
        if owner and owner.email:
            requests.post(
                f"{NEXUS_URL}/email/send",
                json={"to": owner.email, "subject": subject, "body": body},
                timeout=5,
            )
    except Exception:
        pass


def _notify_support_team(subject: str, body: str):
    support_email = os.getenv("SUPPORT_TEAM_EMAIL", "support@molarplus.com")
    try:
        requests.post(
            f"{NEXUS_URL}/email/send",
            json={"to": support_email, "subject": subject, "body": body},
            timeout=5,
        )
    except Exception:
        pass


@router.get("")
def list_tickets(
    status: str = "",
    priority: str = "",
    category: str = "",
    clinic_id: int = 0,
    page: int = 1,
    limit: int = 25,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    query = db.query(SupportTicket)
    if status:
        query = query.filter(SupportTicket.status == status)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
    if category:
        query = query.filter(SupportTicket.category == category)
    if clinic_id:
        query = query.filter(SupportTicket.clinic_id == clinic_id)

    total = query.count()
    tickets = query.order_by(SupportTicket.updated_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for t in tickets:
        last_msg = db.query(SupportMessage).filter(
            SupportMessage.ticket_id == t.id
        ).order_by(SupportMessage.created_at.desc()).first()
        clinic = db.query(Clinic).filter(Clinic.id == t.clinic_id).first()
        result.append({
            "id": t.id,
            "clinic_id": t.clinic_id,
            "clinic_name": clinic.name if clinic else "—",
            "title": t.title,
            "category": t.category,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "last_reply_at": last_msg.created_at.isoformat() if last_msg and last_msg.created_at else None,
            "last_reply_is_staff": last_msg.is_staff if last_msg else None,
            "message_count": db.query(SupportMessage).filter(SupportMessage.ticket_id == t.id).count(),
        })

    return {"tickets": result, "total": total, "page": page, "limit": limit}


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    clinic = db.query(Clinic).filter(Clinic.id == ticket.clinic_id).first()
    creator = db.query(User).filter(User.id == ticket.created_by).first() if ticket.created_by else None
    assignee = db.query(User).filter(User.id == ticket.assigned_to).first() if ticket.assigned_to else None
    messages = db.query(SupportMessage).filter(
        SupportMessage.ticket_id == ticket_id
    ).order_by(SupportMessage.created_at.asc()).all()

    return {
        "ticket": {
            "id": ticket.id,
            "clinic_id": ticket.clinic_id,
            "clinic_name": clinic.name if clinic else "—",
            "title": ticket.title,
            "description": ticket.description,
            "category": ticket.category,
            "status": ticket.status,
            "priority": ticket.priority,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
            "creator": {"id": creator.id, "name": creator.name, "email": creator.email} if creator else None,
            "assignee": {"id": assignee.id, "name": assignee.name, "email": assignee.email} if assignee else None,
        },
        "messages": [
            {
                "id": m.id,
                "body": m.body,
                "is_staff": m.is_staff,
                "sender_name": db.query(User).filter(User.id == m.sender_id).first().name if m.sender_id else "Support Team",
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


class ReplyBody(BaseModel):
    body: str


@router.post("/{ticket_id}/messages")
def reply_ticket(
    ticket_id: int,
    body: ReplyBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        body=body.body,
        is_staff=True,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(msg)
    ticket.updated_at = datetime.datetime.utcnow()
    if ticket.status == "open":
        ticket.status = "in_progress"
    db.commit()

    _notify_clinic(
        ticket.clinic_id,
        f"[MolarPlus Support] Re: {ticket.title}",
        f"Your support ticket has a new reply from our team:\n\n{body.body}\n\nView ticket: https://support.molarplus.com/tickets/{ticket_id}",
        db,
    )

    return {"success": True, "message_id": msg.id}


class TicketUpdateBody(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None


@router.patch("/{ticket_id}")
def update_ticket(
    ticket_id: int,
    body: TicketUpdateBody,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    was_resolved = ticket.status != "resolved" and body.status == "resolved"

    for field, value in body.dict(exclude_none=True).items():
        setattr(ticket, field, value)
    ticket.updated_at = datetime.datetime.utcnow()
    db.commit()

    if was_resolved:
        _notify_clinic(
            ticket.clinic_id,
            f"[MolarPlus Support] Ticket Resolved: {ticket.title}",
            f"Great news! Your support ticket '{ticket.title}' has been marked as resolved.\n\nIf you need further assistance, feel free to open a new ticket.",
            db,
        )

    return {"success": True}


@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"success": True}
