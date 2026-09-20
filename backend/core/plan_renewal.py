"""
Renewal reminders for paid plans: 7, 3 and 1 days before the period ends.

Plans do not renew by themselves. Every payment is a one-off Cashfree order, so
a clinic that bought a month is locked when the month runs out unless it comes
back and pays again, and until now the only warning was a header strip in the
last three days. Every renewal is a fresh decision to leave, and the least we
owe a paying clinic is enough notice to make it on purpose.

In-app (bell, plus a push to the owner's phone). A WhatsApp version needs an
approved template and is not sent until one exists.

Paid plans only. Trials have their own lifecycle, and the migration grant is
not a purchase. Each threshold is said once per billing period: the period's
end date is remembered with the reminder, so paying again (which moves the end
date) starts the count afresh.
"""
import datetime as dt
from typing import Optional

from core import plans

REMINDER_DAYS = (7, 3, 1)
PAID_PROVIDERS = ("cashfree", "razorpay")


def _clinic_for(db, sub) -> Optional[int]:
    if sub.clinic_id:
        return sub.clinic_id
    if sub.user_id:
        from models import User
        owner = db.query(User).filter(User.id == sub.user_id).first()
        return getattr(owner, "clinic_id", None)
    return None


def send_due(db, now: Optional[dt.datetime] = None) -> int:
    from models import Subscription
    from domains.notification.services.notification_center_service import notify, OWNER, SEVERITY_ACTION

    now = now or dt.datetime.utcnow()
    horizon = now + dt.timedelta(days=max(REMINDER_DAYS))
    subs = (
        db.query(Subscription)
        .filter(Subscription.status == "active",
                Subscription.is_trial.isnot(True),
                Subscription.provider.in_(PAID_PROVIDERS),
                Subscription.current_end.isnot(None),
                Subscription.current_end > now,
                Subscription.current_end <= horizon)
        .all()
    )
    sent = 0
    for sub in subs:
        clinic_id = _clinic_for(db, sub)
        if not clinic_id:
            continue
        days_left = (sub.current_end - now).total_seconds() / 86400
        threshold = min(d for d in REMINDER_DAYS if days_left <= d)
        notes = dict(sub.notes or {})
        last = notes.get("renewal_reminded") or {}
        same_period = last.get("end") == sub.current_end.isoformat()
        if same_period and last.get("days") is not None and last["days"] <= threshold:
            continue

        label = plans.label(sub.plan_name)
        when = "tomorrow" if threshold <= 1 else f"in {threshold} days"
        ends = sub.current_end.strftime("%-d %b")
        notify(
            db, clinic_id=clinic_id, event_type="plan_renewal_due",
            severity=SEVERITY_ACTION, audience=OWNER,
            title=f"Your {label} plan ends {when}",
            body=(f"It runs until {ends}. Pay again before then to keep adding patients and "
                  "appointments without a break. Nothing is charged automatically."),
            link="/admin/subscription",
            entity_type="subscription", entity_id=sub.id,
        )
        notes["renewal_reminded"] = {"end": sub.current_end.isoformat(), "days": threshold}
        sub.notes = notes
        db.commit()
        sent += 1
    return sent
