import os
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from database import SessionLocal, get_db
from models import Subscription, Clinic, User
from schemas import SubscriptionOut, SubscriptionCreate, SubscriptionUpdate, CouponValidateRequest, CheckoutRequest
from core.auth_utils import get_current_user
from domains.clinic.services.subscription_service import SubscriptionService

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()

@router.get("/plans")
async def get_available_plans():
    """Get available subscription plans"""
    plans = [
        {
            "name": "free",
            "display_name": "Free Plan",
            "price": 0,
            "currency": "INR",
            "interval": "month",
            "features": [
                "Basic dental charting",
                "Patient management",
                "Simple reporting",
                "Google Reviews"
            ]
        },
        {
            "name": "professional",
            "display_name": "Professional Plan",
            "price": 899,
            "annual_price": 8100,
            "annual_monthly_equivalent": 675,
            "currency": "INR",
            "interval": "month",
            "features": [
                "Unlimited patients",
                "Advanced dental analytics",
                "WhatsApp notifications",
                "Multi-clinic support",
                "Priority support"
            ]
        }
    ]
    return {"plans": plans}

@router.get("", response_model=SubscriptionOut)
async def get_current_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current subscription for the user/owner"""
    # Check for subscription by user_id first (Global Owner Subscription)
    subscription = db.query(Subscription).filter(
        Subscription.user_id == current_user.id
    ).first()
    
    # Fallback to clinic_id (Legacy or if user_id wasn't set)
    if not subscription and current_user.clinic_id:
        subscription = db.query(Subscription).filter(
            Subscription.clinic_id == current_user.clinic_id
        ).first()
    
    if not subscription:
        # Return default free subscription
        clinic_plan = "free"
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            clinic_plan = clinic.subscription_plan if clinic else "free"
            
        return SubscriptionOut(
            id=0,
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            plan_name=clinic_plan,
            status="active",
            provider="none",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    # Annotate with expiry info for frontend renew UI
    now = datetime.utcnow()
    is_expired = (
        subscription.current_end is not None
        and subscription.current_end < now
        and subscription.status != "active"
    )
    result = {
        "id": subscription.id,
        "clinic_id": subscription.clinic_id,
        "user_id": subscription.user_id,
        "plan_name": subscription.plan_name,
        "status": subscription.status,
        "provider": subscription.provider,
        "provider_order_id": subscription.provider_order_id,
        "current_start": subscription.current_start.isoformat() if subscription.current_start else None,
        "current_end": subscription.current_end.isoformat() if subscription.current_end else None,
        "is_expired": is_expired,
        "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
        "updated_at": subscription.updated_at.isoformat() if subscription.updated_at else None,
    }
    return result

@router.get("/history")
async def get_billing_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return billing history for the current user."""
    from models import SubscriptionPayment

    PLAN_LABELS = {
        "professional": "Professional — Monthly",
        "professional_annual": "Professional — Annual",
    }

    # Real payment records
    payments = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.user_id == current_user.id
    ).order_by(SubscriptionPayment.paid_at.desc()).all()

    # Fallback: if no records yet (pre-migration users), synthesise from subscription row
    if not payments and current_user.clinic_id:
        payments = db.query(SubscriptionPayment).filter(
            SubscriptionPayment.clinic_id == current_user.clinic_id
        ).order_by(SubscriptionPayment.paid_at.desc()).all()

    if payments:
        history = [
            {
                "id": p.id,
                "invoice": f"INV-{p.provider_order_id or p.id}",
                "plan": PLAN_LABELS.get(p.plan_name, p.plan_name.title()),
                "amount": p.amount,
                "date": (p.paid_at or p.created_at).strftime("%-d %b %Y"),
                "status": p.status.upper(),
            }
            for p in payments
        ]
        return {"history": history}

    # Last resort fallback for users who paid before this table existed
    subscription = db.query(Subscription).filter(
        Subscription.user_id == current_user.id
    ).first()
    if not subscription and current_user.clinic_id:
        subscription = db.query(Subscription).filter(
            Subscription.clinic_id == current_user.clinic_id
        ).first()

    if not subscription or subscription.plan_name == "free":
        return {"history": []}

    PLAN_PRICES = {"professional": 899, "professional_annual": 8100}
    entry = {
        "id": f"sub-{subscription.id}",
        "invoice": f"INV-{subscription.provider_order_id or subscription.id}",
        "plan": PLAN_LABELS.get(subscription.plan_name, subscription.plan_name.title()),
        "amount": PLAN_PRICES.get(subscription.plan_name, 899),
        "date": (subscription.current_start or subscription.created_at or datetime.utcnow()).strftime("%-d %b %Y"),
        "status": "PAID" if subscription.status == "active" else subscription.status.upper(),
    }
    return {"history": [entry]}


@router.post("/validate-coupon")
async def validate_subscription_coupon(
    request: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a coupon for subscription"""
    subscription_service = SubscriptionService(db)
    # Pricing logic
    if request.plan_name == "professional":
        price = 899
    elif request.plan_name == "professional_annual":
        price = 8100
    else:
        price = 0
    
    validation = subscription_service.validate_coupon(request.code, price)
    if not validation["is_valid"]:
        return {
            "is_valid": False,
            "discount_amount": 0,
            "final_amount": price,
            "message": validation["message"]
        }
        
    return {
        "is_valid": True,
        "discount_amount": validation["discount"],
        "final_amount": validation["final_amount"],
        "message": "Coupon applied successfully"
    }

@router.post("/checkout")
async def create_checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initiate a checkout session for a plan linked to the current user"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User not in clinic")
        
    subscription_service = SubscriptionService(db)
    
    # Prices for professional plans
    if checkout_data.plan_name == "professional":
        price = 899
    elif checkout_data.plan_name == "professional_annual":
        price = 8100
    else:
        price = 0
    
    try:
        result = subscription_service.create_checkout_session(
            clinic_id=current_user.clinic_id,
            plan_name=checkout_data.plan_name,
            amount=price,
            coupon_code=checkout_data.coupon_code,
            user_id=current_user.id
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/verify-status")
async def verify_subscription_status(
    order_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify the status of a specific order for the current user"""
    subscription_service = SubscriptionService(db)
    result = subscription_service.verify_payment(current_user.id, order_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
        
    return result

@router.post("/webhook/cashfree")
async def cashfree_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Cashfree webhooks"""
    try:
        payload = await request.json()
        print(f"WEBHOOK RECEIVED: {payload}")
        
        subscription_service = SubscriptionService(db)
        
        # In production, we MUST verify signature here
        # signature = request.headers.get("x-webhook-signature")
        
        success = subscription_service.handle_webhook("cashfree", payload)
        if success:
            return {"status": "ok", "message": "Processed successfully"}
        
        # Even if not SUCCESS status, we return 200 to acknowledge receipt
        return {"status": "received", "message": "Webhook acknowledged"}
        
    except Exception as e:
        print(f"WEBHOOK ERROR: {str(e)}")
        # We still return 200 to stop retry if it's a malformed test payload
        return {"status": "error", "message": str(e)}

