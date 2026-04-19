import os
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from models import Subscription, Clinic, User, SubscriptionPayment
from domains.finance.services.cashfree.cashfree_provider import CashfreeProvider

class SubscriptionService:
    def __init__(self, db: Session):
        self.db = db
        # Exclusive support for Cashfree
        self.provider = CashfreeProvider()

    def validate_coupon(self, code: str, plan_amount: float) -> Dict[str, Any]:
        """
        Validate a coupon code and calculate discount
        """
        from models import SubscriptionCoupon
        coupon = self.db.query(SubscriptionCoupon).filter(
            SubscriptionCoupon.code == code,
            SubscriptionCoupon.is_active == True
        ).first()
        
        if not coupon:
            return {"is_valid": False, "message": "Invalid or inactive coupon", "discount": 0}
            
        if coupon.expiry_date and coupon.expiry_date < datetime.utcnow():
            return {"is_valid": False, "message": "Coupon expired", "discount": 0}
            
        if coupon.used_count >= coupon.usage_limit:
            return {"is_valid": False, "message": "Coupon usage limit reached", "discount": 0}
            
        discount = 0
        if coupon.discount_percent:
            discount = (plan_amount * coupon.discount_percent) / 100
        elif coupon.discount_amount:
            discount = coupon.discount_amount
            
        return {
            "is_valid": True,
            "discount": discount,
            "final_amount": max(0.0, plan_amount - discount),
            "coupon_id": coupon.id
        }

    def create_checkout_session(self, clinic_id: int, plan_name: str, amount: float, coupon_code: Optional[str] = None, user_id: Optional[int] = None):
        """
        Create a checkout session for a new subscription linked to a user (owner)
        """
        clinic = self.db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            raise ValueError("Clinic not found")
            
        final_amount = amount
        if coupon_code:
            validation = self.validate_coupon(coupon_code, amount)
            if validation["is_valid"]:
                final_amount = validation["final_amount"]
        
        # Unique order ID for this checkout
        order_id = f"SUB_{clinic_id}_{int(datetime.utcnow().timestamp())}"
        
        # For Cashfree, we create an order
        res = self.provider.create_order(
            amount=final_amount,
            customer_id=str(user_id or clinic_id),
            order_id=order_id,
            notes={
                "clinic_name": clinic.name,
                "plan": plan_name,
                "phone": clinic.phone or "",
                "email": clinic.email or "",
                "coupon": coupon_code or "",
                "user_id": user_id
            }
        )
        
        # Ensure we get payment_session_id
        print(f"DEBUG: Cashfree Create Order Response: {res}")
        payment_session_id = res.get("payment_session_id")
        if not payment_session_id:
            # Try nested data object (older API versions)
            payment_session_id = res.get("data", {}).get("payment_session_id")
            
        if not payment_session_id:
             print(f"ERROR: No payment_session_id found in Cashfree response: {res}")
        
        # Update or create subscription record with order_id and user_id
        sub = None
        if user_id:
            sub = self.db.query(Subscription).filter(Subscription.user_id == user_id).first()
        
        if not sub:
            sub = self.db.query(Subscription).filter(Subscription.clinic_id == clinic_id).first()
            
        if not sub:
            sub = Subscription(clinic_id=clinic_id, user_id=user_id, plan_name=plan_name, status="pending", provider="cashfree")
            self.db.add(sub)
        
        sub.user_id = user_id or sub.user_id
        sub.provider = "cashfree"
        sub.provider_order_id = order_id
        sub.plan_name = plan_name
        sub.status = "pending"
        self.db.commit()
        
        return {
            "payment_session_id": payment_session_id,
            "order_id": order_id,
            "provider": "cashfree"
        }

    def _billing_end(self, plan_name: str, start: datetime) -> datetime:
        if plan_name == "professional_annual":
            return start + relativedelta(years=1)
        return start + relativedelta(months=1)

    def _log_payment(self, sub: Subscription, provider_payment_id: str, amount: float, paid_at: datetime = None):
        """Record a successful payment. Skips if already logged for this order."""
        existing = self.db.query(SubscriptionPayment).filter(
            SubscriptionPayment.provider_order_id == sub.provider_order_id,
            SubscriptionPayment.status == "paid"
        ).first()
        if existing:
            return

        PLAN_PRICES = {"professional": 899, "professional_annual": 8100}
        payment = SubscriptionPayment(
            subscription_id=sub.id,
            clinic_id=sub.clinic_id,
            user_id=sub.user_id,
            provider=sub.provider or "cashfree",
            provider_order_id=sub.provider_order_id,
            provider_payment_id=provider_payment_id,
            plan_name=sub.plan_name,
            amount=amount or PLAN_PRICES.get(sub.plan_name, 899),
            currency="INR",
            status="paid",
            paid_at=paid_at or datetime.utcnow(),
        )
        self.db.add(payment)

    def verify_payment(self, user_id: int, order_id: str) -> Dict[str, Any]:
        """
        Verify payment status directly from provider (fallback for webhooks)
        """
        try:
            order_data = self.provider.get_subscription(order_id)
            status = order_data.get("order_status")

            if status == "PAID":
                sub = self.db.query(Subscription).filter(
                    Subscription.user_id == user_id,
                    Subscription.provider_order_id == order_id
                ).first()

                if sub and sub.status != "active":
                    sub.status = "active"
                    sub.current_start = datetime.utcnow()
                    sub.current_end = self._billing_end(sub.plan_name, sub.current_start)

                    from models import user_clinics
                    stmt = self.db.query(Clinic).join(user_clinics).filter(user_clinics.c.user_id == user_id)
                    clinics = stmt.all()
                    for clinic in clinics:
                        clinic.subscription_plan = sub.plan_name

                    amount = order_data.get("order_amount", 0)
                    self._log_payment(sub, order_data.get("cf_order_id"), amount)
                    self.db.commit()

                return {"success": True, "status": status, "message": "Payment verified successfully"}

            return {"success": False, "status": status, "message": f"Payment status: {status}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def handle_webhook(self, provider: str, payload: Dict[str, Any]):
        """
        Generic webhook handler
        """
        if provider == "cashfree":
            order_id = payload.get("data", {}).get("order", {}).get("order_id")
            payment_data = payload.get("data", {}).get("payment", {})
            payment_status = payment_data.get("payment_status")
            cf_payment_id = payment_data.get("cf_payment_id")
            payment_amount = payment_data.get("payment_amount", 0)
            payment_time = payment_data.get("payment_completion_time")

            if order_id and payment_status == "SUCCESS":
                sub = self.db.query(Subscription).filter(Subscription.provider_order_id == order_id).first()
                if sub:
                    sub.status = "active"
                    sub.provider_subscription_id = cf_payment_id
                    sub.current_start = datetime.utcnow()
                    sub.current_end = self._billing_end(sub.plan_name, sub.current_start)

                    if sub.user_id:
                        from models import user_clinics
                        stmt = self.db.query(Clinic).join(user_clinics).filter(user_clinics.c.user_id == sub.user_id)
                        clinics = stmt.all()
                        for clinic in clinics:
                            clinic.subscription_plan = sub.plan_name
                    elif sub.clinic_id:
                        clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
                        if clinic:
                            clinic.subscription_plan = sub.plan_name

                    paid_at = None
                    if payment_time:
                        try:
                            paid_at = datetime.fromisoformat(payment_time.replace("Z", "+00:00"))
                        except Exception:
                            pass

                    self._log_payment(sub, cf_payment_id, payment_amount, paid_at)
                    self.db.commit()
                    return True
        return False
