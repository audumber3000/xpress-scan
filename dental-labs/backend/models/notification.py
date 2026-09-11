"""
NotificationLog model.

One row per attempted send (per channel). Replaces the Phase 1 in-memory mock
list — gives support a persistent, queryable record of what was sent, to whom,
and whether it succeeded.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Index

from models.base import Base, TimestampMixin


class NotificationLog(Base, TimestampMixin):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)

    event_type = Column(String(40), nullable=False)   # case_received | case_dispatched | ...
    channel = Column(String(20), nullable=False)       # whatsapp | email
    recipient = Column(String(255), nullable=False)    # phone or email
    template_name = Column(String(80), nullable=True)  # WA template used (null for email)

    status = Column(String(20), nullable=False, default="queued")  # queued | sent | failed
    error = Column(Text, nullable=True)                 # failure reason / "not configured"
    provider_response = Column(Text, nullable=True)     # truncated provider payload for support

    __table_args__ = (
        Index("ix_notification_logs_lab_created", "lab_id", "created_at"),
    )
