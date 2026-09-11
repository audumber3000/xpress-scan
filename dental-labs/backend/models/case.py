"""
Case models — the heart of Dental Labs.

A Case is a single job order from a dentist client. It contains line items
(products), a status workflow with history, and file attachments.
"""
import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Case(Base, TimestampMixin):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)

    # Auto-generated: {prefix}-{year}-{seq:04d}  e.g. AB-2026-0001
    case_number = Column(String(20), nullable=False, unique=True, index=True)

    # Client & patient
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    doctor_name = Column(String(200), nullable=True)        # Specific doctor at the clinic
    patient_name = Column(String(200), nullable=True)       # Patient reference only
    patient_age = Column(Integer, nullable=True)
    patient_sex = Column(String(10), nullable=True)         # male | female | other

    # Dates
    received_date = Column(Date, default=datetime.date.today, nullable=False)
    due_date = Column(Date, nullable=True)

    # Priority & status
    priority = Column(String(10), default="normal", nullable=False)  # normal | rush
    status = Column(String(20), default="received", nullable=False, index=True)
    # Status values: received, in_production, ready, dispatched, delivered, on_hold, cancelled

    notes = Column(Text, nullable=True)
    total_amount = Column(Float, default=0.0, nullable=False)  # Sum of line items

    # Set when status transitions to "delivered" — billing keys the period off this
    delivered_at = Column(DateTime, nullable=True)

    # Billing linkage — which monthly statement billed this case (NULL = un-invoiced).
    # Prevents the same delivered case being billed twice.
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    invoiced_at = Column(DateTime, nullable=True)

    created_by = Column(Integer, ForeignKey("lab_users.id"), nullable=True)

    # Relationships
    lab = relationship("Lab", back_populates="cases")
    client = relationship("Client", back_populates="cases")
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    creator = relationship("LabUser", foreign_keys=[created_by])
    items = relationship("CaseItem", back_populates="case", cascade="all, delete-orphan")
    status_history = relationship(
        "CaseStatusHistory", back_populates="case", cascade="all, delete-orphan",
        order_by="CaseStatusHistory.changed_at.desc()"
    )
    attachments = relationship("CaseAttachment", back_populates="case", cascade="all, delete-orphan")


class CaseItem(Base, TimestampMixin):
    __tablename__ = "case_items"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    # Denormalised from product so changes to the catalog don't affect past cases
    product_name = Column(String(200), nullable=False)
    tooth_numbers = Column(JSON, nullable=True)    # Array of tooth numbers, e.g. [11, 12, 21]
    shade = Column(String(30), nullable=True)      # e.g. A2, A3.5
    material = Column(String(100), nullable=True)  # e.g. zirconia, PFM
    qty = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    line_total = Column(Float, default=0.0, nullable=False)  # qty × unit_price

    # Relationships
    case = relationship("Case", back_populates="items")
    product = relationship("Product")


class CaseStatusHistory(Base):
    __tablename__ = "case_status_history"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)

    from_status = Column(String(20), nullable=True)   # Null for initial entry
    to_status = Column(String(20), nullable=False)
    changed_by = Column(Integer, ForeignKey("lab_users.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    note = Column(Text, nullable=True)

    # Relationships
    case = relationship("Case", back_populates="status_history")
    user = relationship("LabUser", foreign_keys=[changed_by])


class CaseAttachment(Base):
    __tablename__ = "case_attachments"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)

    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=True)      # e.g. image/jpeg, model/stl
    file_size = Column(Integer, nullable=True)          # Bytes
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="attachments")
