"""
Client model — the dentist/clinic that sends work to the lab.

Key truth: the lab's customer is the dentist, not the patient.
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)

    # Dentist / clinic info
    name = Column(String(200), nullable=False)               # Dentist name (primary contact)
    clinic_name = Column(String(200), nullable=True)          # Clinic/practice name
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    tax_id = Column(String(50), nullable=True)                # Client's GST/VAT number

    # Pricing (Phase 1: unused — single tier)
    default_price_tier = Column(String(30), default="standard", nullable=False)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    lab = relationship("Lab", back_populates="clients")
    cases = relationship("Case", back_populates="client")
