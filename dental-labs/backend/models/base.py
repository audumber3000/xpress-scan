"""
SQLAlchemy base and shared mixins for Dental Labs models.
"""
import datetime
from sqlalchemy import Column, DateTime, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TimestampMixin:
    """Adds created_at and updated_at columns."""
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )


class SoftDeleteMixin:
    """Adds is_active flag for soft-delete support."""
    is_active = Column(Boolean, default=True, nullable=False)
