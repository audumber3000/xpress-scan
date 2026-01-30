"""
Data Transfer Objects for API requests and responses
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# Patient DTOs
class PatientBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)
    gender: str = Field(..., pattern="^(male|female|other|Male|Female|Other)$")
    village: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    referred_by: str = Field(..., min_length=1, max_length=100)
    treatment_type: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = None
    payment_type: str = Field(default="Cash", pattern="^(Cash|Card|UPI|Online)$")
    
    @field_validator('gender', mode='before')
    @classmethod
    def normalize_gender(cls, v):
        """Normalize gender values to lowercase for validation and storage"""
        if isinstance(v, str):
            return v.lower()
        return v


class PatientCreateDTO(PatientBaseDTO):
    pass


class PatientUpdateDTO(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    village: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    referred_by: Optional[str] = Field(None, min_length=1, max_length=100)
    treatment_type: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = None
    payment_type: Optional[str] = Field(None, pattern="^(Cash|Card|UPI|Online)$")
    dental_chart: Optional[Dict[str, Any]] = None
    tooth_notes: Optional[Dict[str, Any]] = None
    treatment_plan: Optional[List[Dict[str, Any]]] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None


class PatientResponseDTO(PatientBaseDTO):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    dental_chart: Optional[Dict[str, Any]] = None
    tooth_notes: Optional[Dict[str, Any]] = None
    treatment_plan: Optional[List[Dict[str, Any]]] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True


class PatientSummaryDTO(BaseModel):
    id: int
    name: str
    phone: str
    age: int
    gender: str
    treatment_type: str
    last_visit: Optional[datetime] = None


# Clinic DTOs
class ClinicBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    gst_number: Optional[str] = None
    specialization: str = "dental"
    subscription_plan: str = "free"
    logo_url: Optional[str] = None
    primary_color: str = "#10B981"


class ClinicCreateDTO(ClinicBaseDTO):
    pass


class ClinicUpdateDTO(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    gst_number: Optional[str] = None
    specialization: Optional[str] = None
    subscription_plan: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    timings: Optional[dict] = None


class ClinicResponseDTO(ClinicBaseDTO):
    id: int
    status: str = "active"
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    timings: Optional[dict] = None

    class Config:
        from_attributes = True


# User DTOs
class UserBaseDTO(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(..., pattern="^(clinic_owner|doctor|receptionist)$")


class UserCreateDTO(UserBaseDTO):
    password: str = Field(..., min_length=8)
    clinic_id: Optional[int] = None


class UserUpdateDTO(BaseModel):
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(clinic_owner|doctor|receptionist)$")


class UserResponseDTO(UserBaseDTO):
    id: int
    name: str  # computed field
    clinic_id: Optional[int] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True


# Payment DTOs
class PaymentBaseDTO(BaseModel):
    patient_id: int = Field(..., gt=0)
    report_id: Optional[int] = None
    treatment_type_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., pattern="^(Cash|Card|PayPal|Net Banking|UPI)$")
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None


class PaymentCreateDTO(PaymentBaseDTO):
    pass


class PaymentResponseDTO(PaymentBaseDTO):
    id: int
    clinic_id: int
    status: str = "success"
    received_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True


# Auth DTOs
class LoginRequestDTO(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=1)
    device: Optional[Dict[str, Any]] = None


class RegisterRequestDTO(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(..., pattern="^(clinic_owner|doctor|receptionist)$")


class OAuthRequestDTO(BaseModel):
    id_token: str = Field(..., min_length=1)
    device: Optional[Dict[str, Any]] = None
    role: Optional[str] = Field(None, pattern="^(clinic_owner|doctor|receptionist)$")


class ChangePasswordRequestDTO(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class AuthResponseDTO(BaseModel):
    message: str
    user: UserResponseDTO
    token: str
    clinic: Optional[ClinicResponseDTO] = None


class DeviceInfoDTO(BaseModel):
    device_name: str
    device_type: str
    device_platform: str
    device_os: str
    device_serial: str
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None


# Common response DTOs
class PaginatedResponseDTO(BaseModel):
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 100
    total_pages: int = 1


class ErrorResponseDTO(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponseDTO(BaseModel):
    message: str
    data: Optional[Any] = None