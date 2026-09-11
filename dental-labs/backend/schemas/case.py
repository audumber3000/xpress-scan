"""
Pydantic schemas for case management — the heart of the product.
"""
import datetime
from pydantic import BaseModel, Field


# ── Case Item (line item) ──────────────────────────────────────────────

class CaseItemCreate(BaseModel):
    product_id: int | None = None
    product_name: str = Field(..., min_length=1, max_length=200)
    tooth_numbers: list[int] | None = None
    shade: str | None = None
    material: str | None = None
    qty: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0.0, ge=0)


class CaseItemUpdate(BaseModel):
    product_name: str | None = None
    tooth_numbers: list[int] | None = None
    shade: str | None = None
    material: str | None = None
    qty: int | None = Field(default=None, ge=1)
    unit_price: float | None = Field(default=None, ge=0)


class CaseItemResponse(BaseModel):
    id: int
    product_id: int | None = None
    product_name: str
    tooth_numbers: list[int] | None = None
    shade: str | None = None
    material: str | None = None
    qty: int
    unit_price: float
    line_total: float

    model_config = {"from_attributes": True}


# ── Case ────────────────────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    client_id: int
    doctor_name: str | None = None
    patient_name: str | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    received_date: datetime.date | None = None
    due_date: datetime.date | None = None
    priority: str = "normal"  # normal | rush
    notes: str | None = None
    items: list[CaseItemCreate] = []


class CaseUpdateRequest(BaseModel):
    doctor_name: str | None = None
    patient_name: str | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    due_date: datetime.date | None = None
    priority: str | None = None
    notes: str | None = None


class CaseStatusUpdate(BaseModel):
    status: str  # Target status
    note: str | None = None


class StatusHistoryEntry(BaseModel):
    id: int
    from_status: str | None = None
    to_status: str
    changed_by: int | None = None
    changed_by_name: str | None = None
    changed_at: datetime.datetime
    note: str | None = None

    model_config = {"from_attributes": True}


class AttachmentResponse(BaseModel):
    id: int
    file_name: str
    file_path: str
    file_type: str | None = None
    file_size: int | None = None
    uploaded_at: datetime.datetime

    model_config = {"from_attributes": True}


class CaseResponse(BaseModel):
    id: int
    case_number: str
    client_id: int
    client_name: str | None = None
    clinic_name: str | None = None
    doctor_name: str | None = None
    patient_name: str | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    received_date: datetime.date
    due_date: datetime.date | None = None
    priority: str
    status: str
    notes: str | None = None
    total_amount: float
    items: list[CaseItemResponse] = []
    status_history: list[StatusHistoryEntry] = []
    attachments: list[AttachmentResponse] = []
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    cases: list[CaseResponse]
    total: int


# Valid status transitions
VALID_STATUS_TRANSITIONS = {
    "received": ["in_production", "on_hold", "cancelled"],
    "in_production": ["ready", "on_hold", "cancelled"],
    "ready": ["dispatched", "on_hold", "cancelled"],
    "dispatched": ["delivered", "on_hold", "cancelled"],
    "delivered": [],  # Terminal state
    "on_hold": ["received", "in_production", "ready", "dispatched", "cancelled"],
    "cancelled": [],  # Terminal state
}

ALL_STATUSES = list(VALID_STATUS_TRANSITIONS.keys())
