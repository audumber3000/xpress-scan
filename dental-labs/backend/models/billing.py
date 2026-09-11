"""
Billing models — invoices (monthly statements) and payments.

A lab bills its clients monthly. Each invoice rolls up all delivered
cases for a client in a given period.
"""
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Text, ForeignKey
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)

    # Auto-generated: INV-{year}-{seq:04d}
    invoice_number = Column(String(20), nullable=False, unique=True, index=True)

    # Billing period
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Amounts
    subtotal = Column(Float, default=0.0, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False)       # Percentage, e.g. 18.0 for 18% GST
    tax_amount = Column(Float, default=0.0, nullable=False)
    total = Column(Float, default=0.0, nullable=False)
    paid_amount = Column(Float, default=0.0, nullable=False)
    due_amount = Column(Float, default=0.0, nullable=False)

    status = Column(String(20), default="draft", nullable=False)
    # Status values: draft, sent, partially_paid, paid, cancelled

    pdf_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    lab = relationship("Lab")
    client = relationship("Client")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)

    description = Column(String(300), nullable=False)
    qty = Column(Float, default=1.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    amount = Column(Float, default=0.0, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)

    amount = Column(Float, nullable=False)
    method = Column(String(30), nullable=False, default="cash")
    # Methods: cash, upi, bank_transfer, card, cheque, other

    reference_number = Column(String(100), nullable=True)  # UTR, cheque no., txn ID
    paid_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    lab = relationship("Lab")
    client = relationship("Client")
    invoice = relationship("Invoice", back_populates="payments")
