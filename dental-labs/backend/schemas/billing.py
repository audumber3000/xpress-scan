"""
Pydantic schemas for billing — invoices, statements, payments.
"""
import datetime
from pydantic import BaseModel, Field


class StatementGenerateRequest(BaseModel):
    client_id: int
    period_start: datetime.date
    period_end: datetime.date
    tax_rate: float = Field(default=0.0, ge=0, le=100)  # Percentage


class InvoiceLineItemResponse(BaseModel):
    id: int
    case_id: int | None = None
    description: str
    qty: float
    unit_price: float
    amount: float

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    client_id: int
    client_name: str | None = None
    period_start: datetime.date
    period_end: datetime.date
    subtotal: float
    tax_rate: float
    tax_amount: float
    total: float
    paid_amount: float
    due_amount: float
    status: str
    pdf_path: str | None = None
    notes: str | None = None
    line_items: list[InvoiceLineItemResponse] = []
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceResponse]
    total: int


class PaymentCreateRequest(BaseModel):
    client_id: int
    invoice_id: int | None = None
    amount: float = Field(..., gt=0)
    method: str = "cash"  # cash, upi, bank_transfer, card, cheque, other
    reference_number: str | None = None
    paid_at: datetime.datetime | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: int
    client_id: int
    client_name: str | None = None
    invoice_id: int | None = None
    amount: float
    method: str
    reference_number: str | None = None
    paid_at: datetime.datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    payments: list[PaymentResponse]
    total: int


class OutstandingResponse(BaseModel):
    client_id: int
    client_name: str | None = None
    total_billed: float
    total_paid: float
    outstanding: float       # money owed on live invoices (single source of truth)
    unbilled: float = 0.0    # delivered work not yet on a statement
