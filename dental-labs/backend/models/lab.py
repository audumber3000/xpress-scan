"""
Lab and LabUser models.

Lab is the top-level tenant — all other entities belong to a lab.
LabUser represents anyone who can log in and interact with the system.
"""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


def default_notification_settings() -> dict:
    """Per-event channel toggles applied to a lab at onboarding.

    Maps event_type -> list of enabled channels. WhatsApp on for the moments a
    dentist cares about; statement delivery defaults to email.
    """
    return {
        "case_received": ["whatsapp"],
        "case_dispatched": ["whatsapp"],
        "case_delivered": [],
        "statement_ready": ["email"],
    }


class Lab(Base, TimestampMixin):
    __tablename__ = "labs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Internationalisation — set at onboarding based on country
    country = Column(String(2), default="IN", nullable=False)          # ISO 3166-1 alpha-2
    currency_code = Column(String(3), default="INR", nullable=False)   # ISO 4217
    currency_symbol = Column(String(5), default="₹", nullable=False)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)  # IANA
    tax_label = Column(String(30), default="GST No.", nullable=False)  # GST, VAT, TRN, Tax ID
    tax_id = Column(String(50), nullable=True)                         # Actual tax registration number

    # Case numbering — 2-letter prefix + year + auto-increment
    case_number_prefix = Column(String(5), default="DL", nullable=False)

    # Branding / subscription
    logo_url = Column(String(500), nullable=True)
    subscription_plan = Column(String(30), default="free", nullable=False)

    # Per-event notification channel toggles — see default_notification_settings()
    notification_settings = Column(JSON, nullable=False, default=default_notification_settings)

    # Relationships
    users = relationship("LabUser", back_populates="lab", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="lab", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="lab", cascade="all, delete-orphan")
    cases = relationship("Case", back_populates="lab", cascade="all, delete-orphan")


class LabUser(Base, TimestampMixin):
    __tablename__ = "lab_users"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=True)  # Null until onboarding
    email = Column(String(255), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)  # Computed: first_name + last_name
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="lab_owner")  # lab_owner | lab_staff
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    lab = relationship("Lab", back_populates="users")
