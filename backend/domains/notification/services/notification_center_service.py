"""
The clinic's in-app notification centre.

One entry point, `notify()`, used from wherever something worth telling the
clinic about happens. Everything else in this module exists to keep that call
site a single line.

Not to be confused with its two neighbours:

* ``platform_notification_service`` sends WhatsApp/email to clinic OWNERS about
  their subscription. Outbound, paid, and a different audience.
* the MSG91 path in ``notification_admin`` sends WhatsApp/email to PATIENTS.

This one writes rows a staff member reads inside the app, and optionally pushes
to their phone. It never sends a WhatsApp or an email, so nothing here costs
the clinic money or can be throttled by a provider.
"""
import datetime as dt
import logging
from typing import Iterable, Optional, Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import Notification, PushToken, User, user_clinics

logger = logging.getLogger(__name__)

# Severity decides reach, not just colour. `info` waits in the bell until
# somebody looks; the other two are considered worth interrupting a phone for.
SEVERITY_INFO = "info"
SEVERITY_ACTION = "action"
SEVERITY_CRITICAL = "critical"

_PUSH_WORTHY = (SEVERITY_ACTION, SEVERITY_CRITICAL)

# Audience shorthands, so call sites say who cares rather than enumerating roles.
OWNER = ("clinic_owner",)
FRONT_DESK = ("clinic_owner", "receptionist")
EVERYONE = ("clinic_owner", "receptionist", "doctor")


def _recipients(
    db: Session,
    clinic_id: int,
    roles: Sequence[str],
    actor_user_id: Optional[int],
) -> list[User]:
    """Active users at this clinic holding one of `roles`.

    Membership is read two ways on purpose. `users.clinic_id` is the user's
    current clinic, while `user_clinics` is the multi-branch membership table,
    and staff at a clinic with branches may be attached by either. Missing one
    of them means a receptionist silently stops receiving anything the day the
    clinic adds its second branch.
    """
    rows = (
        db.query(User)
        .outerjoin(user_clinics, user_clinics.c.user_id == User.id)
        .filter(
            User.is_active == True,  # noqa: E712 - SQLAlchemy needs the comparison
            User.role.in_(list(roles)),
            or_(
                User.clinic_id == clinic_id,
                user_clinics.c.clinic_id == clinic_id,
            ),
        )
        .all()
    )

    # De-duplicated here rather than with SELECT DISTINCT. The join can return a
    # user twice (matched by users.clinic_id AND by a user_clinics row), but
    # `users` carries JSON columns and Postgres has no equality operator for
    # json, so DISTINCT over the whole entity raises. It fails at query time,
    # which the guard below would have turned into "0 recipients" and a bell
    # that silently never fills.
    seen: set[int] = set()
    users: list[User] = []
    for user in rows:
        if user.id not in seen:
            seen.add(user.id)
            users.append(user)

    # Nobody needs telling about the thing they just did. This is the single
    # biggest source of notification noise in most apps: the receptionist who
    # records a payment does not want "payment recorded" a second later.
    if actor_user_id is not None:
        users = [u for u in users if u.id != actor_user_id]
    return users


def _collapse_into(
    db: Session,
    user_id: int,
    event_type: str,
    entity_type: Optional[str],
    entity_id: Optional[int],
    window_minutes: int,
) -> Optional[Notification]:
    """Find an unread row this event should fold into, if there is one.

    Only ever collapses UNREAD rows. Once somebody has read "2 new bookings",
    a third booking is genuinely new information and deserves its own line
    rather than silently mutating something they already looked at.
    """
    cutoff = dt.datetime.utcnow() - dt.timedelta(minutes=window_minutes)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.event_type == event_type,
            Notification.entity_type == entity_type,
            Notification.entity_id == entity_id,
            Notification.read_at.is_(None),
            Notification.created_at >= cutoff,
        )
        .order_by(Notification.created_at.desc())
        .first()
    )


def _push(db: Session, user_ids: Iterable[int], title: str, body: str, link: Optional[str]) -> None:
    """Best-effort push. A dead Expo token must never fail the business action.

    The write that triggered this (a booking, a payment) is already committed
    by the time anyone would notice a push problem, so raising here would turn
    "the phone did not buzz" into "the appointment did not save".
    """
    user_ids = [u for u in user_ids if u]
    if not user_ids:
        return
    try:
        # Imported lazily: this module is pulled in by route files at import
        # time, and PushService reaches for network config it does not need
        # unless something is actually being sent.
        from domains.notification.services.push_service import PushService

        # One query beats one per user when nobody has registered a device.
        has_tokens = (
            db.query(PushToken.user_id)
            .filter(PushToken.user_id.in_(user_ids), PushToken.is_active == True)  # noqa: E712
            .first()
        )
        if not has_tokens:
            return

        service = PushService()
        for uid in user_ids:
            service.send_to_user(db, uid, title, body or "", {"link": link} if link else {})
    except Exception:
        logger.exception("push fan-out failed (notification rows were still written)")


def notify(
    db: Session,
    *,
    clinic_id: int,
    event_type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    severity: str = SEVERITY_INFO,
    audience: Sequence[str] = OWNER,
    actor_user_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    collapse_minutes: Optional[int] = None,
    push: bool = True,
) -> int:
    """Tell the clinic something. Returns how many people were told.

    Deliberately does NOT commit. The caller owns the transaction, so a
    notification cannot survive a business action that later rolls back, and
    an appointment and its notification land together or not at all.

    `collapse_minutes` folds a repeat of the same event on the same entity into
    one unread row with a count, which is what keeps ten walk-in bookings from
    burying everything else in the bell.
    """
    if not clinic_id:
        return 0

    try:
        users = _recipients(db, clinic_id, audience, actor_user_id)
    except Exception:
        # A notification is never worth breaking the action that caused it.
        logger.exception("could not resolve recipients for %s", event_type)
        return 0

    if not users:
        return 0

    pushed_to: list[int] = []
    for user in users:
        existing = (
            _collapse_into(db, user.id, event_type, entity_type, entity_id, collapse_minutes)
            if collapse_minutes
            else None
        )
        if existing is not None:
            existing.count = (existing.count or 1) + 1
            existing.title = title
            existing.body = body
            existing.link = link
            # Bumped so the folded row returns to the top of the list, where a
            # thing that just happened again belongs.
            existing.created_at = dt.datetime.utcnow()
        else:
            db.add(
                Notification(
                    clinic_id=clinic_id,
                    user_id=user.id,
                    event_type=event_type,
                    severity=severity,
                    title=title,
                    body=body,
                    link=link,
                    entity_type=entity_type,
                    entity_id=entity_id,
                )
            )
        pushed_to.append(user.id)

    db.flush()

    if push and severity in _PUSH_WORTHY:
        _push(db, pushed_to, title, body or "", link)

    return len(pushed_to)
