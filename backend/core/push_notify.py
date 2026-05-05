"""
Convenience helper to send push notifications from anywhere in the backend.

Usage:
    from core.push_notify import push_to_clinic
    push_to_clinic(db, clinic_id, "New Appointment", "John Doe at 3:00 PM")
"""
from sqlalchemy.orm import Session
from domains.notification.services.push_service import push_service


def push_to_clinic(db: Session, clinic_id: int, title: str, body: str, data: dict = None):
    """Fire-and-forget push to all clinic devices. Never raises."""
    try:
        push_service.send_to_clinic(db, clinic_id, title, body, data)
    except Exception as e:
        print(f"[push_notify] Failed to send push: {e}")


def push_to_user(db: Session, user_id: int, title: str, body: str, data: dict = None):
    """Fire-and-forget push to a specific user's devices. Never raises."""
    try:
        push_service.send_to_user(db, user_id, title, body, data)
    except Exception as e:
        print(f"[push_notify] Failed to send push: {e}")
