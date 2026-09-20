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
from core import plans, payment_gateways

logger = logging.getLogger(__name__)


class SubscriptionService:
    def __init__(self, db: Session):
        self.db = db
        # Cashfree takes rupees, Dodo takes dollars (core.payment_gateways).
        # Cashfree is built eagerly as it always was; Dodo only when a dollar
        # order needs it, so a box without Dodo keys still serves India.
        self.provider = CashfreeProvider()
        self._dodo = None

    @property
    def dodo(self):
        if self._dodo is None:
            from domains.finance.services.dodo.dodo_provider import DodoProvider
            self._dodo = DodoProvider()
        return self._dodo

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

        # Once a clinic is PAYING for something, the only move is up.
        #
        # Scoped to an active paid plan on purpose. A trial, a migration grant,
        # and anything already expired all leave the clinic free to buy any plan
        # including the entry one: somebody whose Pro trial ended has bought
        # nothing, and refusing to sell them Plus because Plus ranks lower than
        # the trial they just lost would be absurd.
        #
        # Enforced here rather than in the UI alone. The UI hides the button;
        # this is what makes the rule true.
        existing = None
        if user_id:
            existing = self.db.query(Subscription).filter(Subscription.user_id == user_id).first()
        if not existing:
            existing = self.db.query(Subscription).filter(Subscription.clinic_id == clinic_id).first()

        from core import plan_state as _ps
        if _ps.blocks_downgrade_to(existing, plan_name):
            raise ValueError(
                f"You are on {plans.label(existing.plan_name)}. You can move up to a "
                f"higher plan at any time, but not down to {plans.label(plan_name)} "
                f"while your current plan is running. Message us and we will sort it out."
            )

        currency = plans.billing_currency(clinic)
        gateway = payment_gateways.for_currency(currency)
        if not payment_gateways.available(gateway):
            # Dollar orders go through Dodo, which is optional until its keys
            # are deployed. Without them the order would fail at the gateway
            # after the clinic had committed, so refuse here where we can say
            # something useful instead.
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

        payment_session_id = None
        checkout_url = None
        dodo_session_id = None
        if gateway == payment_gateways.DODO:
            owner = self.db.query(User).filter(User.id == user_id).first() if user_id else None
            return_base = os.getenv("DODO_RETURN_URL") or os.getenv(
                "CASHFREE_RETURN_URL", "http://localhost:5173/subscription"
            )
            sep = "&" if "?" in return_base else "?"
            res = self.dodo.create_checkout(
                amount=final_amount,
                order_id=order_id,
                plan_key=plans.key_of(plan_name),
                # Dodo appends its own payment_id and status; the order id is
                # ours, and it is what the return page verifies.
                return_url=f"{return_base}{sep}order_id={order_id}",
                cancel_url=return_base,
                customer_email=(getattr(owner, "email", None) or clinic.email or None),
                customer_name=clinic.name,
                # Everything needed to settle this order without the
                # subscription row's parked notes, which only ever describe
                # the LATEST checkout. See _settle_dodo_payment.
                metadata={
                    "clinic_id": clinic_id,
                    "user_id": user_id or 0,
                    "plan": plan_name,
                    "coupon": applied_coupon["code"] if applied_coupon else "",
                    "discount": applied_coupon["discount"] if applied_coupon else 0,
                },
            )
            checkout_url = res.get("checkout_url")
            dodo_session_id = res.get("session_id")
            if not checkout_url or not dodo_session_id:
                logger.error("dodo gave no checkout_url for order %s: %s", order_id, res)
                raise RuntimeError("The payment gateway did not start a session")
        else:
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
            # Should not happen: every clinic is provisioned a row at onboarding.
            # If one slipped through, give it the standard row rather than
            # inventing a half-built one here.
            from core import plan_bootstrap
            clinic_row = self.db.query(Clinic).filter(Clinic.id == clinic_id).first()
            sub = plan_bootstrap.provision_new_clinic(self.db, clinic_row or clinic_id, user_id)

        sub.user_id = user_id or sub.user_id
        sub.provider_order_id = order_id

        # What they are BUYING is parked, not applied.
        #
        # This block used to overwrite plan_name, status and provider on the
        # live row the moment a checkout was opened, which meant simply opening
        # the payment page destroyed whatever plan the clinic was actually on.
        # Clinic 204 opened a Cashfree checkout three minutes into its Pro
        # trial: the row became plan_name=plus/status=pending/provider=cashfree
        # while keeping the trial's dates and is_trial flag, so the header read
        # Pro from the clinic column, the Subscription page read Plus from the
        # row, and plan_state still saw a trial that would blocking-expire on a
        # date nobody had bought.
        #
        # Nothing about the plan changes until money actually arrives.
        # handle_webhook and verify_payment read `pending_plan` back out.
        #
        # The coupon rides along in the same dict, parked for the same reason:
        # Cashfree hands back an order_id and nothing else, so a coupon that
        # lives only in the gateway's `notes` is one we can never attribute,
        # count, or print on the invoice.
        notes = dict(sub.notes or {})
        notes["pending_plan"] = plan_name
        if applied_coupon:
            notes["pending_coupon"] = applied_coupon["code"]
            notes["pending_discount"] = applied_coupon["discount"]
        else:
            notes.pop("pending_coupon", None)
            notes.pop("pending_discount", None)
        # Which gateway holds this order, and for Dodo the session the return
        # page asks about: Dodo looks a checkout up by its own session id, not
        # by our order id as Cashfree does.
        if dodo_session_id:
            notes["pending_checkout"] = {
                "gateway": payment_gateways.DODO,
                "order_id": order_id,
                "session_id": dodo_session_id,
            }
        else:
            notes.pop("pending_checkout", None)
        sub.notes = notes
        self.db.commit()

        return {
            "payment_session_id": payment_session_id,
            "checkout_url": checkout_url,
            "order_id": order_id,
            "provider": gateway,
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

    def _log_payment(self, sub: Subscription, provider_payment_id: str, amount: float, paid_at: datetime = None,
                     currency: Optional[str] = None, tax_amount: Optional[float] = None):
        """Record a successful payment. Skips if already logged for this order.

        `currency` and `tax_amount` are what the gateway reports, when it
        reports them. Dodo does, and as merchant of record the tax it collected
        abroad is its own figure, not our GST split. Cashfree does not, and
        gets the derivation below exactly as before.
        """
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
        if tax_amount is None:
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
            currency=currency or plans.billing_currency(clinic),
            status="paid",
            paid_at=paid_at or datetime.utcnow(),
        )
        self.db.add(payment)

        if coupon_code:
            self._redeem_coupon(coupon_code)
            notes.pop("pending_coupon", None)
            notes.pop("pending_discount", None)

        # The order has settled, so the plan it was for is no longer pending —
        # it is the plan on the row. Leaving it parked would let a later
        # checkout that the clinic abandoned still look like an intent to buy.
        notes.pop("pending_plan", None)
        notes.pop("pending_checkout", None)
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

    def _order_banked(self, order_id: str) -> bool:
        """Has this order's money already been booked? The replay guard every
        settlement path asks first. Gateways retry webhooks, and the return page
        verifies the same order the webhook settles."""
        return self.db.query(SubscriptionPayment).filter(
            SubscriptionPayment.provider_order_id == order_id,
            SubscriptionPayment.status == "paid",
        ).first() is not None

    def _activate(self, sub: Subscription, *, bought: str, provider: str, payment_ref: Optional[str],
                  amount, paid_at: Optional[datetime] = None, gateway_ref: Optional[str] = None,
                  currency: Optional[str] = None, tax_amount: Optional[float] = None) -> None:
        """Money arrived for `sub.provider_order_id`: switch the plan on and bank it.

        The one place a paid order turns into a plan, for every gateway and for
        both the webhook and the return page. Callers check _order_banked first.

        `bought` is what they paid for, parked at checkout. `sub.plan_name` is
        still whatever they were on BEFORE paying, because opening a checkout no
        longer overwrites the live plan.
        """
        clinic = self.db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()

        # Compared in the order's OWN currency, plus tax, because that is what
        # was charged. Against a bare INR list price a perfectly good $4 order
        # looks like a 395-rupee shortfall.
        expected = self._plan_price(bought, clinic)
        expected = round(expected * (1 + plans.gst_rate(clinic)), 2)
        if amount and expected and float(amount) + 0.01 < expected:
            # Not fatal — coupons and partial promos legitimately pay less —
            # but it should never pass silently.
            logger.warning(
                f"{provider}: order {sub.provider_order_id} paid {amount} but {bought} lists {expected}"
            )

        sub.plan_name = bought
        sub.provider = provider
        sub.status = "active"
        sub.is_trial = False
        sub.trial_ends_at = None
        if gateway_ref:
            sub.provider_subscription_id = gateway_ref
        sub.current_start = datetime.utcnow()
        sub.current_end = self._billing_end(sub.plan_name, sub.current_start)

        if sub.user_id:
            from models import user_clinics
            stmt = self.db.query(Clinic).join(user_clinics).filter(user_clinics.c.user_id == sub.user_id)
            for owned in stmt.all():
                owned.subscription_plan = sub.plan_name
        elif clinic:
            clinic.subscription_plan = sub.plan_name

        self._log_payment(sub, payment_ref, amount, paid_at, currency=currency, tax_amount=tax_amount)
        self.db.commit()

        owner = self.db.query(User).filter(User.id == sub.user_id).first() if sub.user_id else None
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

    def verify_payment(self, user_id: int, order_id: str) -> Dict[str, Any]:
        """
        Verify payment status directly from provider (fallback for webhooks)
        """
        sub = self.db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.provider_order_id == order_id
        ).first()
        pending = ((sub.notes or {}).get("pending_checkout") or {}) if sub else {}
        if pending.get("gateway") == payment_gateways.DODO and pending.get("order_id") == order_id:
            return self._verify_dodo(sub, order_id, pending.get("session_id"))
        if sub and sub.provider == payment_gateways.DODO and self._order_banked(order_id):
            # A Dodo order the webhook settled before the clinic got back. Its
            # parked checkout is gone, and Cashfree has never heard of it.
            return {"success": True, "status": "PAID", "message": "Payment verified successfully"}

        try:
            order_data = self.provider.get_subscription(order_id)
            status = order_data.get("order_status")

            if status == "PAID":
                # `status != "active"` was the old guard, and it stops working
                # now that a checkout leaves the live plan alone: a clinic that
                # pays mid-trial is still 'active', so this path would decline
                # to apply the plan it just bought. Settle on whether the ORDER
                # has been banked instead, which is the same question
                # handle_webhook's replay guard asks.
                if sub and not self._order_banked(order_id):
                    self._activate(
                        sub,
                        bought=(sub.notes or {}).get("pending_plan") or sub.plan_name,
                        provider=payment_gateways.CASHFREE,
                        payment_ref=order_data.get("cf_order_id"),
                        amount=order_data.get("order_amount", 0),
                    )

                return {"success": True, "status": status, "message": "Payment verified successfully"}

            return {"success": False, "status": status, "message": f"Payment status: {status}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def _verify_dodo(self, sub: Subscription, order_id: str, session_id: Optional[str]) -> Dict[str, Any]:
        """The return page's check on a Dodo order, for when the webhook has
        not landed yet. Dodo is asked about its session, and then about the
        payment that session produced, which carries the amount and tax."""
        if self._order_banked(order_id):
            return {"success": True, "status": "PAID", "message": "Payment verified successfully"}
        try:
            session = self.dodo.get_checkout(session_id)
            status = session.get("payment_status")
            if status != "succeeded" or not session.get("payment_id"):
                return {"success": False, "status": status, "message": f"Payment status: {status}"}
            self._settle_dodo_payment(order_id, self.dodo.get_payment(session["payment_id"]), sub=sub)
            return {"success": True, "status": "PAID", "message": "Payment verified successfully"}
        except Exception as e:
            logger.exception("dodo verify failed for order %s", order_id)
            return {"success": False, "message": str(e)}

    def _settle_dodo_payment(self, order_id: str, payment: Dict[str, Any], sub: Optional[Subscription] = None) -> bool:
        """A succeeded Dodo payment for plan order `order_id`. Idempotent.

        Settles from the payment's own metadata, not from the row's parked
        notes, because the notes only ever describe the LATEST checkout. A
        clinic that opens a checkout, abandons it for another, then pays the
        first would otherwise be given the second one's plan, or nothing: the
        row's order id no longer matches. Dodo hands the metadata back signed.
        """
        from domains.finance.services.dodo.dodo_provider import from_minor

        if self._order_banked(order_id):
            logger.info(f"dodo: order {order_id} already processed, skipping")
            return True

        meta = payment.get("metadata") or {}
        if sub is None:
            sub = self.db.query(Subscription).filter(Subscription.provider_order_id == order_id).first()
        # A superseded order: find the row the way checkout found it.
        if sub is None and meta.get("user_id"):
            sub = self.db.query(Subscription).filter(Subscription.user_id == int(meta["user_id"])).first()
        if sub is None and meta.get("clinic_id"):
            sub = self.db.query(Subscription).filter(Subscription.clinic_id == int(meta["clinic_id"])).first()
        if sub is None:
            logger.error("dodo: paid order %s matches no subscription (metadata %s)", order_id, meta)
            return False

        bought = meta.get("plan") or (sub.notes or {}).get("pending_plan") or sub.plan_name

        # This order's coupon, from this order's metadata, parked where
        # _log_payment reads it.
        notes = dict(sub.notes or {})
        if meta.get("coupon"):
            notes["pending_coupon"] = meta["coupon"]
            notes["pending_discount"] = float(meta.get("discount") or 0)
        else:
            notes.pop("pending_coupon", None)
            notes.pop("pending_discount", None)
        sub.notes = notes
        sub.provider_order_id = order_id

        paid_at = None
        stamp = payment.get("updated_at") or payment.get("created_at")
        if stamp:
            try:
                aware = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
                paid_at = aware.replace(tzinfo=None) - (aware.utcoffset() or timedelta())
            except ValueError:
                paid_at = None

        self._activate(
            sub,
            bought=bought,
            provider=payment_gateways.DODO,
            payment_ref=payment.get("payment_id"),
            gateway_ref=payment.get("payment_id"),
            amount=from_minor(payment.get("total_amount")),
            paid_at=paid_at,
            currency=(payment.get("currency") or plans.USD).upper(),
            tax_amount=from_minor(payment.get("tax")),
        )
        return True

    def _tell_owner_payment_failed(self, order_id: str, error_msg: str) -> None:
        """The clinic gets no other signal that a payment failed: the plan
        deliberately stays as it was, so the screen looks the same as before
        they paid. Without this the first they know is a subscription that
        quietly never activated."""
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

    def handle_webhook(self, provider: str, payload: Dict[str, Any]):
        """
        Generic webhook handler
        """
        if provider == payment_gateways.DODO:
            return self._handle_dodo_webhook(payload)

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
                    # the activation — resetting current_start/current_end and
                    # handing out a fresh billing period for free. _log_payment
                    # already deduped the payment ROW, but nothing stopped the
                    # subscription itself being re-activated.
                    if self._order_banked(order_id):
                        logger.info(f"cashfree webhook replay for order {order_id} — already processed, skipping")
                        return True

                    paid_at = None
                    if payment_time:
                        try:
                            paid_at = datetime.fromisoformat(payment_time.replace("Z", "+00:00"))
                        except Exception:
                            pass

                    # Falls back to the row's own plan for orders created
                    # before `pending_plan` existed.
                    self._activate(
                        sub,
                        bought=(sub.notes or {}).get("pending_plan") or sub.plan_name,
                        provider=payment_gateways.CASHFREE,
                        payment_ref=cf_payment_id,
                        gateway_ref=cf_payment_id,
                        amount=payment_amount,
                        paid_at=paid_at,
                    )
                    return True

            elif order_id and payment_status == "FAILED":
                # Don't change subscription status — keep as pending so user can retry
                error_msg = payment_data.get("payment_message") or "Payment failed"
                print(f"PAYMENT FAILED: order={order_id} reason={error_msg}")
                self._tell_owner_payment_failed(order_id, error_msg)

        return False

    def _handle_dodo_webhook(self, payload: Dict[str, Any]) -> bool:
        """`payment.succeeded` settles the order, `payment.failed` tells the
        owner. Every other event (refunds, disputes, abandoned checkouts) is
        acknowledged and left for the dashboard, as Cashfree's are."""
        event = payload.get("type")
        payment = payload.get("data") or {}
        order_id = (payment.get("metadata") or {}).get("order_id")
        if not order_id:
            logger.info("dodo webhook %s carries no order id, ignoring", event)
            return False

        if event == "payment.succeeded":
            return self._settle_dodo_payment(order_id, payment)
        if event == "payment.failed":
            error_msg = payment.get("error_message") or "Payment failed"
            logger.info(f"dodo payment failed: order={order_id} reason={error_msg}")
            self._tell_owner_payment_failed(order_id, error_msg)
        return False
