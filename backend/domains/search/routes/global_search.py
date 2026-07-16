"""
Unified global search across the clinic's records.

One endpoint instead of five so the command palette needs a single round-trip
and permission gating lives in one place.

Two deliberate choices:

* Responses are plain dicts, not response_model DTOs. A strict DTO makes one
  malformed row (a patient with a junk phone, say) 500 the entire response —
  the exact failure the patients list already hit. Search must degrade to
  "fewer results", never to an error page.
* A type the caller can't view is omitted from `types`, not 403'd. Search is
  cross-cutting: a receptionist without finance access should still get
  patient hits rather than a blanket failure.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from core.auth_utils import get_current_user
from database import get_db
from models import (
    Appointment,
    InventoryItem,
    Invoice,
    LabOrder,
    Patient,
    Payment,
    User,
    Vendor,
)

router = APIRouter()

# Search type -> permission resource keys. Any one granting view/read is enough.
TYPE_PERMISSIONS = {
    "patients": ["patients"],
    "appointments": ["appointments"],
    "billing": ["finance"],
    "stock": ["vendors", "inventory"],
    "lab": ["lab"],
}

ALL_TYPES = list(TYPE_PERMISSIONS.keys())

# Mirrors core.auth_utils.check_permission, which treats these as equivalent.
VIEW_KEYS = ("view", "read")


def _can_view(user: User, search_type: str) -> bool:
    """Deny-by-default; clinic_owner always passes."""
    if user.role == "clinic_owner":
        return True
    permissions = user.permissions or {}
    for resource in TYPE_PERMISSIONS.get(search_type, []):
        resource_permissions = permissions.get(resource) or {}
        if any(resource_permissions.get(key) is True for key in VIEW_KEYS):
            return True
    return False


def _like(term: str) -> str:
    """Escape LIKE wildcards so a query of "100%" doesn't match everything."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _search_patients(db: Session, clinic_id: int, term: str, limit: int) -> List[dict]:
    pattern = _like(term)
    rows = (
        db.query(Patient)
        .filter(
            Patient.clinic_id == clinic_id,
            or_(
                Patient.name.ilike(pattern),
                Patient.phone.ilike(pattern),
                Patient.email.ilike(pattern),
                Patient.village.ilike(pattern),
            ),
        )
        .order_by(Patient.name)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": p.id,
            "title": p.name,
            "subtitle": p.phone or p.email or "",
            "meta": p.treatment_type or "",
            "extra": p.village or "",
            "link": f"/patient-profile/{p.id}",
        }
        for p in rows
    ]


def _search_appointments(db: Session, clinic_id: int, term: str, limit: int) -> List[dict]:
    pattern = _like(term)
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == clinic_id,
            or_(
                Appointment.patient_name.ilike(pattern),
                Appointment.patient_phone.ilike(pattern),
                Appointment.treatment.ilike(pattern),
                Appointment.status.ilike(pattern),
                Appointment.chair_number.ilike(pattern),
            ),
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(limit)
        .all()
    )
    out = []
    for a in rows:
        date_str = a.appointment_date.strftime("%d %b %Y") if a.appointment_date else ""
        out.append(
            {
                "id": a.id,
                "title": a.patient_name,
                "subtitle": a.treatment or "",
                "meta": f"{date_str} {a.start_time or ''}".strip(),
                "status": a.status or "",
                "link": f"/calendar?appointment={a.id}",
            }
        )
    return out


def _search_billing(db: Session, clinic_id: int, term: str, limit: int) -> List[dict]:
    """Invoices and payments in one list — the UI shows them under one Billing tab."""
    pattern = _like(term)
    out: List[dict] = []

    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.patient))
        .outerjoin(Patient, Invoice.patient_id == Patient.id)
        .filter(
            Invoice.clinic_id == clinic_id,
            or_(
                Invoice.invoice_number.ilike(pattern),
                Invoice.utr.ilike(pattern),
                Invoice.payment_mode.ilike(pattern),
                Invoice.status.ilike(pattern),
                Patient.name.ilike(pattern),
            ),
        )
        .order_by(Invoice.created_at.desc())
        .limit(limit)
        .all()
    )
    for inv in invoices:
        out.append(
            {
                "id": inv.id,
                "kind": "invoice",
                "title": inv.invoice_number or f"Invoice #{inv.id}",
                "subtitle": (inv.patient.name if inv.patient else "") or "",
                "meta": f"₹{inv.total or 0:.2f}",
                "status": inv.status or "",
                "link": f"/payments?invoice={inv.id}",
            }
        )

    payments = (
        db.query(Payment)
        .options(joinedload(Payment.patient))
        .outerjoin(Patient, Payment.patient_id == Patient.id)
        .filter(
            Payment.clinic_id == clinic_id,
            or_(
                Payment.transaction_id.ilike(pattern),
                Payment.payment_method.ilike(pattern),
                Payment.paid_by.ilike(pattern),
                Payment.status.ilike(pattern),
                Patient.name.ilike(pattern),
            ),
        )
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .all()
    )
    for pay in payments:
        out.append(
            {
                "id": pay.id,
                "kind": "payment",
                "title": pay.transaction_id or f"Payment #{pay.id}",
                "subtitle": (pay.patient.name if pay.patient else "") or "",
                "meta": f"₹{pay.amount or 0:.2f}",
                "status": pay.status or "",
                # Payments have no detail view of their own; the ledger tab is
                # where they're listed, so that's the honest destination.
                "link": "/payments?tab=ledger",
            }
        )

    return out[:limit]


def _search_stock(db: Session, clinic_id: int, term: str, limit: int) -> List[dict]:
    pattern = _like(term)
    rows = (
        db.query(InventoryItem)
        .options(joinedload(InventoryItem.vendor))
        .filter(
            InventoryItem.clinic_id == clinic_id,
            or_(
                InventoryItem.name.ilike(pattern),
                InventoryItem.category.ilike(pattern),
            ),
        )
        .order_by(InventoryItem.name)
        .limit(limit)
        .all()
    )
    out = []
    for item in rows:
        qty = item.quantity or 0
        low = qty <= (item.min_stock_level or 0)
        out.append(
            {
                "id": item.id,
                "title": item.name,
                "subtitle": (item.vendor.name if item.vendor else "") or "",
                "meta": f"{qty:g} {item.unit or ''}".strip(),
                "status": "Low stock" if low else "In stock",
                "extra": item.category or "",
                "link": f"/vendors?item={item.id}",
            }
        )
    return out


def _search_lab(db: Session, clinic_id: int, term: str, limit: int) -> List[dict]:
    pattern = _like(term)
    rows = (
        db.query(LabOrder)
        .options(joinedload(LabOrder.patient), joinedload(LabOrder.vendor))
        .outerjoin(Patient, LabOrder.patient_id == Patient.id)
        .outerjoin(Vendor, LabOrder.vendor_id == Vendor.id)
        .filter(
            LabOrder.clinic_id == clinic_id,
            or_(
                LabOrder.work_type.ilike(pattern),
                LabOrder.tooth_number.ilike(pattern),
                LabOrder.shade.ilike(pattern),
                LabOrder.status.ilike(pattern),
                Patient.name.ilike(pattern),
                Vendor.name.ilike(pattern),
            ),
        )
        .order_by(LabOrder.created_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for order in rows:
        due = order.due_date.strftime("%d %b %Y") if order.due_date else ""
        out.append(
            {
                "id": order.id,
                "title": order.work_type or f"Lab order #{order.id}",
                "subtitle": (order.patient.name if order.patient else "") or "",
                "meta": (order.vendor.name if order.vendor else "") or "",
                "status": order.status or "",
                "extra": f"Due {due}" if due else "",
                "link": f"/lab?order={order.id}",
            }
        )
    return out


SEARCHERS = {
    "patients": _search_patients,
    "appointments": _search_appointments,
    "billing": _search_billing,
    "stock": _search_stock,
    "lab": _search_lab,
}


@router.get("", summary="Search across patients, appointments, billing, stock and lab orders")
async def global_search(
    q: str = Query(..., min_length=2, description="Search term (min 2 characters)"),
    types: Optional[str] = Query(
        None,
        description="Comma-separated subset of: patients, appointments, billing, stock, lab. Defaults to all the caller can view.",
    ),
    limit: int = Query(10, ge=1, le=50, description="Max results per type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns `{ results: {type: [...]}, counts: {type: n}, types: [...] }`.

    `types` lists only what this user may view, so the UI can render exactly
    those tabs without duplicating permission rules.
    """
    term = (q or "").strip()
    if not term:
        return {"results": {}, "counts": {}, "types": []}

    requested = ALL_TYPES
    if types:
        wanted = {t.strip() for t in types.split(",") if t.strip()}
        requested = [t for t in ALL_TYPES if t in wanted]

    allowed = [t for t in requested if _can_view(current_user, t)]

    results: dict = {}
    for search_type in allowed:
        try:
            results[search_type] = SEARCHERS[search_type](
                db, current_user.clinic_id, term, limit
            )
        except Exception:
            # One broken table must not sink the whole palette — that type just
            # comes back empty while the rest still render.
            results[search_type] = []

    return {
        "results": results,
        "counts": {t: len(rows) for t, rows in results.items()},
        "types": allowed,
    }
