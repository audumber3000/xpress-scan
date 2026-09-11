"""
Pydantic schemas for lab profile and onboarding.
"""
from pydantic import BaseModel, Field


class LabOnboardingRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    country: str = Field(default="IN", min_length=2, max_length=2)
    tax_id: str | None = None
    case_number_prefix: str = Field(default="DL", min_length=1, max_length=5)


class LabUpdateRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    tax_id: str | None = None
    case_number_prefix: str | None = Field(default=None, min_length=1, max_length=5)
    logo_url: str | None = None
    # Per-event channel toggles: {"case_received": ["whatsapp","email"], ...}
    notification_settings: dict[str, list[str]] | None = None


class LabResponse(BaseModel):
    id: int
    name: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    country: str
    currency_code: str
    currency_symbol: str
    timezone: str
    tax_label: str
    tax_id: str | None = None
    case_number_prefix: str
    logo_url: str | None = None
    subscription_plan: str
    notification_settings: dict[str, list[str]] | None = None

    model_config = {"from_attributes": True}


class StaffCreateRequest(BaseModel):
    email: str
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)


class StaffUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None


class StaffResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}
