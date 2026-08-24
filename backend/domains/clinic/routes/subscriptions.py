import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timedelta

from database import SessionLocal, get_db
from models import Subscription, Clinic, User
from core import plans
from schemas import SubscriptionOut, SubscriptionCreate, SubscriptionUpdate, CouponValidateRequest, CheckoutRequest
from core.auth_utils import get_current_user
from domains.clinic.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

TRIAL_DAYS = plans.TRIAL_DAYS

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter()

@router.get("/plans")
async def get_available_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The three plans, priced in this clinic's own billing currency.

    Authenticated so the response can be currency-correct. `core.plans.catalogue`
    returns INR for an Indian clinic and USD for everyone else, and returns ONLY
    that currency, which is what guarantees no dollar figure can reach an Indian
    dentist by way of a frontend bug or a stale bundle.
    """
    clinic = (
        db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if current_user.clinic_id else None
    )
    return plans.catalogue(clinic)


@router.get("/usage")
async def get_plan_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """How much of its plan this clinic is actually using.

    The computation lives in `core.plan_usage` because the over-limit nudge job
    needs exactly the same numbers, and a meter on screen disagreeing with the
    notification that fires off it would be worse than having neither.
    """
    from core import plan_usage

    clinic = (
        db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        if current_user.clinic_id else None
    )
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return plan_usage.compute(db, clinic)


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
        # No row yet. Report the entry plan rather than nothing, and treat the
        # trial as available: a clinic with no subscription row has by
        # definition never used one.
        clinic_plan = plans.DEFAULT_PLAN
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            clinic_plan = plans.stored_name(*plans.resolve(clinic.subscription_plan if clinic else None))

        return SubscriptionOut(
            id=0,
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            plan_name=clinic_plan,
            status="active",
            provider="none",
            trial_available=True,
            effective_plan=plans.key_of(clinic_plan),
            effective_plan_label=plans.label(clinic_plan),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    # Annotate with expiry and trial info for frontend
    now = datetime.utcnow()
    is_expired = (
        subscription.current_end is not None
        and subscription.current_end < now
    )
    is_trial = bool(getattr(subscription, 'is_trial', False) and subscription.status == 'active' and not is_expired)

    # Auto-downgrade: if the subscription has expired, reset the clinic to 'free'
    # so that /auth/me also reflects the correct plan for mobile and other clients.
    if is_expired and subscription.clinic_id:
        clinic = db.query(Clinic).filter(Clinic.id == subscription.clinic_id).first()
        if clinic and plans.key_of(clinic.subscription_plan) != plans.DEFAULT_PLAN:
            clinic.subscription_plan = plans.DEFAULT_PLAN
            subscription.status = 'expired'
            db.commit()
    effective = plans.effective_plan(
        subscription.plan_name, subscription.status, subscription.current_end
    )
    from core import plan_state as _ps
    _state = _ps.evaluate(subscription)

    trial_ends_at = None
    trial_days_remaining = None
    if is_trial and subscription.current_end:
        trial_ends_at = subscription.current_end.isoformat()
        trial_days_remaining = max(0, (subscription.current_end.date() - now.date()).days)

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
        "is_trial": is_trial,
        "trial_ends_at": trial_ends_at,
        "trial_days_remaining": trial_days_remaining,
        # Two ways to be ineligible: already used one, or already paying.
        #
        # "Already paying" deliberately excludes a plan granted by the
        # free-to-Plus migration. Those clinics are on an active non-entry plan
        # they never bought, and without this they would all silently lose the
        # trial they have never taken.
        "trial_available": (
            not getattr(subscription, "trial_used", False)
            and not (
                subscription.status == "active"
                and not is_expired
                and subscription.provider != "migration"
                and plans.rank(subscription.plan_name) > plans.rank(plans.DEFAULT_PLAN)
            )
        ),
        "plan_label": plans.label(subscription.plan_name),
        # What they can actually use right now, which after an expiry is NOT
        # `plan_name`. The header reads the clinic column and this page read the
        # subscription column, and the two disagreed on screen: one clinic saw
        # "Plus" in the header and "Pro" as its current plan at the same time.
        # Both now resolve through plans.effective_plan.
        "effective_plan": effective,
        "effective_plan_label": plans.label(effective),
        # The same state the header and the write-lock read, so the page cannot
        # claim a clinic is "on Plus" while every write is being refused.
        "plan_state": _state.get("state"),
        "plan_state_blocks": _state.get("blocks", False),
        "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
        "updated_at": subscription.updated_at.isoformat() if subscription.updated_at else None,
    }
    return result

@router.post("/start-trial")
async def start_free_trial(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a one-time 7-day Professional free trial for the current clinic.

    No payment required. A clinic can only ever start a trial once — eligibility
    is tracked via Subscription.trial_used.
    """
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User not in clinic")

    now = datetime.utcnow()

    subscription = db.query(Subscription).filter(
        or_(
            Subscription.user_id == current_user.id,
            Subscription.clinic_id == current_user.clinic_id,
        )
    ).order_by(Subscription.id.desc()).first()

    if subscription:
        if getattr(subscription, "trial_used", False):
            raise HTTPException(status_code=400, detail="Your free trial has already been used.")
        is_expired = bool(subscription.current_end and subscription.current_end < now)
        # A plan handed out by the free-to-Plus migration is not a plan they
        # bought, so it does not use up the trial. Without this exemption the
        # migration would take the 7-day Pro trial away from every existing
        # clinic on the day it ran.
        already_paying = (
            subscription.status == "active"
            and not is_expired
            and subscription.provider != "migration"
            and plans.rank(subscription.plan_name) > plans.rank(plans.DEFAULT_PLAN)
        )
        if already_paying:
            raise HTTPException(status_code=400, detail="You already have an active plan.")

    trial_end = now + timedelta(days=TRIAL_DAYS)

    if not subscription:
        subscription = Subscription(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            provider="trial",
        )
        db.add(subscription)

    subscription.plan_name = plans.TRIAL_PLAN
    subscription.status = "active"
    subscription.provider = "trial"
    subscription.is_trial = True
    subscription.trial_used = True
    subscription.current_start = now
    subscription.current_end = trial_end
    subscription.trial_ends_at = trial_end

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if clinic:
        clinic.subscription_plan = plans.TRIAL_PLAN

    db.commit()
    db.refresh(subscription)

    # Fire the "trial started" WhatsApp (t1) immediately. Best-effort — never block activation.
    if clinic:
        try:
            from domains.notification.services.platform_notification_service import PlatformNotificationService
            owner_name = getattr(current_user, "first_name", None) or getattr(current_user, "name", None) or (clinic.name or "there")
            PlatformNotificationService(db).send_whatsapp_event(
                clinic,
                "molarplus_account_update_t1",
                template_data={"owner_name": owner_name},
            )
        except Exception:
            pass

    # In the bell as well as on WhatsApp. The trial has an end date the clinic
    # will otherwise only meet when things stop working.
    try:
        from domains.notification.services.notification_center_service import (
            notify, OWNER, SEVERITY_INFO,
        )
        ends = subscription.current_end.strftime("%d %b") if subscription.current_end else None
        notify(
            db,
            clinic_id=current_user.clinic_id,
            event_type="trial_started",
            severity=SEVERITY_INFO,
            audience=OWNER,
            title=f"Your {TRIAL_DAYS}-day {plans.PLANS[plans.TRIAL_PLAN]['label']} trial has started",
            body=f"Everything is unlocked until {ends}." if ends else "Everything is unlocked.",
            link="/admin/subscription",
            entity_type="subscription",
            entity_id=subscription.id,
        )
        db.commit()
    except Exception:
        db.rollback()

    return {
        "success": True,
        "message": f"Your {TRIAL_DAYS}-day {plans.PLANS[plans.TRIAL_PLAN]['label']} trial is now active.",
        "plan_name": subscription.plan_name,
        "is_trial": True,
        "trial_ends_at": subscription.current_end.isoformat() if subscription.current_end else None,
        "trial_days_remaining": TRIAL_DAYS,
    }


@router.get("/history")
async def get_billing_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return billing history for the current user."""
    from models import SubscriptionPayment

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
                "plan": plans.label(p.plan_name),
                # The total charged, its tax component, and the currency it was
                # charged in. All three come from the payment row rather than
                # from today's catalogue: an invoice has to show what was
                # actually taken, not what the same plan costs now.
                "amount": p.amount,
                "tax_amount": p.tax_amount,
                "currency": p.currency or "INR",
                "date": (p.paid_at or p.created_at).strftime("%-d %b %Y"),
                "status": (p.status or "").upper(),
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

    # Nothing was ever charged, so there is nothing to show. A plan granted by
    # the migration is in this bucket too: it is active, and it cost nothing.
    if not subscription or subscription.provider in ("none", "migration", "trial"):
        return {"history": []}

    clinic = db.query(Clinic).filter(Clinic.id == subscription.clinic_id).first()
    entry = {
        "id": f"sub-{subscription.id}",
        "invoice": f"INV-{subscription.provider_order_id or subscription.id}",
        "plan": plans.label(subscription.plan_name),
        "amount": plans.price(subscription.plan_name, plans.billing_currency(clinic)),
        "currency": plans.billing_currency(clinic),
        "date": (subscription.current_start or subscription.created_at or datetime.utcnow()).strftime("%-d %b %Y"),
        "status": "PAID" if subscription.status == "active" else subscription.status.upper(),
    }
    return {"history": [entry]}


@router.get("/featured-promo")
async def get_featured_promo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The one promo worth putting in front of every clinic, or nothing.

    A code only helps if the clinic knows it exists, and most never will: they
    are handed out in campaigns that not everybody sees. Flagging one as
    featured in the support tool surfaces it on the Subscription page itself.

    Every condition is re-checked here rather than trusted from the flag, so a
    coupon that expired or ran out overnight stops being advertised the moment
    it stops working. Advertising a code that then fails at checkout is worse
    than never mentioning it.

    Returns `{"promo": null}` when there is nothing to show, so the client has
    one shape to handle.
    """
    from models import SubscriptionCoupon

    now = datetime.utcnow()
    candidates = (
        db.query(SubscriptionCoupon)
        .filter(
            SubscriptionCoupon.is_featured == True,  # noqa: E712
            SubscriptionCoupon.is_active == True,    # noqa: E712
            or_(SubscriptionCoupon.expiry_date.is_(None), SubscriptionCoupon.expiry_date > now),
        )
        .all()
    )
    live = [
        c for c in candidates
        if c.usage_limit is None or (c.used_count or 0) < c.usage_limit
    ]
    if not live:
        return {"promo": None}

    # More than one featured at a time is a mistake in the support tool rather
    # than a state to design for. Show the one expiring soonest, since that is
    # the one a clinic loses first; undated codes sort last.
    live.sort(key=lambda c: (c.expiry_date is None, c.expiry_date or now))
    promo = live[0]

    return {
        "promo": {
            "code": promo.code,
            "discount_percent": promo.discount_percent,
            "discount_flat": promo.discount_amount,
            "expires_at": promo.expiry_date.isoformat() if promo.expiry_date else None,
            "uses_left": (
                promo.usage_limit - (promo.used_count or 0)
                if promo.usage_limit is not None else None
            ),
        }
    }


@router.post("/validate-coupon")
async def validate_subscription_coupon(
    request: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a coupon for subscription"""
    subscription_service = SubscriptionService(db)
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    price = plans.price(request.plan_name, plans.billing_currency(clinic))
    
    validation = subscription_service.validate_coupon(request.code, price)
    if not validation["is_valid"]:
        return {
            "is_valid": False,
            "discount_amount": 0,
            "final_amount": price,
            "message": validation["message"],
        }

    # The coupon's own terms travel with the quote. Without them the client
    # would have to ask once per plan to re-price three cards, and this dict
    # used to drop them on the floor.
    return {
        "is_valid": True,
        "discount_amount": validation["discount"],
        "final_amount": validation["final_amount"],
        "message": "Coupon applied",
        "code": validation.get("code"),
        "discount_percent": validation.get("discount_percent"),
        "discount_flat": validation.get("discount_flat"),
        "expires_at": validation.get("expires_at"),
        "uses_left": validation.get("uses_left"),
        "currency": plans.billing_currency(clinic),
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

    try:
        result = subscription_service.create_checkout_session(
            clinic_id=current_user.clinic_id,
            plan_name=checkout_data.plan_name,
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
    """Handle Cashfree webhooks. Rejects anything it cannot authenticate."""
    import json as _json
    from core import cashfree_webhook

    raw_body = await request.body()

    ok, reason = cashfree_webhook.verify_request(raw_body, request.headers)
    if not ok:
        # 401, and the reason stays in the log — echoing it back would tell an
        # attacker exactly which part of their forgery to fix.
        logger.warning(f"cashfree webhook rejected: {reason}")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = _json.loads(raw_body)
        subscription_service = SubscriptionService(db)
        success = subscription_service.handle_webhook("cashfree", payload)
        if success:
            return {"status": "ok", "message": "Processed successfully"}
        return {"status": "received", "message": "Webhook acknowledged"}

    except Exception as e:
        # 500, not 200 — a swallowed error told Cashfree the payment was handled
        # and it never retried, so a transient DB failure silently lost a paid
        # subscription. Let it retry.
        logger.exception(f"cashfree webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

