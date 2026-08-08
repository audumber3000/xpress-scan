"""Offers & Discounts — a clinic-defined catalogue of reusable whole-invoice
discounts, managed in Control Center → Offers and applied at billing time.

Applying an offer just resolves to an invoice discount (value + type), so it
flows through the existing invoice totals math (`recalculate_invoice_totals`).
No invoice schema change: the invoice keeps storing discount + discount_type.
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Offer, User
from core.auth_utils import get_current_user, require_clinic_owner

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────
class OfferBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    discount_type: str = Field("percentage", pattern="^(amount|percentage)$")
    value: float = Field(..., ge=0)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    min_invoice_amount: Optional[float] = Field(None, ge=0)
    is_active: bool = True


class OfferCreate(OfferBase):
    pass


class OfferUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    code: Optional[str] = Field(None, max_length=40)
    discount_type: Optional[str] = Field(None, pattern="^(amount|percentage)$")
    value: Optional[float] = Field(None, ge=0)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    min_invoice_amount: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class OfferOut(OfferBase):
    id: int
    clinic_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ValidateRequest(BaseModel):
    offer_id: int
    subtotal: float = Field(0, ge=0)


class ValidateResponse(BaseModel):
    valid: bool
    discount: float = 0.0          # value to store on the invoice (as typed)
    discount_type: str = "amount"
    discount_amount: float = 0.0   # resolved currency deduction for this subtotal
    reason: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────
def _is_live(offer: Offer, today: date) -> bool:
    """True when the offer is active and today falls within its date window."""
    if not offer.is_active:
        return False
    if offer.valid_from and today < offer.valid_from:
        return False
    if offer.valid_to and today > offer.valid_to:
        return False
    return True


def _resolved_amount(offer: Offer, subtotal: float) -> float:
    """Currency deduction this offer yields on `subtotal`, capped at subtotal."""
    if offer.discount_type == "percentage":
        amt = subtotal * (offer.value / 100.0)
    else:
        amt = offer.value
    return min(amt, subtotal) if subtotal else amt


# ── Routes ───────────────────────────────────────────────────────────────────
@router.get("", response_model=List[OfferOut])
def list_offers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    """All offers for the clinic (owner view — includes inactive/expired)."""
    return (
        db.query(Offer)
        .filter(Offer.clinic_id == current_user.clinic_id)
        .order_by(Offer.created_at.desc())
        .all()
    )


@router.get("/active", response_model=List[OfferOut])
def list_active_offers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Offers valid today — what billing shows in the 'Apply offer' dropdown.
    Available to any biller, not just the owner."""
    today = date.today()
    offers = (
        db.query(Offer)
        .filter(Offer.clinic_id == current_user.clinic_id, Offer.is_active == True)
        .order_by(Offer.created_at.desc())
        .all()
    )
    return [o for o in offers if _is_live(o, today)]


@router.post("", response_model=OfferOut, status_code=201)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    if payload.discount_type == "percentage" and payload.value > 100:
        raise HTTPException(status_code=400, detail="A percentage offer can't exceed 100%.")
    if payload.valid_from and payload.valid_to and payload.valid_to < payload.valid_from:
        raise HTTPException(status_code=400, detail="'Valid to' can't be before 'valid from'.")
    offer = Offer(
        **payload.model_dump(),
        clinic_id=current_user.clinic_id,
        created_by=current_user.id,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.put("/{offer_id}", response_model=OfferOut)
def update_offer(
    offer_id: int,
    payload: OfferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    offer = db.query(Offer).filter(
        Offer.id == offer_id, Offer.clinic_id == current_user.clinic_id
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    data = payload.model_dump(exclude_unset=True)
    dtype = data.get("discount_type", offer.discount_type)
    dval = data.get("value", offer.value)
    if dtype == "percentage" and dval is not None and dval > 100:
        raise HTTPException(status_code=400, detail="A percentage offer can't exceed 100%.")
    vf = data.get("valid_from", offer.valid_from)
    vt = data.get("valid_to", offer.valid_to)
    if vf and vt and vt < vf:
        raise HTTPException(status_code=400, detail="'Valid to' can't be before 'valid from'.")
    for k, v in data.items():
        setattr(offer, k, v)
    db.commit()
    db.refresh(offer)
    return offer


@router.delete("/{offer_id}", status_code=204)
def delete_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinic_owner),
):
    offer = db.query(Offer).filter(
        Offer.id == offer_id, Offer.clinic_id == current_user.clinic_id
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    db.delete(offer)
    db.commit()
    return None


@router.post("/validate", response_model=ValidateResponse)
def validate_offer(
    payload: ValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an offer against an invoice subtotal at apply-time — the billing
    UI calls this before setting the invoice's discount fields, so an expired
    offer or an unmet minimum is rejected server-side."""
    offer = db.query(Offer).filter(
        Offer.id == payload.offer_id, Offer.clinic_id == current_user.clinic_id
    ).first()
    if not offer:
        return ValidateResponse(valid=False, reason="Offer not found")
    if not _is_live(offer, date.today()):
        return ValidateResponse(valid=False, reason="This offer is not active today.")
    if offer.min_invoice_amount and payload.subtotal < offer.min_invoice_amount:
        return ValidateResponse(
            valid=False,
            reason=f"Applies only on bills of {offer.min_invoice_amount:.0f} or more.",
        )
    return ValidateResponse(
        valid=True,
        discount=offer.value,
        discount_type=offer.discount_type,
        discount_amount=_resolved_amount(offer, payload.subtotal),
    )
