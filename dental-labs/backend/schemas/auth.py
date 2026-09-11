"""
Pydantic schemas for authentication.
"""
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class AuthResponse(BaseModel):
    token: str
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    name: str
    role: str
    is_active: bool
    lab_id: int | None = None
    lab: "LabBrief | None" = None

    model_config = {"from_attributes": True}


class LabBrief(BaseModel):
    """Minimal lab info returned with auth responses."""
    id: int
    name: str
    country: str
    currency_code: str
    currency_symbol: str
    timezone: str
    tax_label: str
    case_number_prefix: str
    logo_url: str | None = None
    subscription_plan: str

    model_config = {"from_attributes": True}


# Resolve forward references
AuthResponse.model_rebuild()
UserResponse.model_rebuild()
