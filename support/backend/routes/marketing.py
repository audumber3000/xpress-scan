from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from database import get_db
from models import User, SubscriptionCoupon, ReferralCode, Clinic, GrowthLead, MarketingCampaign, PushToken
from .auth import get_current_admin
from services.notification_service import notification_service
from services.marketing_template_registry import (
    get_bulk_whatsapp_template,
    list_bulk_whatsapp_templates,
)
import string
import random
import re
import datetime

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
    header_image_url: Optional[str] = None  # Required when the chosen WhatsApp template has an image header

class BulkMessageLeads(BaseModel):
    template_name: str
    stages: Optional[List[str]] = None        # filter by lead.stage; None = all
    sources: Optional[List[str]] = None       # filter by lead.source; None = all
    header_image_url: Optional[str] = None

class BulkMessageNumbers(BaseModel):
    template_name: str
    numbers: List[str]                        # raw numbers, any format
    header_image_url: Optional[str] = None

class TestMessage(BaseModel):
    template_name: str
    phone: str
    header_image_url: Optional[str] = None


class BulkPushMessage(BaseModel):
    title: str
    body: str
    target_criteria: str  # 'all', 'trial', 'active', 'suspended'
    screen_target: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class TestPushMessage(BaseModel):
    title: str
    body: str
    phone: str
    screen_target: Optional[str] = None



def _normalize_indian_mobile(raw: Optional[str]) -> Optional[str]:
    """Return a 12-digit MSG91-ready Indian mobile number ("91XXXXXXXXXX")
    or None if the input clearly isn't a valid 10-digit Indian number.

    Replaces a buggy `lstrip('0+91')` call that stripped any of the
    characters {0, +, 9, 1} from the left — e.g. "9876543210" became
    "876543210" → "91876543210" (11 digits, invalid).
    """
    if not raw:
        return None
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if not digits:
        return None
    # Drop a leading 91 country code (covers "+91...", "0091...", "91...")
    if digits.startswith("91") and len(digits) > 10:
        digits = digits[2:]
    # Drop a leading 0 STD prefix
    if digits.startswith("0") and len(digits) > 10:
        digits = digits.lstrip("0")
    if len(digits) != 10:
        return None
    return f"91{digits}"


def _parse_phone_blob(raw: str) -> Dict[str, Any]:
    """Split a paste of phone numbers (newline / comma / space / ; separated)
    into normalized + invalid + duplicate buckets. Currently India-only via
    MSG91; revisit when we onboard non-IN clinics on a different gateway."""
    if not raw:
        return {"valid": [], "invalid": [], "duplicates": [], "total_pasted": 0}
    tokens = [t.strip() for t in re.split(r"[\s,;]+", raw) if t.strip()]
    seen = set()
    valid: List[str] = []
    invalid: List[str] = []
    duplicates: List[str] = []
    for t in tokens:
        norm = _normalize_indian_mobile(t)
        if not norm:
            invalid.append(t)
            continue
        if norm in seen:
            duplicates.append(t)
            continue
        seen.add(norm)
        valid.append(norm)
    return {
        "valid": valid,
        "invalid": invalid,
        "duplicates": duplicates,
        "total_pasted": len(tokens),
    }


def _admin_email(current_user: User) -> Optional[str]:
    return getattr(current_user, "email", None) or getattr(current_user, "username", None)


def _log_campaign(
    db: Session,
    *,
    channel: str,
    template_name: Optional[str],
    subject: Optional[str],
    target_kind: str,
    target_filter: Optional[Dict[str, Any]],
    total: int,
    sent: int,
    failed: int,
    skipped: int,
    errors: List[str],
    sent_by: Optional[str],
):
    """Insert a row into marketing_campaigns. Errors capped to 50 entries
    so a 1000-recipient blast doesn't bloat the row."""
    record = MarketingCampaign(
        channel=channel,
        template_name=template_name,
        subject=subject,
        target_kind=target_kind,
        target_filter=target_filter,
        total_recipients=total,
        sent_count=sent,
        failed_count=failed,
        skipped_count=skipped,
        errors_summary=errors[:50] if errors else None,
        sent_by=sent_by,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    return record

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

    template: Optional[Dict[str, Any]] = None
    if data.channel == "whatsapp":
        if not data.template_name:
            raise HTTPException(status_code=400, detail="template_name is required for WhatsApp campaigns")
        template = get_bulk_whatsapp_template(data.template_name)
        if not template:
            raise HTTPException(status_code=400, detail="Unknown or inactive WhatsApp bulk template")
        # If the template carries an IMAGE header on the MSG91 side, the admin
        # must supply a public URL — MSG91 will reject otherwise.
        if template.get("requires_image") and not (data.header_image_url or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Template '{data.template_name}' requires a header image URL",
            )

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
    skipped = 0
    errors = []

    for clinic in clinics:
        if data.channel == 'whatsapp':
            mobile = _normalize_indian_mobile(clinic.phone)
            if not mobile:
                skipped += 1
                errors.append(f"Skipped {clinic.name}: missing or invalid phone ({clinic.phone!r})")
                continue
            res = await notification_service.send_whatsapp(
                mobile_number=mobile,
                template_name=data.template_name or "molarplus_update",
                parameters=[],
                header_image_url=(data.header_image_url or "").strip() or None,
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

    failed = len(clinics) - count - skipped
    _log_campaign(
        db,
        channel=data.channel,
        template_name=data.template_name,
        subject=data.subject,
        target_kind="clinics",
        target_filter={"target_criteria": data.target_criteria},
        total=len(clinics),
        sent=count,
        failed=max(failed, 0),
        skipped=skipped,
        errors=errors,
        sent_by=_admin_email(current_user),
    )

    return {
        "success": True,
        "sent_count": count,
        "total_attempted": len(clinics),
        "template_name": data.template_name,
        "errors": errors
    }


# --- Send to Growth Leads ---
@router.post("/bulk-message-leads")
async def send_bulk_to_leads(
    data: BulkMessageLeads,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    template = get_bulk_whatsapp_template(data.template_name)
    if not template:
        raise HTTPException(status_code=400, detail="Unknown or inactive WhatsApp bulk template")
    if template.get("requires_image") and not (data.header_image_url or "").strip():
        raise HTTPException(
            status_code=400,
            detail=f"Template '{data.template_name}' requires a header image URL",
        )

    query = db.query(GrowthLead)
    if data.stages:
        query = query.filter(GrowthLead.stage.in_(data.stages))
    if data.sources:
        query = query.filter(GrowthLead.source.in_(data.sources))
    leads = query.all()

    sent = 0
    skipped = 0
    errors: List[str] = []
    seen_numbers: set = set()

    for lead in leads:
        mobile = _normalize_indian_mobile(lead.phone)
        if not mobile:
            skipped += 1
            errors.append(f"Skipped {lead.lead_name}: invalid phone ({lead.phone!r})")
            continue
        if mobile in seen_numbers:
            skipped += 1
            continue
        seen_numbers.add(mobile)
        res = await notification_service.send_whatsapp(
            mobile_number=mobile,
            template_name=data.template_name,
            parameters=[],
            header_image_url=(data.header_image_url or "").strip() or None,
        )
        if res.get("success"):
            sent += 1
        else:
            errors.append(f"Failed {lead.lead_name}: {res.get('error')}")

    failed = len(leads) - sent - skipped
    _log_campaign(
        db,
        channel="whatsapp",
        template_name=data.template_name,
        subject=None,
        target_kind="leads",
        target_filter={"stages": data.stages, "sources": data.sources},
        total=len(leads),
        sent=sent,
        failed=max(failed, 0),
        skipped=skipped,
        errors=errors,
        sent_by=_admin_email(current_user),
    )
    return {
        "success": True,
        "sent_count": sent,
        "total_attempted": len(leads),
        "skipped": skipped,
        "template_name": data.template_name,
        "errors": errors,
    }


# --- Send to a raw list of phone numbers ---
@router.post("/bulk-message-numbers/preview")
def preview_phone_blob(payload: Dict[str, str], _=Depends(get_current_admin)):
    """Live preview as the admin types — counts valid / invalid / duplicates
    so they know exactly what they're about to broadcast to."""
    raw = payload.get("raw") or ""
    parsed = _parse_phone_blob(raw)
    return {
        "total_pasted": parsed["total_pasted"],
        "valid_count": len(parsed["valid"]),
        "invalid_count": len(parsed["invalid"]),
        "duplicate_count": len(parsed["duplicates"]),
        "preview_valid": parsed["valid"][:5],
        "preview_invalid": parsed["invalid"][:5],
    }


@router.post("/bulk-message-numbers")
async def send_bulk_to_numbers(
    data: BulkMessageNumbers,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    template = get_bulk_whatsapp_template(data.template_name)
    if not template:
        raise HTTPException(status_code=400, detail="Unknown or inactive WhatsApp bulk template")
    if template.get("requires_image") and not (data.header_image_url or "").strip():
        raise HTTPException(
            status_code=400,
            detail=f"Template '{data.template_name}' requires a header image URL",
        )

    parsed = _parse_phone_blob("\n".join(data.numbers or []))
    valid = parsed["valid"]

    sent = 0
    errors: List[str] = []
    for mobile in valid:
        res = await notification_service.send_whatsapp(
            mobile_number=mobile,
            template_name=data.template_name,
            parameters=[],
            header_image_url=(data.header_image_url or "").strip() or None,
        )
        if res.get("success"):
            sent += 1
        else:
            errors.append(f"Failed {mobile}: {res.get('error')}")

    skipped = parsed["total_pasted"] - len(valid)
    failed = len(valid) - sent
    _log_campaign(
        db,
        channel="whatsapp",
        template_name=data.template_name,
        subject=None,
        target_kind="numbers",
        target_filter={
            "total_pasted": parsed["total_pasted"],
            "invalid_count": len(parsed["invalid"]),
            "duplicate_count": len(parsed["duplicates"]),
        },
        total=parsed["total_pasted"],
        sent=sent,
        failed=max(failed, 0),
        skipped=skipped,
        errors=errors,
        sent_by=_admin_email(current_user),
    )
    return {
        "success": True,
        "sent_count": sent,
        "total_pasted": parsed["total_pasted"],
        "valid_count": len(valid),
        "invalid_count": len(parsed["invalid"]),
        "duplicate_count": len(parsed["duplicates"]),
        "errors": errors,
    }


# --- Single test send (verify a template renders before broadcasting) ---
@router.post("/test-message")
async def send_test_message(
    data: TestMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    template = get_bulk_whatsapp_template(data.template_name)
    if not template:
        raise HTTPException(status_code=400, detail="Unknown or inactive WhatsApp bulk template")
    mobile = _normalize_indian_mobile(data.phone)
    if not mobile:
        raise HTTPException(status_code=400, detail=f"Invalid phone: {data.phone!r}")

    res = await notification_service.send_whatsapp(
        mobile_number=mobile,
        template_name=data.template_name,
        parameters=[],
        header_image_url=(data.header_image_url or "").strip() or None,
    )
    _log_campaign(
        db,
        channel="whatsapp",
        template_name=data.template_name,
        subject=None,
        target_kind="test",
        target_filter={"phone": mobile},
        total=1,
        sent=1 if res.get("success") else 0,
        failed=0 if res.get("success") else 1,
        skipped=0,
        errors=[] if res.get("success") else [str(res.get("error"))],
        sent_by=_admin_email(current_user),
    )
    if not res.get("success"):
        raise HTTPException(status_code=502, detail=f"Send failed: {res.get('error')}")
    return {"success": True, "phone": mobile}


# --- Campaign history ---
@router.get("/campaigns")
def list_campaigns(
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    rows = (
        db.query(MarketingCampaign)
        .order_by(MarketingCampaign.created_at.desc())
        .limit(min(max(limit, 1), 200))
        .all()
    )
    return [
        {
            "id": r.id,
            "channel": r.channel,
            "template_name": r.template_name,
            "subject": r.subject,
            "target_kind": r.target_kind,
            "target_filter": r.target_filter,
            "total_recipients": r.total_recipients,
            "sent_count": r.sent_count,
            "failed_count": r.failed_count,
            "skipped_count": r.skipped_count,
            "errors_summary": r.errors_summary,
            "sent_by": r.sent_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# --- Lead filter options (stages / sources we have leads for) ---
@router.get("/leads/options")
def lead_filter_options(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    """Distinct stages + sources currently in the leads table — drives
    the multi-select dropdowns on the 'To Leads' campaigns tab."""
    stages = [s for (s,) in db.query(GrowthLead.stage).distinct().all() if s]
    sources = [s for (s,) in db.query(GrowthLead.source).distinct().all() if s]
    counts = (
        db.query(GrowthLead.stage, GrowthLead.source)
        .all()
    )
    by_stage: Dict[str, int] = {}
    by_source: Dict[str, int] = {}
    for stage, source in counts:
        if stage:
            by_stage[stage] = by_stage.get(stage, 0) + 1
        if source:
            by_source[source] = by_source.get(source, 0) + 1
    return {
        "stages": sorted(stages),
        "sources": sorted(sources),
        "by_stage": by_stage,
        "by_source": by_source,
        "total_leads": db.query(GrowthLead).count(),
    }


@router.post("/leads/preview")
def preview_lead_targets(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    """Given the same filters the admin will use to broadcast, return
    valid / invalid / duplicate counts so they see what they're committing to."""
    stages = payload.get("stages") or None
    sources = payload.get("sources") or None
    query = db.query(GrowthLead)
    if stages:
        query = query.filter(GrowthLead.stage.in_(stages))
    if sources:
        query = query.filter(GrowthLead.source.in_(sources))
    leads = query.all()

    valid: set = set()
    invalid_count = 0
    duplicate_count = 0
    sample = []
    for lead in leads:
        norm = _normalize_indian_mobile(lead.phone)
        if not norm:
            invalid_count += 1
            continue
        if norm in valid:
            duplicate_count += 1
            continue
        valid.add(norm)
        if len(sample) < 5:
            sample.append({"name": lead.lead_name, "phone": norm, "stage": lead.stage})
    return {
        "total_leads": len(leads),
        "valid_count": len(valid),
        "invalid_count": invalid_count,
        "duplicate_count": duplicate_count,
        "preview": sample,
    }


# --- Push Notification Campaign Endpoints ---

@router.get("/push/options")
def get_push_options(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    """Get counts of active push tokens grouped by target criteria: all, active, trial, suspended."""
    base_query = db.query(PushToken).filter(PushToken.is_active == True)
    
    # total push tokens connected to a valid clinic
    total = base_query.join(Clinic, PushToken.clinic_id == Clinic.id).count()
    
    # 'trial' target (clinic.subscription_plan == 'free')
    trial = base_query.join(Clinic, PushToken.clinic_id == Clinic.id).filter(Clinic.subscription_plan == 'free').count()
    
    # 'active' target (clinic.status == 'active')
    active = base_query.join(Clinic, PushToken.clinic_id == Clinic.id).filter(Clinic.status == 'active').count()
    
    # 'suspended' target (clinic.status == 'suspended')
    suspended = base_query.join(Clinic, PushToken.clinic_id == Clinic.id).filter(Clinic.status == 'suspended').count()
    
    return {
        "total_devices": total,
        "active_devices": active,
        "trial_devices": trial,
        "suspended_devices": suspended
    }


@router.post("/push/preview")
def preview_push_targets(
    payload: Dict[str, str],
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    """Return count of active devices and sample clinic/user preview based on target criteria."""
    criteria = payload.get("target_criteria", "all")
    query = db.query(PushToken).join(Clinic, PushToken.clinic_id == Clinic.id).filter(PushToken.is_active == True)
    
    if criteria == 'trial':
        query = query.filter(Clinic.subscription_plan == 'free')
    elif criteria in ('active', 'suspended'):
        query = query.filter(Clinic.status == criteria)
        
    tokens = query.all()
    
    sample = []
    seen_clinics = set()
    for t in tokens:
        clinic_name = t.clinic.name if t.clinic else "Unknown Clinic"
        if clinic_name not in seen_clinics and len(sample) < 5:
            seen_clinics.add(clinic_name)
            sample.append({
                "clinic_name": clinic_name,
                "platform": t.platform,
                "user_name": t.user.name if t.user else "Unknown User"
            })
            
    return {
        "total_devices": len(tokens),
        "preview": sample
    }


@router.post("/push/test")
async def send_test_push(
    data: TestPushMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Send a test push notification to a specific user's active devices resolved by phone number."""
    norm_phone = _normalize_indian_mobile(data.phone)
    target_user = None
    
    # Resolve the user from standard inputs
    if norm_phone:
        target_user = db.query(User).filter(User.username == norm_phone).first()
        if not target_user:
            target_user = db.query(User).filter(User.username.like(f"%{norm_phone}%")).first()
            
    if not target_user:
        target_user = db.query(User).filter(User.username == data.phone.strip()).first()
        
    if not target_user and norm_phone:
        # Fallback to clinic phone search
        clinic = db.query(Clinic).filter(Clinic.phone == norm_phone).first()
        if clinic:
            target_user = db.query(User).filter(User.clinic_id == clinic.id).first()
            
    if not target_user:
        raise HTTPException(status_code=404, detail=f"No user found registered with phone {data.phone}")
        
    tokens = db.query(PushToken).filter(PushToken.user_id == target_user.id, PushToken.is_active == True).all()
    if not tokens:
        raise HTTPException(status_code=400, detail="No active device tokens found for this user")
        
    token_strings = [t.token for t in tokens]
    
    payload_data = {}
    if data.screen_target and data.screen_target != "none":
        payload_data["screen"] = data.screen_target
        
    res = await notification_service.send_bulk_push(
        tokens=token_strings,
        title=data.title,
        body=data.body,
        data=payload_data
    )
    
    _log_campaign(
        db,
        channel="push",
        template_name="test_push",
        subject=data.title,
        target_kind="test",
        target_filter={"phone": data.phone, "screen_target": data.screen_target},
        total=len(token_strings),
        sent=res.get("sent", 0),
        failed=len(res.get("errors", [])),
        skipped=0,
        errors=res.get("errors", []),
        sent_by=_admin_email(current_user),
    )
    
    if res.get("sent", 0) == 0:
        raise HTTPException(status_code=502, detail=f"Failed to send test: {', '.join(res.get('errors', []))}")
        
    return {"success": True, "sent_count": res.get("sent", 0), "devices": len(token_strings)}


@router.post("/bulk-push")
async def send_bulk_push_campaign(
    data: BulkPushMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Broadcast bulk push notification to all active devices matching target criteria."""
    query = db.query(PushToken).join(Clinic, PushToken.clinic_id == Clinic.id).filter(PushToken.is_active == True)
    
    if data.target_criteria == 'trial':
        query = query.filter(Clinic.subscription_plan == 'free')
    elif data.target_criteria in ('active', 'suspended'):
        query = query.filter(Clinic.status == data.target_criteria)
        
    tokens = query.all()
    if not tokens:
        raise HTTPException(status_code=400, detail="No active device tokens found matching targeting criteria")
        
    token_strings = [t.token for t in tokens]
    
    payload_data = {}
    if data.screen_target and data.screen_target != "none":
        payload_data["screen"] = data.screen_target
    if data.custom_data:
        payload_data.update(data.custom_data)
        
    res = await notification_service.send_bulk_push(
        tokens=token_strings,
        title=data.title,
        body=data.body,
        data=payload_data
    )
    
    _log_campaign(
        db,
        channel="push",
        template_name=None,
        subject=data.title,
        target_kind="push",
        target_filter={
            "target_criteria": data.target_criteria,
            "screen_target": data.screen_target,
            "custom_data": data.custom_data
        },
        total=len(token_strings),
        sent=res.get("sent", 0),
        failed=len(res.get("errors", [])),
        skipped=0,
        errors=res.get("errors", []),
        sent_by=_admin_email(current_user),
    )
    
    return {
        "success": True,
        "sent_count": res.get("sent", 0),
        "total_attempted": len(token_strings),
        "errors": res.get("errors", [])
    }

