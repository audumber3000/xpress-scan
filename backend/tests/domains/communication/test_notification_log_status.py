"""A NotificationLog row has to end up saying what actually happened.

Every send is fire-and-forget: the row is written 'queued', the message is handed
to Nexus, and Nexus patches the real verdict back onto the row through the
callback_url. Two things used to go wrong around that. The dispatcher wrote
"sent" over whatever the callback had already put there, so a genuine provider
failure was reported as a success. And the platform service never wrote anything
after the handoff at all, so its rows stayed 'queued' for good whenever the
callback did not land — which is how 159 delivered messages came to look
unresolved in prod, 140 of them the signup welcome.

These drive the real functions against an in-memory database with notify()
stubbed, so what is asserted is what the row would actually say.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core import notification_dispatch
from core.notification_dispatch import notify_event
from domains.notification.services import platform_notification_service
from domains.notification.services.platform_notification_service import (
    PlatformNotificationService,
)
from models import (
    Base,
    Clinic,
    NotificationLog,
    NotificationPreference,
    NotificationWallet,
    User,
)


@pytest.fixture()
def Session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


@pytest.fixture()
def clinic(Session):
    """One clinic with WhatsApp enabled for the event and a funded wallet."""
    db = Session()
    c = Clinic(name="Status Clinic", email="s@c.com", specialization="dental",
               phone="9876543210", timezone="Asia/Kolkata", country="IN")
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add(NotificationPreference(clinic_id=c.id, event_type="appointment_booked",
                                  channels=["whatsapp"], is_enabled=True))
    db.add(NotificationWallet(clinic_id=c.id, balance=100.0))
    db.commit()
    cid = c.id
    db.close()
    return cid


@pytest.fixture(autouse=True)
def no_analytics(monkeypatch):
    monkeypatch.setattr(notification_dispatch, "track_event", lambda *a, **k: None)


def _row(Session, clinic_id):
    db = Session()
    try:
        return (db.query(NotificationLog)
                  .filter(NotificationLog.clinic_id == clinic_id,
                          NotificationLog.channel == "whatsapp")
                  .order_by(NotificationLog.id.desc())
                  .first())
    finally:
        db.close()


# ── The dispatcher ───────────────────────────────────────────────────────────

def test_dispatch_closes_the_row(monkeypatch, Session, clinic):
    """Nothing else touches the row, so the handoff itself closes it."""
    monkeypatch.setattr(notification_dispatch, "notify", lambda *a, **k: None)

    db = Session()
    notify_event("appointment_booked", db, clinic, to_phone="9876543210")
    db.close()

    assert _row(Session, clinic).status == "sent"


def test_dispatch_does_not_overwrite_a_callback_verdict(monkeypatch, Session, clinic):
    """A failure the callback already recorded must survive the handoff.

    In a sync context notify() blocks until Nexus has answered, and Nexus patches
    the row before it replies — so by the time the dispatcher gets to close the
    row, the truth is already sitting in it.
    """
    def fake_notify(*args, **kwargs):
        # Stand in for the Nexus callback: a separate session, as the real PATCH
        # arrives on its own request.
        cb = Session()
        log = cb.query(NotificationLog).get(kwargs["log_id"])
        log.status = "failed"
        log.error_message = "No WhatsApp template for event_type: appointment_booked"
        cb.commit()
        cb.close()

    monkeypatch.setattr(notification_dispatch, "notify", fake_notify)

    db = Session()
    notify_event("appointment_booked", db, clinic, to_phone="9876543210")
    db.close()

    row = _row(Session, clinic)
    assert row.status == "failed"
    assert "No WhatsApp template" in row.error_message


# ── The platform service ─────────────────────────────────────────────────────

def test_platform_send_does_not_leave_the_row_queued(monkeypatch, Session, clinic):
    monkeypatch.setattr(platform_notification_service, "notify", lambda *a, **k: None)

    db = Session()
    c = db.query(Clinic).get(clinic)
    result = PlatformNotificationService(db).send_whatsapp_event(
        c, "molarplus_app_welcome", template_data={"owner_name": "A", "clinic_name": c.name}
    )
    db.close()

    assert result.sent is True
    assert _row(Session, clinic).status == "sent"


def test_platform_send_does_not_overwrite_a_callback_verdict(monkeypatch, Session, clinic):
    def fake_notify(*args, **kwargs):
        cb = Session()
        log = cb.query(NotificationLog).get(kwargs["log_id"])
        log.status = "failed"
        log.error_message = "provider rejected the message"
        cb.commit()
        cb.close()

    monkeypatch.setattr(platform_notification_service, "notify", fake_notify)

    db = Session()
    c = db.query(Clinic).get(clinic)
    PlatformNotificationService(db).send_whatsapp_event(
        c, "molarplus_app_welcome", template_data={"owner_name": "A", "clinic_name": c.name}
    )
    db.close()

    assert _row(Session, clinic).status == "failed"
