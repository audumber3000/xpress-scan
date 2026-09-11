"""
Case routes — create, list, detail, status transitions, items, attachments.
"""
import os
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from database import get_db
from core.auth import get_current_user
from models import LabUser, Case, CaseItem, CaseAttachment, Client
from schemas.case import (
    CaseCreateRequest, CaseUpdateRequest, CaseStatusUpdate,
    CaseItemCreate, CaseItemUpdate,
    CaseResponse, CaseItemResponse, StatusHistoryEntry, AttachmentResponse,
)
from domains.case.service import CaseService, STATUS_EVENT_MAP
from domains.notification.dispatcher import notify_lab_event

router = APIRouter()


def _schedule_case_notification(background_tasks: BackgroundTasks, case: Case, event_type: str):
    """Queue a notification for a case event. The dispatcher decides channels
    from the lab's notification_settings and logs the outcome — runs after the
    response is returned, so status updates stay instant."""
    background_tasks.add_task(
        notify_lab_event,
        event_type=event_type,
        lab_id=case.lab_id,
        client_id=case.client_id,
        case_id=case.id,
    )

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


def _case_to_response(case: Case) -> dict:
    """Convert a Case ORM object to a response dict with nested relations."""
    data = {
        "id": case.id,
        "case_number": case.case_number,
        "client_id": case.client_id,
        "client_name": case.client.name if case.client else None,
        "clinic_name": case.client.clinic_name if case.client else None,
        "doctor_name": case.doctor_name,
        "patient_name": case.patient_name,
        "patient_age": case.patient_age,
        "patient_sex": case.patient_sex,
        "received_date": case.received_date,
        "due_date": case.due_date,
        "priority": case.priority,
        "status": case.status,
        "notes": case.notes,
        "total_amount": case.total_amount,
        "created_at": case.created_at,
        "items": [CaseItemResponse.model_validate(i).model_dump() for i in (case.items or [])],
        "status_history": [],
        "attachments": [AttachmentResponse.model_validate(a).model_dump() for a in (case.attachments or [])],
    }

    # Build status history with user names
    for h in (case.status_history or []):
        entry = {
            "id": h.id,
            "from_status": h.from_status,
            "to_status": h.to_status,
            "changed_by": h.changed_by,
            "changed_by_name": h.user.name if h.user else None,
            "changed_at": h.changed_at,
            "note": h.note,
        }
        data["status_history"].append(entry)

    return data


@router.get("")
def list_cases(
    status: str = Query(default=None),
    client_id: int = Query(default=None),
    priority: str = Query(default=None),
    due_today: bool = Query(default=False),
    overdue: bool = Query(default=False),
    search: str = Query(default=None),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    query = db.query(Case).options(
        joinedload(Case.client),
        joinedload(Case.items),
    ).filter(Case.lab_id == user.lab_id)

    if status:
        query = query.filter(Case.status == status)
    if client_id:
        query = query.filter(Case.client_id == client_id)
    if priority:
        query = query.filter(Case.priority == priority)
    if due_today:
        today = datetime.date.today()
        query = query.filter(Case.due_date == today)
    if overdue:
        today = datetime.date.today()
        query = query.filter(
            Case.due_date < today,
            Case.status.notin_(["delivered", "cancelled"]),
        )
    if search:
        search_term = f"%{search}%"
        query = query.outerjoin(Client, Case.client_id == Client.id).filter(
            or_(
                Case.case_number.ilike(search_term),
                Case.patient_name.ilike(search_term),
                Client.name.ilike(search_term),
                Client.clinic_name.ilike(search_term),
            )
        )

    cases = query.order_by(Case.created_at.desc()).all()

    # Build lightweight list responses (without full history)
    result = []
    for c in cases:
        data = {
            "id": c.id,
            "case_number": c.case_number,
            "client_id": c.client_id,
            "client_name": c.client.name if c.client else None,
            "clinic_name": c.client.clinic_name if c.client else None,
            "doctor_name": c.doctor_name,
            "patient_name": c.patient_name,
            "patient_age": c.patient_age,
            "patient_sex": c.patient_sex,
            "received_date": c.received_date,
            "due_date": c.due_date,
            "priority": c.priority,
            "status": c.status,
            "notes": c.notes,
            "total_amount": c.total_amount,
            "created_at": c.created_at,
            "items": [CaseItemResponse.model_validate(i).model_dump() for i in (c.items or [])],
            "status_history": [],
            "attachments": [],
        }
        result.append(data)

    return {"cases": result, "total": len(result)}


@router.post("")
def create_case(
    body: CaseCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    # Verify client belongs to this lab
    client = db.query(Client).filter(
        Client.id == body.client_id,
        Client.lab_id == user.lab_id,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    svc = CaseService(db)
    case = svc.create_case(user.lab_id, user.id, body.model_dump())

    # A new case enters at "received" — notify the dentist.
    _schedule_case_notification(background_tasks, case, "case_received")

    # Reload with relationships
    case = db.query(Case).options(
        joinedload(Case.client),
        joinedload(Case.items),
        joinedload(Case.status_history),
        joinedload(Case.attachments),
    ).filter(Case.id == case.id).first()

    return {"case": _case_to_response(case)}


@router.get("/{case_id}")
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    case = db.query(Case).options(
        joinedload(Case.client),
        joinedload(Case.items),
        joinedload(Case.status_history),
        joinedload(Case.attachments),
    ).filter(
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return {"case": _case_to_response(case)}


@router.put("/{case_id}")
def update_case(
    case_id: int,
    body: CaseUpdateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(case, key):
            setattr(case, key, value)

    db.commit()
    db.refresh(case)

    # Reload with relationships
    case = db.query(Case).options(
        joinedload(Case.client),
        joinedload(Case.items),
        joinedload(Case.status_history),
        joinedload(Case.attachments),
    ).filter(Case.id == case.id).first()

    return {"case": _case_to_response(case)}


# ── Status transitions ──────────────────────────────────────────────────

@router.patch("/{case_id}/status")
def update_status(
    case_id: int,
    body: CaseStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    svc = CaseService(db)
    try:
        case = svc.update_status(case, body.status, user.id, body.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Notify the dentist on key transitions (received notified at create time).
    event_type = STATUS_EVENT_MAP.get(case.status)
    if event_type and event_type != "case_received":
        _schedule_case_notification(background_tasks, case, event_type)

    # Reload with relationships
    case = db.query(Case).options(
        joinedload(Case.client),
        joinedload(Case.items),
        joinedload(Case.status_history),
        joinedload(Case.attachments),
    ).filter(Case.id == case.id).first()

    return {"case": _case_to_response(case)}


# ── Line items ──────────────────────────────────────────────────────────

@router.post("/{case_id}/items")
def add_item(
    case_id: int,
    body: CaseItemCreate,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    line_total = body.qty * body.unit_price
    item = CaseItem(
        case_id=case.id,
        product_id=body.product_id,
        product_name=body.product_name,
        tooth_numbers=body.tooth_numbers,
        shade=body.shade,
        material=body.material,
        qty=body.qty,
        unit_price=body.unit_price,
        line_total=round(line_total, 2),
    )
    db.add(item)
    db.flush()

    # Recalculate total
    svc = CaseService(db)
    svc.recalculate_total(case)

    return {"item": CaseItemResponse.model_validate(item).model_dump()}


@router.put("/{case_id}/items/{item_id}")
def update_item(
    case_id: int,
    item_id: int,
    body: CaseItemUpdate,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    item = db.query(CaseItem).join(Case).filter(
        CaseItem.id == item_id,
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(item, key):
            setattr(item, key, value)

    # Recalculate line total
    item.line_total = round(item.qty * item.unit_price, 2)
    db.flush()

    # Recalculate case total
    case = db.query(Case).filter(Case.id == case_id).first()
    svc = CaseService(db)
    svc.recalculate_total(case)

    return {"item": CaseItemResponse.model_validate(item).model_dump()}


@router.delete("/{case_id}/items/{item_id}")
def delete_item(
    case_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    item = db.query(CaseItem).join(Case).filter(
        CaseItem.id == item_id,
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.flush()

    case = db.query(Case).filter(Case.id == case_id).first()
    svc = CaseService(db)
    svc.recalculate_total(case)

    return {"message": "Item removed"}


# ── Attachments ─────────────────────────────────────────────────────────

@router.post("/{case_id}/attachments")
async def upload_attachment(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.lab_id == user.lab_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Save file
    upload_dir = os.path.join(UPLOAD_DIR, "cases", str(case_id))
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    attachment = CaseAttachment(
        case_id=case.id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {"attachment": AttachmentResponse.model_validate(attachment).model_dump()}


@router.delete("/{case_id}/attachments/{attachment_id}")
def delete_attachment(
    case_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    att = db.query(CaseAttachment).filter(
        CaseAttachment.id == attachment_id,
        CaseAttachment.case_id == case_id,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Remove file from disk
    if os.path.exists(att.file_path):
        os.remove(att.file_path)

    db.delete(att)
    db.commit()
    return {"message": "Attachment removed"}
