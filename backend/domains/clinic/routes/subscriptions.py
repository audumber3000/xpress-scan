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
                "Simple reporting"
            ]
        },
        {
            "name": "professional",
            "display_name": "Professional Plan",
            "price": 1200,  # ₹1200 per month as requested
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
    
    return subscription

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
        price = 1200
    elif request.plan_name == "professional_yearly":
        price = 10800
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
        price = 1200
    elif checkout_data.plan_name == "professional_yearly":
        price = 10800
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

