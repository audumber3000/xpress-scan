"""
Pydantic schemas for client management.
"""
import datetime
from pydantic import BaseModel, Field


class ClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    clinic_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class ClientUpdateRequest(BaseModel):
    name: str | None = None
    clinic_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ClientResponse(BaseModel):
    id: int
    name: str
    clinic_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    is_active: bool
    outstanding_balance: float = 0.0  # Due on live invoices (computed at query time)
    unbilled: float = 0.0             # Delivered work not yet invoiced
    case_count: int = 0               # Total cases ever sent by this client
    open_case_count: int = 0          # Cases not yet delivered/cancelled
    last_case_date: datetime.date | None = None  # Most recent case received_date

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int
