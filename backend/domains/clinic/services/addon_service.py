"""
Buying, renewing and expiring add-ons (core.addons).

Its own rails beside SubscriptionService, on purpose. A plan checkout parks
`pending_plan` and `provider_order_id` on the owner's single `subscriptions`
row and the Cashfree webhook finds that row by order id. An add-on order that
shared the row would overwrite a plan checkout in progress, and a plan checkout
would overwrite the add-on. So add-on orders carry their own prefix (`ADD_`),
park on `clinic_addons`, and the routes hand any `ADD_` order here before the
plan code ever sees it. Plan checkout behaves exactly as it did.

Money is the same money: the same Cashfree account, the same GST, and the same
`subscription_payments` ledger, so billing history and invoices show add-ons
beside plans.
"""
import datetime as _dt
import logging
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from core import addons, plans

logger = logging.getLogger(__name__)

# Renewal reminders, in days before the end.
REMINDER_DAYS = (7, 3, 1)


class AddonError(ValueError):
    """A refusal meant for the clinic, e.g. 'this is included in your plan'."""


class AddonService:
    def __init__(self, db: Session, provider=None):
        self.db = db
        self._provider = provider

    @property
    def provider(self):
        if self._provider is None:
            from domains.finance.services.cashfree.cashfree_provider import CashfreeProvider
            self._provider = CashfreeProvider()
        return self._provider

    # ── rows ─────────────────────────────────────────────────────────────────
    def _row(self, clinic_id: int, key: str, create: bool = False):
        from models import ClinicAddon
        row = (
            self.db.query(ClinicAddon)
            .filter(ClinicAddon.clinic_id == clinic_id, ClinicAddon.addon_key == key)
            .first()
        )
        if row is None and create:
            row = ClinicAddon(clinic_id=clinic_id, addon_key=key, status=addons.STATUS_EXPIRED,
                              source=addons.SOURCE_PAID)
            self.db.add(row)
            self.db.flush()
        return row

    # ── checkout ─────────────────────────────────────────────────────────────
    def quote(self, clinic, key: str, cycle: str) -> dict:
        """What this clinic would pay for `key` on `cycle`, or AddonError."""
        item = addons.get(key)
        if not item:
            raise AddonError("That add-on does not exist.")
        if cycle not in addons.CYCLES:
            raise AddonError("Choose monthly or annual billing.")
        if item["availability"] != addons.LIVE:
            raise AddonError(f"{item['label']} is coming soon. We will let you know when it is ready.")
        currency = plans.billing_currency(clinic)
        base = addons.price(key, cycle, currency)
        if base is None:
            raise AddonError(
                "Add-ons are not available for clinics outside India yet. "
                "Message us and we will set it up for you."
            )
        if addons.included_by_plan(self.db, clinic, key):
            raise AddonError(f"{item['label']} is already included in your plan.")
        tax = round(base * plans.gst_rate(clinic), 2)
        return {
            "addon_key": key,
            "label": item["label"],
            "cycle": cycle,
            "currency": currency,
            "base": round(base, 2),
            "tax": tax,
            "amount": round(base + tax, 2),
        }

    def create_checkout(self, clinic, key: str, cycle: str, user_id: Optional[int]) -> dict:
        q = self.quote(clinic, key, cycle)
        order_id = addons.order_id(clinic.id, key, cycle, secrets.token_hex(3))

        import os
        base_return = os.getenv("CASHFREE_RETURN_URL", "http://localhost:5173/admin/subscription")
        sep = "&" if "?" in base_return else "?"
        res = self.provider.create_order(
            amount=q["amount"],
            customer_id=str(user_id or clinic.id),
            order_id=order_id,
            currency=q["currency"],
            notes={
                "clinic_name": clinic.name,
                "plan": f"Add-on: {q['label']} ({cycle})",
                "phone": clinic.phone or "",
                "email": clinic.email or "",
                "user_id": user_id,
                # Back to the Add-on Features tab, where the order is verified.
                "return_url": f"{base_return}{sep}tab=addons",
            },
        )
        session_id = res.get("payment_session_id") or (res.get("data") or {}).get("payment_session_id")
        if not session_id:
            logger.error("cashfree gave no payment_session_id for add-on order %s: %s", order_id, res)
            raise RuntimeError("The payment gateway did not start a session")

        # Parked, not applied: nothing about the add-on changes until money
        # arrives. A live add-on keeps running while its renewal is open.
        # Every open order is kept, not just the latest: a clinic can open a
        # checkout, abandon it, open another, and then pay the first one.
        row = self._row(clinic.id, key, create=True)
        row.provider_order_id = order_id
        open_orders = dict(row.pending or {})
        open_orders[order_id] = {"cycle": cycle, "user_id": user_id,
                                 "opened_at": _dt.datetime.utcnow().isoformat()}
        row.pending = dict(list(open_orders.items())[-10:])
        self.db.commit()

        return {
            "payment_session_id": session_id,
            "order_id": order_id,
            "provider": "cashfree",
            **q,
        }

    # ── settlement ───────────────────────────────────────────────────────────
    def settle(self, order_id: str, amount_paid: Optional[float], provider_payment_id: Optional[str],
               paid_at: Optional[_dt.datetime] = None) -> bool:
        """Money arrived for an add-on order: extend the add-on and book the payment.

        Idempotent. Cashfree retries webhooks and the return page verifies the
        same order, so a payment row already booked for this order means
        there is nothing left to do.
        """
        from models import ClinicAddon, Clinic, SubscriptionPayment

        already = (
            self.db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.provider_order_id == order_id, SubscriptionPayment.status == "paid")
            .first()
        )
        if already:
            return True

        parsed = addons.parse_order_id(order_id)
        if parsed is None:
            logger.error("add-on payment for an order id that does not parse: %s", order_id)
            return False
        clinic_id, key, cycle = parsed
        clinic = self.db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if clinic is None:
            logger.error("add-on payment %s for a clinic that does not exist", order_id)
            return False
        row = self._row(clinic_id, key, create=True)
        item = addons.get(key) or {}
        open_orders = dict(row.pending or {})
        pending = dict(open_orders.pop(order_id, None) or {})
        if not pending.get("user_id"):
            pending["user_id"] = self._owner_id(clinic_id)
        now = _dt.datetime.utcnow()

        expected_base = addons.price(row.addon_key, cycle, plans.billing_currency(clinic)) or 0.0
        expected = round(expected_base * (1 + plans.gst_rate(clinic)), 2)
        paid = float(amount_paid) if amount_paid else expected
        if expected and paid + 0.01 < expected:
            logger.warning("add-on order %s paid %s but lists %s", order_id, paid, expected)

        # Renewing early adds time to the end rather than throwing the rest away.
        running = row.status == addons.STATUS_ACTIVE and row.current_end and row.current_end > now
        start = row.current_end if running else now
        if not running:
            row.current_start = now
        row.current_end = addons.period_end(start, cycle)
        row.cycle = cycle
        row.status = addons.STATUS_ACTIVE
        row.source = addons.SOURCE_PAID
        row.provider_order_id = order_id
        row.pending = open_orders or None
        row.reminder_days_sent = None
        row.expiry_notified = False

        rate = plans.gst_rate(clinic)
        self.db.add(SubscriptionPayment(
            subscription_id=None,
            clinic_id=row.clinic_id,
            user_id=pending.get("user_id"),
            provider="cashfree",
            provider_order_id=order_id,
            provider_payment_id=provider_payment_id,
            plan_name=addons.payment_plan_name(row.addon_key, cycle),
            amount=paid,
            tax_amount=round(paid - paid / (1 + rate), 2) if rate else 0.0,
            currency=plans.billing_currency(clinic),
            status="paid",
            paid_at=paid_at or now,
            item_type="addon",
            addon_key=row.addon_key,
        ))

        if item.get("fulfilment") == addons.MANAGED and not row.support_ticket_id:
            row.service_status = addons.SERVICE_STEPS[0]
            row.support_ticket_id = self._open_service_ticket(clinic, item, pending.get("user_id"))

        self._tell_owner(
            clinic.id,
            event_type="addon_activated",
            title=f"{item.get('label', 'Add-on')} is active",
            body=self._activated_body(item, row),
            entity_id=row.id,
        )
        self.db.commit()

        try:
            from core.posthog_client import track_event
            track_event(f"clinic_{row.clinic_id}", "Add-on Paid",
                        {"addon": row.addon_key, "cycle": cycle, "amount": paid})
        except Exception:
            pass
        return True

    def _owner_id(self, clinic_id: int) -> Optional[int]:
        from models import User, user_clinics
        owner = (
            self.db.query(User)
            .join(user_clinics, user_clinics.c.user_id == User.id)
            .filter(user_clinics.c.clinic_id == clinic_id, user_clinics.c.role == "clinic_owner")
            .first()
        ) or self.db.query(User).filter(User.clinic_id == clinic_id, User.role == "clinic_owner").first()
        return owner.id if owner else None

    def _activated_body(self, item: dict, row) -> str:
        until = row.current_end.strftime("%-d %b %Y") if row.current_end else ""
        if item.get("fulfilment") == addons.MANAGED:
            return (f"Our team has your request and will be in touch within one working day. "
                    f"Active until {until}.")
        return f"Active until {until}."

    def _open_service_ticket(self, clinic, item: dict, user_id: Optional[int]) -> Optional[int]:
        """The work order for a managed add-on, in the support queue the team
        already works from."""
        from models import SupportTicket, SupportMessage
        now = _dt.datetime.utcnow()
        details = "\n".join(filter(None, [
            f"Clinic: {clinic.name} (id {clinic.id})",
            f"Phone: {clinic.phone}" if clinic.phone else "",
            f"Email: {clinic.email}" if clinic.email else "",
            f"Address: {clinic.address}" if getattr(clinic, "address", None) else "",
            "",
            f"The clinic bought {item['label']}. Ask them to add us as a manager on "
            "their Google Business Profile, then get their phone number, timings and "
            "details updated and approved. Move the add-on's service status along as "
            "you go: access_given, in_progress, done.",
        ]))
        ticket = SupportTicket(
            clinic_id=clinic.id,
            created_by=user_id,
            title=f"Add-on: {item['label']}",
            description=details,
            category="setup",
            priority="normal",
            status="open",
            created_at=now,
            updated_at=now,
        )
        self.db.add(ticket)
        self.db.flush()
        self.db.add(SupportMessage(ticket_id=ticket.id, sender_id=user_id, body=details,
                                   is_staff=False, created_at=now))
        return ticket.id

    def verify_order(self, order_id: str, clinic_ids) -> dict:
        """The return-page check, for when the webhook has not landed yet."""
        parsed = addons.parse_order_id(order_id)
        if parsed is None or parsed[0] not in set(clinic_ids):
            return {"success": False, "message": "Order not found"}
        order = self.provider.get_subscription(order_id)
        status = order.get("order_status")
        if status != "PAID":
            return {"success": False, "status": status, "message": f"Payment status: {status}"}
        self.settle(order_id, order.get("order_amount"), order.get("cf_order_id"))
        return {"success": True, "status": status, "message": "Payment verified successfully", "addon": True}

    def handle_webhook(self, payload: dict) -> bool:
        data = payload.get("data") or {}
        order_id = (data.get("order") or {}).get("order_id")
        payment = data.get("payment") or {}
        if not addons.is_addon_order(order_id):
            return False
        if payment.get("payment_status") != "SUCCESS":
            logger.info("add-on order %s payment %s", order_id, payment.get("payment_status"))
            return False
        paid_at = None
        if payment.get("payment_completion_time"):
            try:
                paid_at = _dt.datetime.fromisoformat(payment["payment_completion_time"].replace("Z", "+00:00"))
                paid_at = paid_at.replace(tzinfo=None) - (paid_at.utcoffset() or _dt.timedelta())
            except Exception:
                paid_at = None
        return self.settle(order_id, payment.get("payment_amount"), payment.get("cf_payment_id"), paid_at)

    # ── support ──────────────────────────────────────────────────────────────
    def grant(self, clinic, key: str, days: Optional[int] = None, until: Optional[_dt.datetime] = None,
              service_status: Optional[str] = None, commit: bool = True) -> "object":
        """Support's hand on the add-on: grant or extend it, or move a managed
        add-on's service status. Used by the CRM action API."""
        item = addons.get(key)
        if not item:
            raise AddonError("That add-on does not exist.")
        row = self._row(clinic.id, key, create=True)
        now = _dt.datetime.utcnow()
        if days or until:
            base = row.current_end if (row.status == addons.STATUS_ACTIVE and row.current_end and row.current_end > now) else now
            row.current_end = until or (base + _dt.timedelta(days=int(days)))
            if row.status != addons.STATUS_ACTIVE:
                row.current_start = now
            row.status = addons.STATUS_ACTIVE
            row.source = addons.SOURCE_SUPPORT
            row.reminder_days_sent = None
            row.expiry_notified = False
        if service_status is not None:
            if item["fulfilment"] != addons.MANAGED:
                raise AddonError(f"{item['label']} has no service status.")
            if service_status not in addons.SERVICE_STEPS:
                raise AddonError(f"service_status must be one of {', '.join(addons.SERVICE_STEPS)}")
            row.service_status = service_status
        if commit:
            self.db.commit()
        else:
            self.db.flush()
        return row

    # ── the hourly sweep ─────────────────────────────────────────────────────
    def sweep(self, now: Optional[_dt.datetime] = None) -> dict:
        """Renewal reminders at 7, 3 and 1 days, and the expiry itself.

        A clinic whose plan now includes the add-on hears nothing: its row
        running out changes nothing for it.
        """
        from models import ClinicAddon, Clinic
        now = now or _dt.datetime.utcnow()
        reminded = expired = 0
        rows = (
            self.db.query(ClinicAddon)
            .filter(ClinicAddon.status == addons.STATUS_ACTIVE, ClinicAddon.current_end.isnot(None))
            .filter(ClinicAddon.current_end <= now + _dt.timedelta(days=max(REMINDER_DAYS)))
            .all()
        )
        for row in rows:
            clinic = self.db.query(Clinic).filter(Clinic.id == row.clinic_id).first()
            item = addons.get(row.addon_key)
            if clinic is None or item is None:
                continue
            covered = addons.included_by_plan(self.db, clinic, row.addon_key)

            if row.current_end <= now:
                row.status = addons.STATUS_EXPIRED
                if not row.expiry_notified and not covered:
                    self._tell_owner(clinic.id, event_type="addon_expired",
                                     title=f"{item['label']} has ended",
                                     body=self._expired_body(item, row), entity_id=row.id,
                                     severity="action")
                    expired += 1
                row.expiry_notified = True
                self.db.commit()
                continue

            days_left = (row.current_end - now).total_seconds() / 86400
            due = [d for d in REMINDER_DAYS if days_left <= d]
            threshold = min(due) if due else None
            if threshold is None or covered:
                continue
            if row.reminder_days_sent is not None and row.reminder_days_sent <= threshold:
                continue
            self._tell_owner(clinic.id, event_type="addon_renewal_due",
                             title=self._reminder_title(item, row, threshold),
                             body=self._reminder_body(item, row), entity_id=row.id, severity="action")
            row.reminder_days_sent = threshold
            reminded += 1
            self.db.commit()

        lost = self._own_number_lost_access(now)
        return {"reminded": reminded, "expired": expired, "own_number_lost": lost}

    def _own_number_lost_access(self, now: _dt.datetime) -> int:
        """A clinic still linked to its own number that no longer pays for it.

        The add-on expiry above already says so for a clinic that bought or was
        granted the add-on. This catches the other way in: a Pro trial or plan
        that ended while the number was connected, which has no add-on row to
        expire. Said once a month at most, never repeatedly.
        """
        from models import WhatsAppIntegration, Clinic, Notification
        told = 0
        rows = self.db.query(WhatsAppIntegration).filter(WhatsAppIntegration.status == "connected").all()
        for integ in rows:
            clinic = self.db.query(Clinic).filter(Clinic.id == integ.clinic_id).first()
            if clinic is None or addons.entitled(self.db, clinic, "own_whatsapp", now):
                continue
            recent = (
                self.db.query(Notification.id)
                .filter(Notification.clinic_id == clinic.id,
                        Notification.event_type.in_(("own_number_not_included", "addon_expired")),
                        Notification.created_at >= now - _dt.timedelta(days=30))
                .first()
            )
            if recent:
                continue
            self._tell_owner(
                clinic.id, event_type="own_number_not_included",
                title="Your own WhatsApp number is paused",
                body=("Your plan no longer includes sending from your own number, so patient messages "
                      "are going out from the MolarPlus number. Add it for your clinic from Subscription, "
                      "Add-on Features, or move to Pro where it is included."),
                severity="action",
            )
            self.db.commit()
            told += 1
        return told

    def _reminder_title(self, item: dict, row, days: int) -> str:
        when = "tomorrow" if days <= 1 else f"in {days} days"
        what = "free period" if row.source == addons.SOURCE_GRACE else "add-on"
        return f"Your {item['label']} {what} ends {when}"

    def _reminder_body(self, item: dict, row) -> str:
        until = row.current_end.strftime("%-d %b %Y")
        if row.addon_key == "own_whatsapp":
            extra = (" After that, patient messages go out from the MolarPlus number again."
                     " Renew it, or move to Pro where it is included.")
        else:
            extra = " Renew it from Subscription, Add-on Features."
        return f"It runs until {until}.{extra}"

    def _expired_body(self, item: dict, row) -> str:
        if row.addon_key == "own_whatsapp":
            return ("Patient messages are going out from the MolarPlus number again. "
                    "Add it back from Subscription, Add-on Features, or move to Pro where it is included.")
        return "Add it back any time from Subscription, Add-on Features."

    def _tell_owner(self, clinic_id: int, *, event_type: str, title: str, body: str,
                    entity_id: Optional[int] = None, severity: str = "info") -> None:
        try:
            from domains.notification.services.notification_center_service import notify, OWNER
            notify(self.db, clinic_id=clinic_id, event_type=event_type, title=title, body=body,
                   link="/admin/subscription?tab=addons", severity=severity, audience=OWNER,
                   entity_type="clinic_addon", entity_id=entity_id)
        except Exception:
            logger.exception("could not notify clinic %s about %s", clinic_id, event_type)
