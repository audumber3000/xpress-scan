"""
Data Transfer Objects for API requests and responses
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


# Patient DTOs
class PatientBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = Field(None, pattern="^(male|female|other|Male|Female|Other)$")
    village: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    referred_by: Optional[str] = Field(None, min_length=1, max_length=100)
    treatment_type: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = None
    payment_type: Optional[str] = Field(default="Cash", pattern="^(Cash|Card|UPI|Online)$")
    
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
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
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
    number_of_chairs: int = 1


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
    number_of_chairs: Optional[int] = None
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
    permissions: Dict[str, Any] = {}
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    signature_url: Optional[str] = None
    clinics: List[ClinicResponseDTO] = []

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


class OAuthCodeRequestDTO(BaseModel):
    """Used by desktop app: exchange authorization code for id_token."""
    code: str = Field(..., min_length=1)
    redirect_uri: str = Field(..., min_length=1)
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

# Vendor DTOs
class VendorBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    category: Optional[str] = "General"
    last_order_date: Optional[datetime] = None

class VendorCreateDTO(VendorBaseDTO):
    pass

class VendorUpdateDTO(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class VendorResponseDTO(VendorBaseDTO):
    id: int
    clinic_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Inventory DTOs
class InventoryItemBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None
    quantity: float = 0.0
    unit: Optional[str] = None
    min_stock_level: float = 0.0
    price_per_unit: float = 0.0

class InventoryItemCreateDTO(InventoryItemBaseDTO):
    vendor_id: Optional[int] = None

class InventoryItemUpdateDTO(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_stock_level: Optional[float] = None
    price_per_unit: Optional[float] = None
    vendor_id: Optional[int] = None

class InventoryItemResponseDTO(InventoryItemBaseDTO):
    id: int
    clinic_id: int
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Consent DTOs
class ConsentTemplateBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)

class ConsentTemplateCreateDTO(ConsentTemplateBaseDTO):
    pass

class ConsentTemplateUpdateDTO(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None

class ConsentTemplateResponseDTO(ConsentTemplateBaseDTO):
    id: int
    clinic_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PatientConsentCreateDTO(BaseModel):
    template_id: int
    signed_content: str
    signature_url: Optional[str] = None

class PatientConsentResponseDTO(BaseModel):
    id: int
    patient_id: int
    template_id: int
    template_name: str
    signed_content: str
    signature_url: Optional[str] = None
    signed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Document DTOs
class PatientDocumentResponseDTO(BaseModel):
    id: int
    patient_id: int
    clinic_id: int
    case_paper_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    uploader_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExternalDocumentRequestDTO(BaseModel):
    clinic_id: int
    file_name: str
    file_path: str
    file_size: Optional[int] = 0
    file_type: Optional[str] = "pdf"

class UnifiedFileResponseDTO(BaseModel):
    id: int
    patient_id: int
    clinic_id: int
    case_paper_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: Optional[int] = 0
    file_type: str
    uploader_name: Optional[str] = "System"
    created_at: datetime
    category: str  # 'document' or 'report'

    class Config:
        from_attributes = True


# Prescription DTOs
class PrescriptionItemDTO(BaseModel):
    medicine_name: str
    dosage: str  # e.g., "1-0-1"
    duration: str  # e.g., "5 days"
    quantity: str
    notes: Optional[str] = None


class PrescriptionRequestDTO(BaseModel):
    items: List[PrescriptionItemDTO]
    notes: Optional[str] = None


class PrescriptionPDFResponseDTO(BaseModel):
    pdf_url: str
    file_name: str


# Medication DTOs
class MedicationBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    dosage: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: str = "General"

class MedicationCreateDTO(MedicationBaseDTO):
    pass

class MedicationUpdateDTO(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class MedicationResponseDTO(MedicationBaseDTO):
    id: int
    clinic_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Template Configuration DTOs
class TemplateConfigBase(BaseModel):
    category: str
    template_id: str
    logo_url: Optional[str] = None
    footer_text: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None

class TemplateConfigCreate(TemplateConfigBase):
    pass

class TemplateConfigUpdate(BaseModel):
    template_id: Optional[str] = None
    logo_url: Optional[str] = None
    footer_text: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None

class TemplateConfigResponse(TemplateConfigBase):
    id: Optional[int] = None
    clinic_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True