import os
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from database import SessionLocal
from models import Subscription, Clinic, User
from schemas import SubscriptionOut, SubscriptionCreate, SubscriptionUpdate
from auth import get_current_user
from domains.finance.services.razorpay_service import RazorpayService

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()

# Initialize Razorpay service
try:
    razorpay_service = RazorpayService()
except ValueError as e:
    print(f"Warning: Razorpay service not initialized: {e}")
    razorpay_service = None

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
                "50 patients per month",
                "Basic reports",
                "Email support"
            ]
        },
        {
            "name": "professional",
            "display_name": "Professional Plan",
            "price": 2999,  # ₹2999 per month
            "currency": "INR",
            "interval": "month",
            "features": [
                "Unlimited patients",
                "Advanced reports",
                "Priority support",
                "Custom branding",
                "API access"
            ],
            "razorpay_plan_id": razorpay_service.get_plan_id("professional") if razorpay_service else None
        },
        {
            "name": "enterprise",
            "display_name": "Enterprise Plan",
            "price": 9999,  # ₹9999 per month
            "currency": "INR",
            "interval": "month",
            "features": [
                "Unlimited everything",
                "White-label solution",
                "Dedicated support",
                "Custom integrations",
                "SLA guarantee"
            ],
            "razorpay_plan_id": razorpay_service.get_plan_id("enterprise") if razorpay_service else None
        }
    ]
    return {"plans": plans}

@router.get("/", response_model=SubscriptionOut)
async def get_current_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current subscription for the user's clinic"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    if not subscription:
        # Return default free subscription
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        return SubscriptionOut(
            id=0,
            clinic_id=current_user.clinic_id,
            plan_name=clinic.subscription_plan if clinic else "free",
            status="active",
            razorpay_subscription_id=None,
            razorpay_customer_id=None,
            razorpay_plan_id=None,
            current_start=None,
            current_end=None,
            quantity=1,
            notes=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    return subscription

@router.post("/create")
async def create_subscription(
    subscription_data: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new subscription (initiate Razorpay subscription)"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Check if subscription already exists
    existing_subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    try:
        # Create or get Razorpay customer
        if not clinic.razorpay_customer_id:
            customer = razorpay_service.create_customer(
                name=clinic.name,
                email=clinic.email or current_user.email,
                contact=clinic.phone,
                notes={"clinic_id": str(clinic.id)}
            )
            clinic.razorpay_customer_id = customer["id"]
            db.commit()
        
        # Create Razorpay subscription
        razorpay_subscription = razorpay_service.create_subscription(
            customer_id=clinic.razorpay_customer_id,
            plan_id=subscription_data.razorpay_plan_id,
            total_count=999999  # Indefinite monthly billing
        )
        
        # Create or update subscription record
        if existing_subscription:
            existing_subscription.razorpay_subscription_id = razorpay_subscription["id"]
            existing_subscription.razorpay_customer_id = clinic.razorpay_customer_id
            existing_subscription.razorpay_plan_id = subscription_data.razorpay_plan_id
            existing_subscription.plan_name = subscription_data.plan_name
            existing_subscription.status = RazorpayService.parse_subscription_status(razorpay_subscription.get("status", "active"))
            existing_subscription.notes = razorpay_subscription
            if razorpay_subscription.get("current_start"):
                existing_subscription.current_start = datetime.fromtimestamp(razorpay_subscription["current_start"])
            if razorpay_subscription.get("current_end"):
                existing_subscription.current_end = datetime.fromtimestamp(razorpay_subscription["current_end"])
            existing_subscription.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_subscription)
            
            # Update clinic subscription plan
            clinic.subscription_plan = subscription_data.plan_name
            db.commit()
            
            return existing_subscription
        else:
            # Create new subscription record
            subscription = Subscription(
                clinic_id=current_user.clinic_id,
                razorpay_subscription_id=razorpay_subscription["id"],
                razorpay_customer_id=clinic.razorpay_customer_id,
                razorpay_plan_id=subscription_data.razorpay_plan_id,
                plan_name=subscription_data.plan_name,
                status=RazorpayService.parse_subscription_status(razorpay_subscription.get("status", "active")),
                notes=razorpay_subscription,
                quantity=1
            )
            if razorpay_subscription.get("current_start"):
                subscription.current_start = datetime.fromtimestamp(razorpay_subscription["current_start"])
            if razorpay_subscription.get("current_end"):
                subscription.current_end = datetime.fromtimestamp(razorpay_subscription["current_end"])
            
            db.add(subscription)
            
            # Update clinic subscription plan
            clinic.subscription_plan = subscription_data.plan_name
            db.commit()
            db.refresh(subscription)
            
            return subscription
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating subscription: {str(e)}")

@router.post("/pause")
async def pause_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pause the current subscription"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    if not subscription or not subscription.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="Active subscription not found")
    
    try:
        razorpay_subscription = razorpay_service.pause_subscription(subscription.razorpay_subscription_id)
        subscription.status = "paused"
        subscription.notes = razorpay_subscription
        subscription.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(subscription)
        
        return subscription
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error pausing subscription: {str(e)}")

@router.post("/resume")
async def resume_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resume a paused subscription"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    if not subscription or not subscription.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    try:
        razorpay_subscription = razorpay_service.resume_subscription(subscription.razorpay_subscription_id)
        subscription.status = RazorpayService.parse_subscription_status(razorpay_subscription.get("status", "active"))
        subscription.notes = razorpay_subscription
        subscription.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(subscription)
        
        return subscription
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error resuming subscription: {str(e)}")

@router.post("/cancel")
async def cancel_subscription(
    cancel_at_cycle_end: bool = Query(True, description="Cancel at end of billing cycle"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel the current subscription"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    if not subscription or not subscription.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="Active subscription not found")
    
    try:
        razorpay_subscription = razorpay_service.cancel_subscription(
            subscription.razorpay_subscription_id,
            cancel_at_cycle_end=cancel_at_cycle_end
        )
        subscription.status = "cancelled"
        subscription.notes = razorpay_subscription
        subscription.updated_at = datetime.utcnow()
        
        # Update clinic subscription plan to free
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if clinic:
            clinic.subscription_plan = "free"
        
        db.commit()
        db.refresh(subscription)
        
        return subscription
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error cancelling subscription: {str(e)}")

@router.post("/sync")
async def sync_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync subscription status from Razorpay"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    subscription = db.query(Subscription).filter(
        Subscription.clinic_id == current_user.clinic_id
    ).first()
    
    if not subscription or not subscription.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="Active subscription not found")
    
    try:
        razorpay_subscription = razorpay_service.get_subscription(subscription.razorpay_subscription_id)
        
        # Update subscription from Razorpay data
        subscription.status = RazorpayService.parse_subscription_status(razorpay_subscription.get("status", "active"))
        subscription.notes = razorpay_subscription
        if razorpay_subscription.get("current_start"):
            subscription.current_start = datetime.fromtimestamp(razorpay_subscription["current_start"])
        if razorpay_subscription.get("current_end"):
            subscription.current_end = datetime.fromtimestamp(razorpay_subscription["current_end"])
        subscription.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(subscription)
        
        return subscription
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error syncing subscription: {str(e)}")

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Razorpay webhook events"""
    if not razorpay_service:
        raise HTTPException(status_code=500, detail="Razorpay service is not configured")
    
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="RAZORPAY_WEBHOOK_SECRET is not configured")
    
    try:
        body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing signature header")
        
        # Verify webhook signature
        if not razorpay_service.verify_webhook_signature(body.decode(), signature, webhook_secret):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
        payload = await request.json()
        event = payload.get("event")
        entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
        
        subscription_id = entity.get("id")
        if not subscription_id:
            return {"status": "ignored", "message": "No subscription ID in payload"}
        
        # Find subscription in database
        subscription = db.query(Subscription).filter(
            Subscription.razorpay_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            return {"status": "ignored", "message": "Subscription not found in database"}
        
        # Handle different events
        if event in ["subscription.activated", "subscription.charged", "invoice.paid"]:
            subscription.status = "active"
            if entity.get("current_start"):
                subscription.current_start = datetime.fromtimestamp(entity["current_start"])
            if entity.get("current_end"):
                subscription.current_end = datetime.fromtimestamp(entity["current_end"])
            
            # Update clinic subscription plan
            clinic = db.query(Clinic).filter(Clinic.id == subscription.clinic_id).first()
            if clinic:
                clinic.subscription_plan = subscription.plan_name
            
        elif event == "subscription.paused":
            subscription.status = "paused"
        
        elif event in ["subscription.cancelled", "subscription.charged_failed"]:
            subscription.status = "cancelled"
            # Update clinic subscription plan to free
            clinic = db.query(Clinic).filter(Clinic.id == subscription.clinic_id).first()
            if clinic:
                clinic.subscription_plan = "free"
        
        elif event == "subscription.resumed":
            subscription.status = "active"
        
        elif event == "subscription.expired":
            subscription.status = "expired"
            # Update clinic subscription plan to free
            clinic = db.query(Clinic).filter(Clinic.id == subscription.clinic_id).first()
            if clinic:
                clinic.subscription_plan = "free"
        
        # Update subscription notes with latest Razorpay data
        subscription.notes = entity
        subscription.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {"status": "success", "event": event}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")

