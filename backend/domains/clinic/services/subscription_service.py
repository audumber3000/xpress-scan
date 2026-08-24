import logging
import os
import secrets
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from models import Subscription, Clinic, User, SubscriptionPayment
from domains.finance.services.cashfree.cashfree_provider import CashfreeProvider
from domains.notification.services.platform_notification_service import PlatformNotificationService
from core.posthog_client import track_event
from core import plans

logger = logging.getLogger(__name__)

# Cashfree international collections is enabled per ACCOUNT, not per request.
# Until that facility is live, a non-INR order is accepted by our code and then
# rejected by the gateway, which is the worst possible moment to find out. The
# flag lets the USD path ship dark and be switched on with a deploy variable
# once the account is ready.
INTERNATIONAL_ENABLED = os.getenv("CASHFREE_INTERNATIONAL_ENABLED", "").lower() in ("1", "true", "yes")

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

        # Normalised here rather than trusting the caller. Codes are stored
        # upper-cased by the support tool, and both promo boxes happen to
        # upper-case as you type, but a code pasted from an email with a
        # trailing space or typed in lower case must not silently fail: this is
        # also called from create_checkout_session, where "no match" means the
        # discount quietly does not apply and the clinic is charged the full
        # price it was not shown.
        code = (code or "").strip().upper()
        coupon = self.db.query(SubscriptionCoupon).filter(
            SubscriptionCoupon.code == code,
            SubscriptionCoupon.is_active == True
        ).first()
        
        if not coupon:
            return {"is_valid": False, "message": "Invalid or inactive coupon", "discount": 0}
            
        if coupon.expiry_date and coupon.expiry_date < datetime.utcnow():
            return {"is_valid": False, "message": "Coupon expired", "discount": 0}
            
        # `usage_limit` is nullable and the support tool lets it be left empty,
        # where it means unlimited. Comparing an int against None raised a
        # TypeError and 500'd the whole validation.
        used = coupon.used_count or 0
        if coupon.usage_limit is not None and used >= coupon.usage_limit:
            return {"is_valid": False, "message": "Coupon usage limit reached", "discount": 0}

        discount = 0
        if coupon.discount_percent:
            discount = (plan_amount * coupon.discount_percent) / 100
        elif coupon.discount_amount:
            discount = coupon.discount_amount
        discount = min(discount, plan_amount)   # never below zero, never a credit

        return {
            "is_valid": True,
            "discount": round(discount, 2),
            "final_amount": round(max(0.0, plan_amount - discount), 2),
            "coupon_id": coupon.id,
            # The coupon's own terms, so one validation can re-price all three
            # plan cards on the client instead of three round trips. Display
            # only: create_checkout_session re-validates before charging, so a
            # tampered figure changes nothing that reaches the gateway.
            "code": coupon.code,
            "discount_percent": coupon.discount_percent,
            "discount_flat": coupon.discount_amount,
            "expires_at": coupon.expiry_date.isoformat() if coupon.expiry_date else None,
            "uses_left": (coupon.usage_limit - used) if coupon.usage_limit is not None else None,
        }

    def create_checkout_session(self, clinic_id: int, plan_name: str, coupon_code: Optional[str] = None, user_id: Optional[int] = None):
        """
        Create a checkout session for a new subscription linked to a user (owner).

        The amount is derived here rather than passed in. It used to come from
        the route as a bare number, which is how the screen quoting a price and
        the order charging one drifted apart. One function, one price.

        Tax is applied AFTER any coupon, because a discount reduces the taxable
        value; taxing first would overcharge GST on money the clinic never paid.
        """
        clinic = self.db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            raise ValueError("Clinic not found")

        currency = plans.billing_currency(clinic)
        if currency != plans.INR and not INTERNATIONAL_ENABLED:
            # Cashfree international collections is an account-level facility.
            # Until it is switched on, an overseas order would be rejected by
            # the gateway after the customer had already committed, so refuse
            # here where we can say something useful instead.
            raise ValueError(
                "Card payments outside India are not enabled yet. "
                "Please contact support and we will set your plan up manually."
            )

        list_price = plans.price(plan_name, currency)
        base = list_price
        applied_coupon = None
        if coupon_code:
            validation = self.validate_coupon(coupon_code, base)
            if validation["is_valid"]:
                base = validation["final_amount"]
                applied_coupon = {
                    "code": validation.get("code") or coupon_code,
                    "discount": round(list_price - base, 2),
                }

        tax = round(base * plans.gst_rate(clinic), 2)
        final_amount = round(base + tax, 2)

        # Unique order ID for this checkout.
        #
        # The random suffix is load-bearing. This used to be clinic id plus a
        # whole-second timestamp, so two checkouts by the same clinic inside one
        # second produced the SAME order id: a double-click on Pay, or picking a
        # plan and immediately picking another. The second payment then matched
        # the first in _log_payment's dedup guard and was silently dropped, with
        # its coupon never counted, and the gateway had two different amounts
        # under one order reference.
        order_id = f"SUB_{clinic_id}_{int(datetime.utcnow().timestamp())}_{secrets.token_hex(3)}"

        # For Cashfree, we create an order
        res = self.provider.create_order(
            amount=final_amount,
            customer_id=str(user_id or clinic_id),
            order_id=order_id,
            currency=currency,
            notes={
                "clinic_name": clinic.name,
                "plan": plans.label(plan_name),
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
        # Parked on the subscription so it survives the gap between here and the
        # webhook. Cashfree hands back an order_id and nothing else, so a coupon
        # that lives only in the gateway's `notes` is a coupon we can never
        # attribute, count, or print on the invoice.
        notes = dict(sub.notes or {})
        if applied_coupon:
            notes["pending_coupon"] = applied_coupon["code"]
            notes["pending_discount"] = applied_coupon["discount"]
        else:
            notes.pop("pending_coupon", None)
            notes.pop("pending_discount", None)
        sub.notes = notes
        self.db.commit()
        
        return {
            "payment_session_id": payment_session_id,
            "order_id": order_id,
            "provider": "cashfree",
            "currency": currency,
            "list_price": round(list_price, 2),
            "base": round(base, 2),
            "discount": applied_coupon["discount"] if applied_coupon else 0,
            "coupon_code": applied_coupon["code"] if applied_coupon else None,
            "tax": tax,
            "amount": final_amount,
        }

    def _billing_end(self, plan_name: str, start: datetime) -> datetime:
        if plans.cycle_of(plan_name) == "annual":
            return start + relativedelta(years=1)
        return start + relativedelta(months=1)

    def _redeem_coupon(self, code: str) -> None:
        """Count one redemption against a coupon.

        Incremented in SQL rather than by reading, adding one and writing back,
        so two payments settling at the same moment cannot both read 41 and both
        write 42. `usage_limit` is what stands between a 20%-off campaign and an
        unbounded one, and until now `used_count` was read in validate_coupon
        and written absolutely nowhere: every capped coupon was in fact
        unlimited, and every campaign reported zero redemptions.

        Best effort. A promo counter is never worth failing a payment that has
        already been taken.
        """
        from models import SubscriptionCoupon
        try:
            self.db.query(SubscriptionCoupon).filter(
                SubscriptionCoupon.code == code
            ).update(
                {SubscriptionCoupon.used_count: SubscriptionCoupon.used_count + 1},
                synchronize_session=False,
            )
        except Exception:
            logger.exception("could not count redemption of coupon %s", code)

    def _plan_price(self, plan_name: str, clinic=None) -> float:
        """List price before tax, in the clinic's own billing currency.

        Coupons can legitimately bring the paid amount below this, so it is a
        sanity check, not an authorisation gate.
        """
        return plans.price(plan_name, plans.billing_currency(clinic))

    def _log_payment(self, sub: Subscription, provider_payment_id: str, amount: float, paid_at: datetime = None):
        """Record a successful payment. Skips if already logged for this order."""
        existing = self.db.query(SubscriptionPayment).filter(
            SubscriptionPayment.provider_order_id == sub.provider_order_id,
            SubscriptionPayment.status == "paid"
        ).first()
        if existing:
            return

        clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
        payment_amount = amount or self._plan_price(sub.plan_name, clinic)

        # `payment_amount` is what left the account, tax included, so the tax is
        # extracted from it rather than added to it. Deriving it this way also
        # survives coupons: a discount reduces the taxable value, and the split
        # of the discounted total is still correct.
        rate = plans.gst_rate(clinic)
        tax_amount = round(payment_amount - (payment_amount / (1 + rate)), 2) if rate else 0.0

        # The coupon parked at checkout. Read before the row is written so the
        # payment carries its own attribution, and redeemed exactly once: this
        # whole function is already behind a replay guard, so a Cashfree retry
        # cannot reach here twice for the same order.
        notes = dict(sub.notes or {})
        coupon_code = notes.get("pending_coupon")
        discount_amount = notes.get("pending_discount")

        payment = SubscriptionPayment(
            subscription_id=sub.id,
            clinic_id=sub.clinic_id,
            user_id=sub.user_id,
            provider=sub.provider or "cashfree",
            provider_order_id=sub.provider_order_id,
            provider_payment_id=provider_payment_id,
            plan_name=sub.plan_name,
            amount=payment_amount,
            tax_amount=tax_amount,
            coupon_code=coupon_code,
            discount_amount=discount_amount,
            currency=plans.billing_currency(clinic),
            status="paid",
            paid_at=paid_at or datetime.utcnow(),
        )
        self.db.add(payment)

        if coupon_code:
            self._redeem_coupon(coupon_code)
            notes.pop("pending_coupon", None)
            notes.pop("pending_discount", None)
            sub.notes = notes

        try:
            track_event(
                str(sub.user_id) if sub.user_id else f"clinic_{sub.clinic_id}",
                "Invoice Paid",
                {
                    "amount": payment_amount,
                    "plan": sub.plan_name,
                    "provider": payment.provider,
                    "$groups": {"clinic": sub.clinic_id}
                }
            )
        except Exception:
            pass

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
                    sub.is_trial = False
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
                    owner = self.db.query(User).filter(User.id == user_id).first()
                    clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
                    if clinic:
                        try:
                            PlatformNotificationService(self.db).send_subscription_confirmed_notifications(
                                clinic=clinic,
                                owner=owner,
                                plan_name=sub.plan_name,
                                valid_until=sub.current_end,
                            )
                        except Exception as notification_error:
                            print(f"Failed to queue subscription confirmation notifications: {notification_error}")

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
                    # Replay guard. Cashfree retries, and a retry used to re-run
                    # the block below — resetting current_start/current_end and
                    # handing out a fresh billing period for free. _log_payment
                    # already deduped the payment ROW, but nothing stopped the
                    # subscription itself being re-activated.
                    already_paid = self.db.query(SubscriptionPayment).filter(
                        SubscriptionPayment.provider_order_id == order_id,
                        SubscriptionPayment.status == "paid",
                    ).first()
                    if already_paid:
                        logger.info(f"cashfree webhook replay for order {order_id} — already processed, skipping")
                        return True

                    warn_clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
                    # Compared in the order's OWN currency, plus tax, because
                    # that is what was charged. Against a bare INR list price a
                    # perfectly good $4 order looks like a 395-rupee shortfall.
                    expected = self._plan_price(sub.plan_name, warn_clinic)
                    expected = round(expected * (1 + plans.gst_rate(warn_clinic)), 2)
                    if payment_amount and expected and float(payment_amount) + 0.01 < expected:
                        # Not fatal — coupons and partial promos legitimately pay
                        # less — but it should never pass silently.
                        logger.warning(
                            f"cashfree webhook: order {order_id} paid {payment_amount} "
                            f"but {sub.plan_name} lists {expected}"
                        )

                    sub.status = "active"
                    sub.is_trial = False
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
                    owner = self.db.query(User).filter(User.id == sub.user_id).first() if sub.user_id else None
                    clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
                    if clinic:
                        try:
                            PlatformNotificationService(self.db).send_subscription_confirmed_notifications(
                                clinic=clinic,
                                owner=owner,
                                plan_name=sub.plan_name,
                                valid_until=sub.current_end,
                            )
                        except Exception as notification_error:
                            print(f"Failed to queue subscription confirmation notifications: {notification_error}")
                    return True

            elif order_id and payment_status == "FAILED":
                # Don't change subscription status — keep as pending so user can retry
                error_msg = payment_data.get("payment_message") or "Payment failed"
                print(f"PAYMENT FAILED: order={order_id} reason={error_msg}")

                # The clinic gets no other signal that this failed: the status
                # deliberately stays pending, so the screen looks the same as
                # before they paid. Without this the first they know is a
                # subscription that quietly never activated.
                try:
                    from domains.notification.services.notification_center_service import (
                        notify, OWNER, SEVERITY_CRITICAL,
                    )
                    sub = (
                        self.db.query(Subscription)
                        .filter(Subscription.provider_order_id == order_id)
                        .first()
                    )
                    target_clinic_id = getattr(sub, "clinic_id", None) if sub else None
                    if not target_clinic_id and sub and sub.user_id:
                        owner = self.db.query(User).filter(User.id == sub.user_id).first()
                        target_clinic_id = getattr(owner, "clinic_id", None)
                    if target_clinic_id:
                        notify(
                            self.db,
                            clinic_id=target_clinic_id,
                            event_type="subscription_payment_failed",
                            severity=SEVERITY_CRITICAL,
                            audience=OWNER,
                            title="Subscription payment failed",
                            body=f"{error_msg}. Your plan has not changed, you can try again.",
                            link="/admin/subscription",
                            entity_type="subscription",
                            entity_id=getattr(sub, "id", None),
                        )
                        self.db.commit()
                except Exception:
                    self.db.rollback()

        return False
