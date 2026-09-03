"""Quotations: a priced treatment plan the patient accepts before work starts."""
import os
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import (Quotation, QuotationLineItem, Patient, User, TreatmentType, Clinic,
                    Invoice, InvoiceLineItem)
from core.auth_utils import get_current_user
from domains.insurance.estimator import estimate_lines, policy_to_dict, normalise_category
from domains.insurance.routes.insurance import active_policy_for
from domains.finance.routes.invoices import generate_invoice_number, recalculate_invoice_totals
from domains.quotations.quotation_pdf import render_quotation
from domains.infrastructure.services.pdf_service import html_template_to_pdf
from core.notification_dispatch import notify_event, InsufficientWalletBalance

router = APIRouter()

DEFAULT_VALID_DAYS = 30
EDITABLE = ("draft",)


class LineDTO(BaseModel):
    description: str = Field(..., min_length=1, max_length=300)
    tooth_number: Optional[str] = Field(None, max_length=50)
    benefit_category: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0


class QuotationDTO(BaseModel):
    patient_id: int
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    discount: float = 0.0
    lines: List[LineDTO] = []


def _number(db: Session, clinic_id: int) -> str:
    year = datetime.utcnow().year
    last = (db.query(Quotation)
            .filter(Quotation.clinic_id == clinic_id,
                    Quotation.quotation_number.like(f"QTN-{year}-%"))
            .order_by(desc(Quotation.quotation_number)).first())
    n = 1
    if last and last.quotation_number:
        try:
            n = int(last.quotation_number.split("-")[-1]) + 1
        except ValueError:
            n = 1
    return f"QTN-{year}-{n:04d}"


def _recalculate(db: Session, q: Quotation):
    """Price the lines, then split them against the patient's cover.

    Called on every edit while the quotation is a draft, and once more when it
    is sent — at which point the split is frozen, because a plan's annual
    maximum moves as the year is used and a quotation that recomputed itself
    would change the patient's number between being sent and being read.
    """
    subtotal = 0.0
    for li in q.line_items:
        li.amount = round((li.quantity or 0) * (li.unit_price or 0), 2)
        subtotal += li.amount

    q.subtotal = round(subtotal, 2)
    q.total = round(max(subtotal - (q.discount or 0.0), 0.0), 2)

    policy = active_policy_for(db, q.clinic_id, q.patient_id)
    # Estimated against the discounted total: the insurer pays a share of what
    # is actually charged, not of the list price.
    ratio = (q.total / subtotal) if subtotal > 0 else 1.0
    result = estimate_lines(
        [{"description": li.description,
          "amount": round(li.amount * ratio, 2),
          "benefit_category": li.benefit_category} for li in q.line_items],
        policy_to_dict(policy),
    )
    for li, est in zip(q.line_items, result["lines"]):
        li.insurance_estimate = est["insurance_estimate"]
        li.patient_portion = est["patient_portion"]

    q.insurance_estimate = result["insurance_estimate"]
    q.patient_portion = result["patient_portion"]
    q.insurance_snapshot = {
        "covered": result["covered"],
        "payer_name": policy.payer.name if policy and policy.payer else None,
        "policy_number": policy.policy_number if policy else None,
        "deductible_applied": result["deductible_applied"],
        "annual_max_reached": result["annual_max_reached"],
    }


def _serialize(q: Quotation) -> dict:
    return {
        "id": q.id,
        "quotation_number": q.quotation_number,
        "patient_id": q.patient_id,
        "patient_name": q.patient.name if q.patient else None,
        "patient_phone": q.patient.phone if q.patient else None,
        "status": q.status,
        "valid_until": q.valid_until.isoformat() if q.valid_until else None,
        "expired": bool(q.valid_until and q.valid_until < date.today()
                        and q.status in ("draft", "sent")),
        "notes": q.notes,
        "subtotal": q.subtotal, "discount": q.discount, "total": q.total,
        "insurance_estimate": q.insurance_estimate,
        "patient_portion": q.patient_portion,
        "insurance": q.insurance_snapshot or {},
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "sent_at": q.sent_at.isoformat() if q.sent_at else None,
        "responded_at": q.responded_at.isoformat() if q.responded_at else None,
        "converted_invoice_id": q.converted_invoice_id,
        "created_by_name": q.creator.name if q.creator else None,
        "line_items": [{
            "id": li.id, "description": li.description, "tooth_number": li.tooth_number,
            "benefit_category": li.benefit_category, "quantity": li.quantity,
            "unit_price": li.unit_price, "amount": li.amount,
            "insurance_estimate": li.insurance_estimate,
            "patient_portion": li.patient_portion,
        } for li in sorted(q.line_items, key=lambda x: (x.sort_order or 0, x.id or 0))],
    }


def _get(db: Session, qid: int, user: User) -> Quotation:
    q = db.query(Quotation).filter(
        Quotation.id == qid, Quotation.clinic_id == user.clinic_id).first()
    if not q:
        raise HTTPException(404, "Quotation not found")
    return q


@router.get("")
async def list_quotations(patient_id: Optional[int] = None, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    qs = db.query(Quotation).filter(Quotation.clinic_id == current_user.clinic_id)
    if patient_id:
        qs = qs.filter(Quotation.patient_id == patient_id)
    return [_serialize(q) for q in qs.order_by(desc(Quotation.id)).all()]


@router.get("/{quotation_id}")
async def get_quotation(quotation_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    return _serialize(_get(db, quotation_id, current_user))


@router.post("")
async def create_quotation(payload: QuotationDTO, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id,
        Patient.clinic_id == current_user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    q = Quotation(
        clinic_id=current_user.clinic_id,
        patient_id=payload.patient_id,
        quotation_number=_number(db, current_user.clinic_id),
        status="draft",
        valid_until=payload.valid_until or (date.today() + timedelta(days=DEFAULT_VALID_DAYS)),
        notes=payload.notes,
        discount=payload.discount or 0.0,
        created_by=current_user.id,
    )
    for i, l in enumerate(payload.lines):
        q.line_items.append(QuotationLineItem(
            description=l.description, tooth_number=l.tooth_number,
            benefit_category=normalise_category(l.benefit_category),
            quantity=l.quantity, unit_price=l.unit_price, sort_order=i))
    db.add(q)
    db.flush()
    _recalculate(db, q)
    db.commit()
    db.refresh(q)
    return _serialize(q)


@router.put("/{quotation_id}")
async def update_quotation(quotation_id: int, payload: QuotationDTO, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    q = _get(db, quotation_id, current_user)
    if q.status not in EDITABLE:
        raise HTTPException(400, "Only a draft quotation can be edited. Copy it to a new one instead.")

    q.valid_until = payload.valid_until or q.valid_until
    q.notes = payload.notes
    q.discount = payload.discount or 0.0
    q.line_items.clear()
    db.flush()
    for i, l in enumerate(payload.lines):
        q.line_items.append(QuotationLineItem(
            description=l.description, tooth_number=l.tooth_number,
            benefit_category=normalise_category(l.benefit_category),
            quantity=l.quantity, unit_price=l.unit_price, sort_order=i))
    db.flush()
    _recalculate(db, q)
    db.commit()
    db.refresh(q)
    return _serialize(q)


@router.post("/from-treatment-plan/{patient_id}")
async def from_treatment_plan(patient_id: int, db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    """Build a draft from what has already been planned on the chart.

    The treatment plan is where the clinic has already decided what the patient
    needs and what it costs; retyping it into a quotation is the step that stops
    quotations being sent at all. Only unfinished items come across — quoting for
    work already done is a bill, not a proposal.
    """
    patient = db.query(Patient).filter(
        Patient.id == patient_id, Patient.clinic_id == current_user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    plan = patient.treatment_plan or []
    if not isinstance(plan, list) or not plan:
        raise HTTPException(400, "This patient has no treatment plan to quote from.")

    # Benefit bands come from the catalogue where the procedure names match, so
    # a clinic that has categorised its treatments does not categorise again.
    bands = {t.name.strip().lower(): t.benefit_category
             for t in db.query(TreatmentType).filter(
                 TreatmentType.clinic_id == current_user.clinic_id).all()
             if t.name and t.benefit_category}

    lines = []
    for item in plan:
        if not isinstance(item, dict):
            continue
        if str(item.get("status", "")).lower() in ("done", "completed"):
            continue
        desc = (item.get("procedure") or "").strip()
        if not desc:
            continue
        lines.append(LineDTO(
            description=desc,
            tooth_number=str(item.get("tooth") or "") or None,
            benefit_category=bands.get(desc.lower()),
            quantity=float(item.get("qty") or 1),
            unit_price=float(item.get("cost") or 0),
        ))

    if not lines:
        raise HTTPException(400, "Every item on this treatment plan is already done.")

    return await create_quotation(
        QuotationDTO(patient_id=patient_id, lines=lines), db, current_user)


@router.post("/{quotation_id}/send")
async def mark_sent(quotation_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    q = _get(db, quotation_id, current_user)
    if q.status not in ("draft", "sent"):
        raise HTTPException(400, "This quotation has already been answered.")
    if not q.line_items:
        raise HTTPException(400, "Add at least one item before sending.")
    _recalculate(db, q)          # last recompute; the split is frozen from here
    q.status = "sent"
    q.sent_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return _serialize(q)


class RespondDTO(BaseModel):
    accepted: bool


@router.post("/{quotation_id}/respond")
async def respond(quotation_id: int, payload: RespondDTO, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    """Record the patient's answer. Recorded by staff, not the patient — this is
    what was said at the desk or on the phone, and nothing here bills anybody."""
    q = _get(db, quotation_id, current_user)
    if q.status not in ("draft", "sent"):
        raise HTTPException(400, "This quotation has already been answered.")
    q.status = "accepted" if payload.accepted else "declined"
    q.responded_at = datetime.utcnow()

    # Accepting is what turns a proposal into work the clinic will bill for, so
    # it raises the draft invoice here rather than leaving somebody to retype
    # the same lines. Draft, not finalised: the bill is issued when the work is
    # actually done, and a draft moves no money — verified, revenue and billed
    # are unchanged by one existing.
    if payload.accepted and not q.converted_invoice_id:
        inv = Invoice(
            clinic_id=q.clinic_id,
            patient_id=q.patient_id,
            invoice_number=generate_invoice_number(db, q.clinic_id),
            status="draft",
            notes=f"From quotation {q.quotation_number}" + (f" — {q.notes}" if q.notes else ""),
        )
        db.add(inv)
        db.flush()
        for li in sorted(q.line_items, key=lambda x: (x.sort_order or 0, x.id or 0)):
            db.add(InvoiceLineItem(
                invoice_id=inv.id,
                description=li.description,
                tooth_number=li.tooth_number,
                quantity=li.quantity,
                unit_price=li.unit_price,
                amount=li.amount,
            ))
        db.flush()
        recalculate_invoice_totals(db, inv)
        q.converted_invoice_id = inv.id

    db.commit()
    db.refresh(q)
    return _serialize(q)


@router.delete("/{quotation_id}")
async def delete_quotation(quotation_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    q = _get(db, quotation_id, current_user)
    if q.converted_invoice_id:
        raise HTTPException(400, "This quotation became an invoice and cannot be deleted.")
    db.delete(q)
    db.commit()
    return {"deleted": True}


def _pdf_bytes(db: Session, q: Quotation) -> bytes:
    clinic = db.query(Clinic).filter(Clinic.id == q.clinic_id).first()
    html = render_quotation(q, clinic, getattr(clinic, "currency_symbol", None) or "₹")
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@router.get("/{quotation_id}/pdf")
async def quotation_pdf(quotation_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    q = _get(db, quotation_id, current_user)
    return Response(
        content=_pdf_bytes(db, q),
        media_type="application/pdf",
        headers={"Content-Disposition":
                 f'attachment; filename="Quotation_{q.quotation_number or q.id}.pdf"'},
    )


class SendQuotationDTO(BaseModel):
    app_origin: Optional[str] = None


@router.post("/{quotation_id}/send-whatsapp")
async def send_quotation_whatsapp(quotation_id: int, payload: SendQuotationDTO = SendQuotationDTO(),
                                  db: Session = Depends(get_db),
                                  current_user: User = Depends(get_current_user)):
    """WhatsApp the estimate to the patient.

    Marks the quotation sent as a side effect, so the status cannot drift from
    what the patient actually received — the two used to be separate buttons and
    a clinic could message somebody while the record still said draft.
    """
    q = _get(db, quotation_id, current_user)
    if not q.line_items:
        raise HTTPException(400, "Add at least one item before sending.")
    if q.status not in ("draft", "sent"):
        raise HTTPException(400, "This quotation has already been answered.")
    if not q.patient or not q.patient.phone:
        raise HTTPException(400, "This patient has no phone number on file.")

    from models import NotificationPreference
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == current_user.clinic_id,
        NotificationPreference.event_type == "quotation_sent",
    ).first()
    if not pref or not pref.is_enabled:
        # Said plainly rather than answering "sent". notify_event returns
        # quietly with no preference row, and staff who believe a patient was
        # messaged stop chasing them.
        return {"sent": False, "reason": "not_configured",
                "message": "Quotation messages aren't switched on for this clinic. "
                           "Download the PDF and send it yourself."}

    clinic = db.query(Clinic).filter(Clinic.id == q.clinic_id).first()
    cur = getattr(clinic, "currency_symbol", None) or "₹"
    try:
        notify_event(
            "quotation_sent",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=q.patient.phone,
            to_name=q.patient.name,
            required=True,
            template_data={
                "patient_name": q.patient.name,
                "clinic_name": clinic.name if clinic else "",
                "quotation_number": q.quotation_number or "",
                # Pre-formatted with the clinic's own symbol: the builder prints
                # this verbatim, and a clinic in London must not quote rupees.
                "patient_portion": f"{cur}{float(q.patient_portion or 0):,.2f}",
                "valid_until": q.valid_until.strftime("%d %B %Y") if q.valid_until else "",
                "clinic_phone": getattr(clinic, "phone", "") or "",
            },
        )
    except InsufficientWalletBalance:
        raise

    if q.status == "draft":
        _recalculate(db, q)
        q.status = "sent"
        q.sent_at = datetime.utcnow()
        db.commit()
        db.refresh(q)
    return {"sent": True, "quotation": _serialize(q)}
