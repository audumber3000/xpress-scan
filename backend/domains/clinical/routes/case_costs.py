"""
Case costs: what a case cost the clinic, as opposed to what it billed.

A lab bill and a consultant's fee are the same shape, so they share one model.
See `CaseCost` in models.py for why the payee is a Vendor in both cases.

The hard rule in this module: a cost NEVER changes what a patient owes. Nothing
here calls recalculate_invoice_totals or writes to an Invoice. The only money it
moves is on the way out, and only when someone settles it.
"""
import logging
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import CaseCost, CasePaper, Expense, Invoice, LabOrder, Patient, User, Vendor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/case-costs", tags=["case-costs"])

KINDS = ("lab", "consultant", "other")
# Expense.category written on settlement, so the ledger groups them sensibly.
EXPENSE_CATEGORY = {"lab": "Lab", "consultant": "Consultant", "other": "General"}


class CaseCostIn(BaseModel):
    patient_id: int
    case_paper_id: Optional[int] = None
    invoice_id: Optional[int] = None
    vendor_id: Optional[int] = None
    kind: str = "consultant"
    description: Optional[str] = None
    basis: str = "fixed"
    percentage: Optional[float] = None
    amount: float = 0.0
    notes: Optional[str] = None


class CaseCostPatch(BaseModel):
    vendor_id: Optional[int] = None
    description: Optional[str] = None
    basis: Optional[str] = None
    percentage: Optional[float] = None
    amount: Optional[float] = None
    notes: Optional[str] = None


class SettleIn(BaseModel):
    payment_method: str = "Cash"
    paid_on: Optional[str] = None   # YYYY-MM-DD, defaults to today


def invoice_collected(db: Session, invoice_id: Optional[int]) -> float:
    """What the linked invoice has actually been paid.

    Percentage fees resolve against this rather than the invoice total: the
    clinic pays a consultant out of money it has, and part payment is normal.
    """
    if not invoice_id:
        return 0.0
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    return float(inv.paid_amount or 0) if inv else 0.0


def resolve_amount(db: Session, cost: CaseCost) -> float:
    """The rupee value of a cost, working out a percentage share if needed."""
    if cost.basis == "percentage":
        base = invoice_collected(db, cost.invoice_id)
        return round(base * (float(cost.percentage or 0) / 100.0), 2)
    return round(float(cost.amount or 0), 2)


def serialise(db: Session, c: CaseCost) -> dict:
    vendor = db.query(Vendor).filter(Vendor.id == c.vendor_id).first() if c.vendor_id else None
    doctor = db.query(User).filter(User.id == c.doctor_user_id).first() if c.doctor_user_id else None
    patient = db.query(Patient).filter(Patient.id == c.patient_id).first()
    return {
        "id": c.id,
        "patient_id": c.patient_id,
        "patient_name": patient.name if patient else None,
        "case_paper_id": c.case_paper_id,
        "invoice_id": c.invoice_id,
        "lab_order_id": c.lab_order_id,
        "vendor_id": c.vendor_id,
        "vendor_name": vendor.name if vendor else None,
        "doctor_user_id": c.doctor_user_id,
        # One label for the UI whichever kind of payee this is.
        "payee_name": (doctor.name if doctor else None) or (vendor.name if vendor else None),
        "kind": c.kind,
        "description": c.description,
        "basis": c.basis,
        "percentage": c.percentage,
        "amount": round(float(c.amount or 0), 2),
        "status": c.status,
        "paid_on": c.paid_on.isoformat() if c.paid_on else None,
        "expense_id": c.expense_id,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ─── Lab orders keep their cost row in step ──────────────────────────────────

def sync_lab_order_cost(db: Session, order: LabOrder, clinic_id: int, user_id: Optional[int] = None):
    """Create or update the CaseCost behind a lab order's cost.

    Called from the lab order create/update handlers. Never raises: a lab order
    must save even if the cost row cannot be written, because the order is the
    clinical record and the cost is bookkeeping on top of it.

    A settled cost is left alone. Once the lab has been paid, editing the order
    must not silently rewrite an expense that is already in the ledger; the
    mismatch is reported by the caller instead.
    """
    try:
        cost = (
            db.query(CaseCost)
            .filter(CaseCost.lab_order_id == order.id, CaseCost.clinic_id == clinic_id)
            .first()
        )
        amount = round(float(order.cost or 0), 2)

        # Cancelled work is not owed, and neither is a zero-cost order.
        if amount <= 0 or (order.status or "") == "Cancelled":
            if cost and cost.status == "unpaid":
                db.delete(cost)
            return

        if cost:
            if cost.status == "paid":
                return  # already settled; see the docstring
            cost.vendor_id = order.vendor_id
            cost.amount = amount
            cost.patient_id = order.patient_id
            cost.case_paper_id = order.case_paper_id
            cost.description = order.work_type or "Lab work"
        else:
            db.add(CaseCost(
                clinic_id=clinic_id,
                patient_id=order.patient_id,
                case_paper_id=order.case_paper_id,
                lab_order_id=order.id,
                vendor_id=order.vendor_id,
                kind="lab",
                description=order.work_type or "Lab work",
                basis="fixed",
                amount=amount,
                status="unpaid",
                created_by=user_id,
            ))
    except Exception as exc:  # noqa: BLE001 — bookkeeping must not sink the order
        logger.warning("case cost sync failed for lab order %s: %s", getattr(order, "id", "?"), exc)


def fee_terms(db: Session, *, user_id: Optional[int] = None, vendor_id: Optional[int] = None):
    """The configured rate for a payee, or None if they are not paid per case.

    Terms live on the person, set once in Staff settings (or on the vendor for a
    visiting consultant who has no login). Most staff have none — the owner
    dentist does not invoice themselves — and None means no cost row is created.
    """
    row = None
    if user_id:
        row = db.query(User).filter(User.id == user_id).first()
    elif vendor_id:
        row = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not row:
        return None
    basis = (getattr(row, "fee_basis", None) or "").strip().lower()
    value = getattr(row, "fee_value", None)
    if basis not in ("fixed", "percentage") or not value or float(value) <= 0:
        return None
    return {"basis": basis, "value": float(value), "name": getattr(row, "name", None)}


def sync_consultant_fee(db: Session, *, clinic_id: int, patient_id: int,
                        case_paper_id: Optional[int] = None,
                        invoice_id: Optional[int] = None,
                        doctor_user_id: Optional[int] = None,
                        vendor_id: Optional[int] = None,
                        actor_id: Optional[int] = None):
    """Create or refresh the fee owed for a case, from the payee's configured rate.

    Called when a case gains a treating doctor or when money lands against its
    invoice. Nobody types an amount, so the same doctor is charged the same way
    on every case and a per-consultant split actually means something.

    Never raises: a fee is bookkeeping on top of clinical work, and must not stop
    a case paper or a payment from saving.

    A settled fee is left alone. Once paid it is an expense in the books, and
    silently rewriting it would change history somebody has already been paid on.
    """
    try:
        if not case_paper_id and not invoice_id:
            # Without one of these there is nothing to key the fee to, and a
            # bare filter would collapse to "invoice_id IS NULL" and match some
            # other case's fee.
            return

        terms = fee_terms(db, user_id=doctor_user_id, vendor_id=vendor_id)
        q = db.query(CaseCost).filter(
            CaseCost.clinic_id == clinic_id,
            CaseCost.kind == "consultant",
        )
        q = q.filter(CaseCost.case_paper_id == case_paper_id) if case_paper_id \
            else q.filter(CaseCost.invoice_id == invoice_id)
        existing = q.first()

        if not terms:
            # Rate removed, or the doctor changed to someone unpaid.
            if existing and existing.status == "unpaid":
                db.delete(existing)
            return

        if existing and existing.status == "paid":
            return

        cost = existing or CaseCost(
            clinic_id=clinic_id,
            patient_id=patient_id,
            case_paper_id=case_paper_id,
            kind="consultant",
            status="unpaid",
            created_by=actor_id,
        )
        cost.invoice_id = invoice_id or cost.invoice_id
        cost.doctor_user_id = doctor_user_id
        cost.vendor_id = vendor_id
        cost.description = f"Consultant fee: {terms['name']}" if terms.get("name") else "Consultant fee"
        cost.basis = terms["basis"]
        cost.percentage = terms["value"] if terms["basis"] == "percentage" else None
        cost.amount = (
            resolve_amount(db, cost) if terms["basis"] == "percentage"
            else round(terms["value"], 2)
        )
        if not existing:
            db.add(cost)
    except Exception as exc:  # noqa: BLE001 — never block the clinical save
        logger.warning("consultant fee sync failed (patient %s): %s", patient_id, exc)


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
def list_case_costs(
    patient_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    kind: Optional[str] = None,
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CaseCost).filter(CaseCost.clinic_id == current_user.clinic_id)
    if patient_id:
        q = q.filter(CaseCost.patient_id == patient_id)
    if case_paper_id:
        q = q.filter(CaseCost.case_paper_id == case_paper_id)
    if kind:
        q = q.filter(CaseCost.kind == kind)
    if status:
        q = q.filter(CaseCost.status == status)
    if vendor_id:
        q = q.filter(CaseCost.vendor_id == vendor_id)

    rows = q.order_by(CaseCost.created_at.desc()).all()
    unpaid = sum(float(c.amount or 0) for c in rows if c.status == "unpaid")
    return {
        "items": [serialise(db, c) for c in rows],
        "total": round(sum(float(c.amount or 0) for c in rows), 2),
        "unpaid": round(unpaid, 2),
        "paid": round(sum(float(c.amount or 0) for c in rows if c.status == "paid"), 2),
    }


@router.get("/summary")
def case_cost_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Outstanding payables, split by kind and by who is owed."""
    cid = current_user.clinic_id
    rows = db.query(CaseCost).filter(
        CaseCost.clinic_id == cid, CaseCost.status == "unpaid"
    ).all()

    by_kind, by_vendor = {}, {}
    for c in rows:
        amt = float(c.amount or 0)
        by_kind[c.kind] = round(by_kind.get(c.kind, 0.0) + amt, 2)
        vendor = db.query(Vendor).filter(Vendor.id == c.vendor_id).first() if c.vendor_id else None
        name = vendor.name if vendor else "Unassigned"
        entry = by_vendor.setdefault(name, {"vendor": name, "vendor_id": c.vendor_id, "count": 0, "amount": 0.0})
        entry["count"] += 1
        entry["amount"] = round(entry["amount"] + amt, 2)

    return {
        "unpaid_total": round(sum(float(c.amount or 0) for c in rows), 2),
        "unpaid_count": len(rows),
        "by_kind": [{"kind": k, "amount": v} for k, v in sorted(by_kind.items())],
        "by_vendor": sorted(by_vendor.values(), key=lambda x: -x["amount"]),
    }


@router.get("/by-consultant")
def earnings_by_consultant(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What each consultant has earned, paid and still owed.

    The reason fees are configured per person rather than typed per case: this
    grouping only means anything when the same doctor is charged the same way
    every time.
    """
    cid = current_user.clinic_id
    q = db.query(CaseCost).filter(
        CaseCost.clinic_id == cid, CaseCost.kind == "consultant"
    )
    if status:
        q = q.filter(CaseCost.status == status)

    agg = {}
    for c in q.all():
        if c.doctor_user_id:
            who = db.query(User).filter(User.id == c.doctor_user_id).first()
            key, name = f"u{c.doctor_user_id}", (who.name if who else "Unknown")
        elif c.vendor_id:
            who = db.query(Vendor).filter(Vendor.id == c.vendor_id).first()
            key, name = f"v{c.vendor_id}", (who.name if who else "Unknown")
        else:
            key, name = "none", "Unassigned"

        e = agg.setdefault(key, {
            "key": key, "name": name,
            "is_staff": key.startswith("u"),
            "cases": 0, "total": 0.0, "paid": 0.0, "unpaid": 0.0,
        })
        amt = float(c.amount or 0)
        e["cases"] += 1
        e["total"] = round(e["total"] + amt, 2)
        if c.status == "paid":
            e["paid"] = round(e["paid"] + amt, 2)
        else:
            e["unpaid"] = round(e["unpaid"] + amt, 2)

    rows = sorted(agg.values(), key=lambda x: -x["total"])
    return {
        "consultants": rows,
        "total": round(sum(r["total"] for r in rows), 2),
        "unpaid": round(sum(r["unpaid"] for r in rows), 2),
        "top": rows[0]["name"] if rows else None,
    }


@router.post("")
def create_case_cost(
    payload: CaseCostIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {KINDS}")
    if payload.basis not in ("fixed", "percentage"):
        raise HTTPException(status_code=400, detail="basis must be fixed or percentage")

    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id, Patient.clinic_id == current_user.clinic_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    cost = CaseCost(
        clinic_id=current_user.clinic_id,
        patient_id=payload.patient_id,
        case_paper_id=payload.case_paper_id,
        invoice_id=payload.invoice_id,
        vendor_id=payload.vendor_id,
        kind=payload.kind,
        description=payload.description,
        basis=payload.basis,
        percentage=payload.percentage,
        notes=payload.notes,
        status="unpaid",
        created_by=current_user.id,
    )
    # Resolved once and stored, so a later payment does not retroactively move
    # a fee somebody has already been told about.
    cost.amount = resolve_amount(db, cost) if payload.basis == "percentage" else round(float(payload.amount or 0), 2)

    db.add(cost)
    db.commit()
    db.refresh(cost)
    return serialise(db, cost)


@router.put("/{cost_id}")
def update_case_cost(
    cost_id: int,
    payload: CaseCostPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cost = db.query(CaseCost).filter(
        CaseCost.id == cost_id, CaseCost.clinic_id == current_user.clinic_id
    ).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Cost not found")
    if cost.status == "paid":
        raise HTTPException(status_code=400, detail="Already settled. Unsettle it first to make changes.")

    for field in ("vendor_id", "description", "basis", "percentage", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(cost, field, val)
    if payload.amount is not None and cost.basis == "fixed":
        cost.amount = round(float(payload.amount), 2)
    if cost.basis == "percentage":
        cost.amount = resolve_amount(db, cost)

    db.commit()
    db.refresh(cost)
    return serialise(db, cost)


@router.post("/{cost_id}/settle")
def settle_case_cost(
    cost_id: int,
    payload: SettleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pay a cost: writes an Expense and links it.

    The Expense is what makes this appear in the ledger, the CSV export and the
    dashboard's money-out figure, all of which read Expense rows and need no
    changes to see it.
    """
    cost = db.query(CaseCost).filter(
        CaseCost.id == cost_id, CaseCost.clinic_id == current_user.clinic_id
    ).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Cost not found")
    if cost.status == "paid":
        raise HTTPException(status_code=400, detail="Already settled")
    if float(cost.amount or 0) <= 0:
        raise HTTPException(status_code=400, detail="Nothing to settle")

    when = datetime.utcnow()
    if payload.paid_on:
        try:
            when = datetime.strptime(payload.paid_on, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="paid_on must be YYYY-MM-DD")

    patient = db.query(Patient).filter(Patient.id == cost.patient_id).first()
    expense = Expense(
        clinic_id=current_user.clinic_id,
        vendor_id=cost.vendor_id,
        amount=round(float(cost.amount), 2),
        payment_method=payload.payment_method or "Cash",
        category=EXPENSE_CATEGORY.get(cost.kind, "General"),
        notes="; ".join(filter(None, [
            cost.description,
            f"Patient: {patient.name}" if patient else None,
            f"[case_cost:{cost.id}]",
        ])),
        date=when,
        created_by=current_user.id,
    )
    db.add(expense)
    db.flush()

    cost.expense_id = expense.id
    cost.status = "paid"
    cost.paid_on = when.date()
    db.commit()
    db.refresh(cost)
    return serialise(db, cost)


@router.post("/{cost_id}/unsettle")
def unsettle_case_cost(
    cost_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Undo a settlement, removing the Expense it wrote."""
    cost = db.query(CaseCost).filter(
        CaseCost.id == cost_id, CaseCost.clinic_id == current_user.clinic_id
    ).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Cost not found")
    if cost.status != "paid":
        raise HTTPException(status_code=400, detail="Not settled")

    if cost.expense_id:
        exp = db.query(Expense).filter(
            Expense.id == cost.expense_id, Expense.clinic_id == current_user.clinic_id
        ).first()
        if exp:
            db.delete(exp)
    cost.expense_id = None
    cost.status = "unpaid"
    cost.paid_on = None
    db.commit()
    db.refresh(cost)
    return serialise(db, cost)


@router.delete("/{cost_id}")
def delete_case_cost(
    cost_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cost = db.query(CaseCost).filter(
        CaseCost.id == cost_id, CaseCost.clinic_id == current_user.clinic_id
    ).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Cost not found")

    # Deleting a settled cost takes its expense with it, otherwise the ledger
    # keeps an outgoing payment with nothing behind it.
    if cost.expense_id:
        exp = db.query(Expense).filter(
            Expense.id == cost.expense_id, Expense.clinic_id == current_user.clinic_id
        ).first()
        if exp:
            db.delete(exp)

    db.delete(cost)
    db.commit()
    return {"message": "Cost removed"}


@router.post("/backfill-lab-orders")
def backfill_lab_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create the missing cost rows for lab orders placed before this existed.

    Idempotent: a lab order that already has a cost row is skipped, so this is
    safe to run more than once.
    """
    cid = current_user.clinic_id
    existing = {
        r[0] for r in db.query(CaseCost.lab_order_id)
        .filter(CaseCost.clinic_id == cid, CaseCost.lab_order_id.isnot(None)).all()
    }

    orders = db.query(LabOrder).filter(
        LabOrder.clinic_id == cid,
        func.coalesce(LabOrder.cost, 0) > 0,
        LabOrder.status != "Cancelled",
    ).all()

    created = 0
    for o in orders:
        if o.id in existing:
            continue
        db.add(CaseCost(
            clinic_id=cid,
            patient_id=o.patient_id,
            case_paper_id=o.case_paper_id,
            lab_order_id=o.id,
            vendor_id=o.vendor_id,
            kind="lab",
            description=o.work_type or "Lab work",
            basis="fixed",
            amount=round(float(o.cost or 0), 2),
            status="unpaid",
            created_by=current_user.id,
            created_at=o.created_at or datetime.utcnow(),
        ))
        created += 1

    db.commit()
    return {
        "created": created,
        "skipped": len(orders) - created,
        "total_lab_orders_with_cost": len(orders),
    }
