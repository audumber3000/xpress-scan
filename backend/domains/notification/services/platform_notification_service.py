import datetime as dt
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from core.nexus_notify import notify
from core.phone import normalize_phone
from models import Clinic, LabOrder, NotificationLog, Subscription, User

logger = logging.getLogger(__name__)


def _owner_name(owner: Optional[User], clinic: Clinic) -> str:
    if owner:
        return owner.first_name or owner.name or owner.email.split("@")[0]
    return clinic.name


def _get_owner_for_clinic(db: Session, clinic_id: int) -> Optional[User]:
    return (
        db.query(User)
        .filter(User.clinic_id == clinic_id, User.role == "clinic_owner", User.is_active == True)
        .order_by(User.created_at.asc())
        .first()
    )


@dataclass
class SendResult:
    sent: bool
    reason: str = ""


class PlatformNotificationService:
    def __init__(self, db: Session):
        self.db = db

    def _already_sent(
        self,
        clinic_id: int,
        event_type: str,
        recipient: str,
        channel: str,
        not_before: dt.datetime,
    ) -> bool:
        existing = (
            self.db.query(NotificationLog.id)
            .filter(
                NotificationLog.clinic_id == clinic_id,
                NotificationLog.event_type == event_type,
                NotificationLog.recipient == recipient,
                NotificationLog.channel == channel,
                NotificationLog.created_at >= not_before,
            )
            .first()
        )
        return existing is not None

    def _queue_log(
        self,
        clinic_id: int,
        event_type: str,
        recipient: str,
        channel: str,
    ) -> NotificationLog:
        now = dt.datetime.utcnow()
        log_entry = NotificationLog(
            clinic_id=clinic_id,
            channel=channel,
            recipient=recipient,
            event_type=event_type,
            template_name=event_type,
            status="queued",
            cost=0.0,
            created_at=now,
            updated_at=now,
        )
        self.db.add(log_entry)
        self.db.commit()
        self.db.refresh(log_entry)
        return log_entry

    def send_whatsapp_event(
        self,
        clinic: Clinic,
        event_type: str,
        template_data: Optional[dict] = None,
        not_before: Optional[dt.datetime] = None,
    ) -> SendResult:
        recipient = normalize_phone(clinic.phone, getattr(clinic, "country", None))
        if not recipient:
            return SendResult(False, "missing clinic phone")

        window_start = not_before or (dt.datetime.utcnow() - dt.timedelta(days=1))
        if self._already_sent(clinic.id, event_type, recipient, "whatsapp", window_start):
            return SendResult(False, "already sent in dedupe window")

        log_entry = self._queue_log(clinic.id, event_type, recipient, "whatsapp")
        notify(
            event_type,
            channel="whatsapp",
            to_phone=recipient,
            template_data=template_data or {},
            log_id=log_entry.id,
        )
        return SendResult(True)

    def send_email_event(
        self,
        clinic: Clinic,
        owner: User,
        event_type: str,
        template_data: Optional[dict] = None,
        not_before: Optional[dt.datetime] = None,
    ) -> SendResult:
        recipient = owner.email if owner else ""
        if not recipient:
            return SendResult(False, "missing owner email")

        window_start = not_before or (dt.datetime.utcnow() - dt.timedelta(days=1))
        if self._already_sent(clinic.id, event_type, recipient, "email", window_start):
            return SendResult(False, "already sent in dedupe window")

        log_entry = self._queue_log(clinic.id, event_type, recipient, "email")
        notify(
            event_type,
            channel="email",
            to_email=recipient,
            to_name=_owner_name(owner, clinic),
            template_data=template_data or {},
            log_id=log_entry.id,
        )
        return SendResult(True)

    def send_welcome_notifications(self, clinic: Clinic, owner: User) -> dict:
        template_data = {
            "owner_name": _owner_name(owner, clinic),
            "clinic_name": clinic.name,
        }
        results = {
            "whatsapp": self.send_whatsapp_event(clinic, "molarplus_app_welcome", template_data=template_data),
            "email": self.send_email_event(clinic, owner, "molarplus_app_welcome", template_data=template_data),
        }
        return {channel: result.sent for channel, result in results.items()}

    def send_subscription_confirmed_notifications(self, clinic: Clinic, owner: Optional[User], plan_name: str, valid_until: Optional[dt.datetime]) -> dict:
        owner_name = _owner_name(owner, clinic)
        whatsapp_data = {
            "owner_name": owner_name,
            "clinic_name": clinic.name,
            "plan_name": plan_name,
            "valid_until": valid_until.strftime("%d %b %Y") if valid_until else "",
        }
        results = {
            "whatsapp": self.send_whatsapp_event(clinic, "molarplus_subscription_confirmed", template_data=whatsapp_data),
        }
        if owner:
            results["email"] = self.send_email_event(
                clinic,
                owner,
                "molarplus_subscription_confirmed",
                template_data={
                    "owner_name": owner_name,
                    "clinic_name": clinic.name,
                    "plan_name": plan_name,
                    "valid_until": valid_until.strftime("%d %b %Y") if valid_until else "Active",
                },
            )
        return {channel: result.sent for channel, result in results.items()}

    def send_wallet_topup_notifications(self, clinic: Clinic, owner: Optional[User], amount: float, new_balance: float) -> dict:
        owner_name = _owner_name(owner, clinic)
        whatsapp_data = {
            "owner_name": owner_name,
            "clinic_name": clinic.name,
            "amount": f"{amount:.2f}",
            "new_balance": f"{new_balance:.2f}",
        }
        results = {
            "whatsapp": self.send_whatsapp_event(clinic, "molarplus_topup_success", template_data=whatsapp_data),
        }
        if owner:
            results["email"] = self.send_email_event(
                clinic,
                owner,
                "molarplus_topup_success",
                template_data={
                    "owner_name": owner_name,
                    "clinic_name": clinic.name,
                    "amount": f"{amount:.2f}",
                    "new_balance": f"{new_balance:.2f}",
                },
            )
        return {channel: result.sent for channel, result in results.items()}

    def run_automation(self, now: Optional[dt.datetime] = None) -> dict:
        # Weekly/monthly/review summaries are handled by their own dedicated cron
        # jobs (weekly_summary_broadcast, monthly_summary_broadcast) — see
        # backend/core/scheduler.py. This hourly job only handles trial nudges
        # and lab-due reminders.
        now = now or dt.datetime.utcnow()
        today = now.date()
        summary = {
            "trial_messages": 0,
            "lab_due_tomorrow": 0,
        }

        # ── Trial nudges (t2/t3/t4) off the subscription's real trial window ──
        # t1 is sent immediately at activation by the start-trial endpoint.
        # provider == "trial" keeps converted/paid clinics out of these nudges.
        trial_subs = (
            self.db.query(Subscription, Clinic)
            .join(Clinic, Clinic.id == Subscription.clinic_id)
            .filter(
                Subscription.provider == "trial",
                Subscription.trial_used == True,
                Subscription.current_start.isnot(None),
                Subscription.current_end.isnot(None),
                or_(Clinic.status.is_(None), ~Clinic.status.in_(["suspended", "cancelled"])),
            )
            .all()
        )

        for sub, clinic in trial_subs:
            start = sub.current_start.date()
            end = sub.current_end.date()
            day = (today - start).days
            total = max((end - start).days, 1)
            mid_day = max(1, total // 2)

            if (today - end).days == 1:           # day after it ended → t4
                event = "molarplus_account_update_t4"
            elif (end - today).days == 1:          # one day before it ends → t3
                event = "molarplus_account_update_t3"
            elif day == mid_day and today < end:   # mid-trial → t2
                event = "molarplus_account_update_t2"
            else:
                continue

            owner = _get_owner_for_clinic(self.db, clinic.id)
            data = {} if event == "molarplus_account_update_t4" else {
                "owner_name": _owner_name(owner, clinic)
            }
            sent_trial = self.send_whatsapp_event(
                clinic,
                event,
                template_data=data,
                not_before=dt.datetime.combine(today, dt.time.min),
            )
            summary["trial_messages"] += int(sent_trial.sent)

        tomorrow = today + dt.timedelta(days=1)
        tomorrow_start = dt.datetime.combine(tomorrow, dt.time.min)
        day_after_start = tomorrow_start + dt.timedelta(days=1)
        due_orders = (
            self.db.query(LabOrder, Clinic)
            .join(Clinic, Clinic.id == LabOrder.clinic_id)
            .filter(
                LabOrder.due_date >= tomorrow_start,
                LabOrder.due_date < day_after_start,
                ~LabOrder.status.in_(["Completed", "Cancelled"]),
                or_(Clinic.status.is_(None), ~Clinic.status.in_(["suspended", "cancelled"])),
            )
            .all()
        )

        notified_clinics: set[int] = set()
        for lab_order, clinic in due_orders:
            if clinic.id in notified_clinics:
                continue
            owner = _get_owner_for_clinic(self.db, clinic.id)
            lab_name = lab_order.vendor.name if lab_order.vendor else "Lab"
            patient_name = lab_order.patient.name if lab_order.patient else "Patient"
            order_date = lab_order.created_at.strftime("%d %b %Y") if lab_order.created_at else ""
            sent = self.send_whatsapp_event(
                clinic,
                "molarplus_lab_due_tomorrow_mk",
                template_data={
                    "owner_name": _owner_name(owner, clinic),
                    "lab_name": lab_name,
                    "order_date": order_date,
                    "patient_name": patient_name,
                },
                not_before=dt.datetime.combine(today, dt.time.min),
            )
            if sent.sent:
                notified_clinics.add(clinic.id)
                summary["lab_due_tomorrow"] += 1

        return summary


def run_platform_notification_automation(db: Session, now: Optional[dt.datetime] = None) -> dict:
    service = PlatformNotificationService(db)
    return service.run_automation(now=now)
