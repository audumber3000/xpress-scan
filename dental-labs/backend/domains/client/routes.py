"""
Client routes — CRUD for dentist/clinic clients.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case as sa_case

from database import get_db
from core.auth import get_current_user
from models import LabUser, Client, Case, Invoice, Payment
from schemas.client import ClientCreateRequest, ClientUpdateRequest, ClientResponse, ClientListResponse

router = APIRouter()

# A case is "open" until it's delivered or cancelled.
_CLOSED_STATUSES = ("delivered", "cancelled")


def _case_stats_map(db: Session, lab_id: int) -> dict[int, dict]:
    """One grouped query → per-client {case_count, open_case_count, last_case_date}.
    Avoids an N+1 over the client list."""
    rows = (
        db.query(
            Case.client_id.label("client_id"),
            func.count(Case.id).label("total"),
            func.coalesce(
                func.sum(sa_case((Case.status.notin_(_CLOSED_STATUSES), 1), else_=0)), 0
            ).label("open"),
            func.max(Case.received_date).label("last_date"),
        )
        .filter(Case.lab_id == lab_id)
        .group_by(Case.client_id)
        .all()
    )
    return {
        r.client_id: {
            "case_count": int(r.total or 0),
            "open_case_count": int(r.open or 0),
            "last_case_date": r.last_date,
        }
        for r in rows
    }


def _case_stats_for(db: Session, client_id: int) -> dict:
    row = (
        db.query(
            func.count(Case.id).label("total"),
            func.coalesce(
                func.sum(sa_case((Case.status.notin_(_CLOSED_STATUSES), 1), else_=0)), 0
            ).label("open"),
            func.max(Case.received_date).label("last_date"),
        )
        .filter(Case.client_id == client_id)
        .one()
    )
    return {
        "case_count": int(row.total or 0),
        "open_case_count": int(row.open or 0),
        "last_case_date": row.last_date,
    }


def _compute_outstanding(db: Session, client_id: int) -> float:
    """Outstanding = money owed on live invoices (single source of truth,
    consistent with the billing module's /outstanding)."""
    due = db.query(func.coalesce(func.sum(Invoice.due_amount), 0.0)).filter(
        Invoice.client_id == client_id,
        Invoice.status != "cancelled",
    ).scalar()
    return round(float(due), 2)


def _compute_unbilled(db: Session, client_id: int) -> float:
    """Delivered work for this client not yet on a statement."""
    total = db.query(func.coalesce(func.sum(Case.total_amount), 0.0)).filter(
        Case.client_id == client_id,
        Case.status == "delivered",
        Case.invoice_id.is_(None),
    ).scalar()
    return round(float(total), 2)


def _client_to_response(db: Session, client: Client, stats: dict | None = None) -> dict:
    data = ClientResponse.model_validate(client).model_dump()
    data["outstanding_balance"] = _compute_outstanding(db, client.id)
    data["unbilled"] = _compute_unbilled(db, client.id)
    if stats is None:
        stats = _case_stats_for(db, client.id)
    data.update(stats)
    return data


@router.get("")
def list_clients(
    search: str = Query(default=None),
    is_active: bool = Query(default=True),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    query = db.query(Client).filter(Client.lab_id == user.lab_id)

    if is_active is not None:
        query = query.filter(Client.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.clinic_name.ilike(search_term)) |
            (Client.phone.ilike(search_term))
        )

    clients = query.order_by(Client.name).all()
    stats_map = _case_stats_map(db, user.lab_id)
    empty = {"case_count": 0, "open_case_count": 0, "last_case_date": None}
    return {
        "clients": [_client_to_response(db, c, stats_map.get(c.id, empty)) for c in clients],
        "total": len(clients),
    }


@router.post("")
def create_client(
    body: ClientCreateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    client = Client(lab_id=user.lab_id, **body.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"client": _client_to_response(db, client)}


@router.get("/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.lab_id == user.lab_id,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return {"client": _client_to_response(db, client)}


@router.put("/{client_id}")
def update_client(
    client_id: int,
    body: ClientUpdateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.lab_id == user.lab_id,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(client, key):
            setattr(client, key, value)

    db.commit()
    db.refresh(client)
    return {"client": _client_to_response(db, client)}


@router.delete("/{client_id}")
def deactivate_client(
    client_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.lab_id == user.lab_id,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.is_active = False
    db.commit()
    return {"message": "Client deactivated"}
