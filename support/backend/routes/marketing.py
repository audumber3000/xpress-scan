from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from database import get_db
from models import User, SubscriptionCoupon, ReferralCode, Clinic
from .auth import get_current_admin
from services.notification_service import notification_service
from services.marketing_template_registry import (
    get_bulk_whatsapp_template,
    list_bulk_whatsapp_templates,
)
import string
import random

router = APIRouter()

# --- Pydantic Models ---
class PromoCreate(BaseModel):
    code: str
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    expiry_date: Optional[str] = None
    usage_limit: int = 100
    is_active: bool = True

class PromoUpdate(BaseModel):
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    expiry_date: Optional[str] = None
    usage_limit: Optional[int] = None
    is_active: Optional[bool] = None

class ReferralCreate(BaseModel):
    code: Optional[str] = None  # If none, auto-generate
    creator_name: str
    discount_percent: Optional[float] = None
    reward_details: Optional[Dict[str, Any]] = None
    is_active: bool = True

class ReferralUpdate(BaseModel):
    creator_name: Optional[str] = None
    discount_percent: Optional[float] = None
    reward_details: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class BulkMessage(BaseModel):
    channel: str # 'whatsapp' or 'email'
    subject: Optional[str] = None # For email
    template_name: Optional[str] = None # For whatsapp
    message_body: Optional[str] = None
    target_criteria: str # 'all', 'trial', 'active', 'suspended'

def generate_ref_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

def _promo_dict(p):
    return {
        "id": p.id,
        "code": p.code,
        "discount_percent": p.discount_percent,
        "discount_amount": p.discount_amount,
        "is_active": p.is_active,
        "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
        "usage_limit": p.usage_limit,
        "used_count": p.used_count,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# --- Promocode Endpoints ---
@router.get("/promocodes")
def list_promocodes(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    return [_promo_dict(p) for p in db.query(SubscriptionCoupon).order_by(SubscriptionCoupon.created_at.desc()).all()]

@router.post("/promocodes")
def create_promocode(data: PromoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    existing = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Promocode already exists")

    import datetime as dt
    expiry = None
    if data.expiry_date:
        try:
            expiry = dt.datetime.fromisoformat(data.expiry_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expiry_date format")

    promo = SubscriptionCoupon(
        code=data.code.upper(),
        discount_percent=data.discount_percent,
        discount_amount=data.discount_amount,
        usage_limit=data.usage_limit,
        expiry_date=expiry,
        is_active=data.is_active,
        used_count=0,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return _promo_dict(promo)

@router.patch("/promocodes/{promo_id}")
def toggle_promocode(promo_id: int, data: PromoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    promo = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promocode not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(promo, key, val)
    db.commit()
    return _promo_dict(promo)

@router.put("/promocodes/{promo_id}")
def update_promocode(promo_id: int, data: PromoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    promo = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promocode not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(promo, key, val)
    db.commit()
    return _promo_dict(promo)

@router.delete("/promocodes/{promo_id}")
def delete_promocode(promo_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    promo = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promocode not found")
    
    db.delete(promo)
    db.commit()
    return {"success": True}

def _ref_dict(r, signup_count=None):
    return {
        "id": r.id,
        "code": r.code,
        "creator_name": r.creator_name,
        "discount_percent": r.discount_percent,
        "is_active": r.is_active,
        "signup_count": signup_count if signup_count is not None else r.usage_count,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# --- Referral Manager Endpoints ---
@router.get("/referrals")
def list_referrals(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    referrals = db.query(ReferralCode).order_by(ReferralCode.created_at.desc()).all()
    result = []
    for r in referrals:
        signup_count = db.query(Clinic).filter(Clinic.referred_by_code == r.code).count()
        result.append(_ref_dict(r, signup_count))
    return result

@router.post("/referrals")
def create_referral(data: ReferralCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    code = (data.code or "").upper().strip() or generate_ref_code()

    existing = db.query(ReferralCode).filter(ReferralCode.code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Referral code already exists")

    ref = ReferralCode(
        code=code,
        creator_name=data.creator_name,
        discount_percent=data.discount_percent,
        reward_details=data.reward_details,
        is_active=data.is_active,
        usage_count=0,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return _ref_dict(ref, 0)

@router.patch("/referrals/{ref_id}")
def toggle_referral(ref_id: int, data: ReferralUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    ref = db.query(ReferralCode).filter(ReferralCode.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(ref, key, val)
    db.commit()
    signup_count = db.query(Clinic).filter(Clinic.referred_by_code == ref.code).count()
    return _ref_dict(ref, signup_count)

@router.put("/referrals/{ref_id}")
def update_referral(ref_id: int, data: ReferralUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    ref = db.query(ReferralCode).filter(ReferralCode.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(ref, key, val)
    db.commit()
    signup_count = db.query(Clinic).filter(Clinic.referred_by_code == ref.code).count()
    return _ref_dict(ref, signup_count)

@router.delete("/referrals/{ref_id}")
def delete_referral(ref_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    ref = db.query(ReferralCode).filter(ReferralCode.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    db.delete(ref)
    db.commit()
    return {"success": True}

@router.get("/whatsapp-templates")
def list_whatsapp_templates(current_user: User = Depends(get_current_admin)):
    return list_bulk_whatsapp_templates()

# --- Bulk Messaging Endpoint ---
@router.post("/bulk-message")
async def send_bulk_message(data: BulkMessage, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    if data.channel not in {"whatsapp", "email"}:
        raise HTTPException(status_code=400, detail="Unsupported channel")

    if data.channel == "whatsapp":
        if not data.template_name:
            raise HTTPException(status_code=400, detail="template_name is required for WhatsApp campaigns")
        template = get_bulk_whatsapp_template(data.template_name)
        if not template:
            raise HTTPException(status_code=400, detail="Unknown or inactive WhatsApp bulk template")

    if data.channel == "email" and not data.message_body:
        raise HTTPException(status_code=400, detail="message_body is required for email campaigns")

    query = db.query(Clinic)
    
    if data.target_criteria != 'all':
        if data.target_criteria == 'trial':
            query = query.filter(Clinic.subscription_plan == 'free')
        else:
            query = query.filter(Clinic.status == data.target_criteria)
            
    clinics = query.all()
    count = 0
    errors = []
    
    for clinic in clinics:
        if data.channel == 'whatsapp' and clinic.phone:
            res = await notification_service.send_whatsapp(
                mobile_number=f"91{clinic.phone.lstrip('0+91')}", 
                template_name=data.template_name or "molarplus_update",
                parameters=[] # Bulk whatsapp triggers typically don't require dynamic body parameters that UI provides for now
            )
            if res.get("success"):
                count += 1
            else:
                errors.append(f"Failed to WA {clinic.name}: {res.get('error')}")
                
        elif data.channel == 'email' and clinic.email:
            # Wrap message in basic HTML template
            html = f"<html><body><p>Hello {clinic.name},</p><p>{data.message_body.replace(chr(10), '<br>')}</p></body></html>"
            res = await notification_service.send_email(
                to_email=clinic.email,
                subject=data.subject or "Important Update from MolarPlus",
                html_content=html,
                to_name=clinic.name
            )
            if res.get("success"):
                count += 1
            else:
                errors.append(f"Failed to Email {clinic.name}: {res.get('error')}")
                
    return {
        "success": True,
        "sent_count": count,
        "total_attempted": len(clinics),
        "template_name": data.template_name,
        "errors": errors
    }
