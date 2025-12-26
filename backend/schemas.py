from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

# Clinic Schemas
class ClinicBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    specialization: str = "dental"
    subscription_plan: str = "free"
    status: str = "active"
    logo_url: Optional[str] = None
    primary_color: str = "#10B981"
    timings: Optional[Dict[str, Any]] = {
        'monday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'tuesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'wednesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'thursday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'friday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'saturday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'sunday': {'open': '08:00', 'close': '20:00', 'closed': True}
    }

class ClinicCreate(ClinicBase):
    pass

class ClinicOut(ClinicBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "receptionist"  # clinic_owner, doctor, receptionist
    permissions: Optional[Dict[str, Any]] = {}

class UserCreate(UserBase):
    clinic_id: Optional[int] = None
    created_by: Optional[int] = None

class UserOut(UserBase):
    id: int
    clinic_id: Optional[int] = None
    created_by: Optional[int] = None
    is_active: bool
    created_at: datetime
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    supabase_user_id: Optional[str] = None

    class Config:
        from_attributes = True

# Patient Schemas
class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    village: str
    phone: str
    referred_by: Optional[str] = None
    treatment_type: str
    notes: Optional[str] = None
    payment_type: str = "Cash"

class PatientCreate(PatientBase):
    clinic_id: Optional[int] = None

class PatientOut(PatientBase):
    id: int
    clinic_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PatientResponse(PatientBase):
    id: int
    clinic_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True 

# Treatment Type Schemas
class TreatmentTypeBase(BaseModel):
    name: str
    price: float
    is_active: bool = True

class TreatmentTypeCreate(TreatmentTypeBase):
    clinic_id: Optional[int] = None

class TreatmentTypeUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None

class TreatmentTypeOut(TreatmentTypeBase):
    id: int
    clinic_id: int

    class Config:
        from_attributes = True 

# Referring Doctor Schemas
class ReferringDoctorBase(BaseModel):
    name: str
    hospital: Optional[str] = None
    is_active: bool = True

class ReferringDoctorCreate(ReferringDoctorBase):
    clinic_id: Optional[int] = None

class ReferringDoctorUpdate(BaseModel):
    name: Optional[str] = None
    hospital: Optional[str] = None
    is_active: Optional[bool] = None

class ReferringDoctorOut(ReferringDoctorBase):
    id: int
    clinic_id: int
    
    class Config:
        from_attributes = True 

# Payment Schemas
class PaymentBase(BaseModel):
    patient_id: int
    report_id: Optional[int] = None
    treatment_type_id: Optional[int] = None
    amount: float
    payment_method: str
    status: str = "success"  # Default to success for new payments
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    received_by: Optional[int] = None

class PaymentCreate(PaymentBase):
    clinic_id: Optional[int] = None

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    received_by: Optional[int] = None

class PaymentOut(PaymentBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    
    # Nested patient info for frontend display
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    
    # Nested treatment type info
    treatment_type_name: Optional[str] = None
    
    # Nested received by user info  
    received_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Report Schemas
class ReportResponse(BaseModel):
    id: Optional[int] = None
    clinic_id: int
    patient_name: str
    patient_age: int
    patient_gender: str
    treatment_type: str
    referred_by: str
    docx_url: Optional[str] = None
    pdf_url: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True 

# WhatsApp Configuration Schemas
class WhatsAppConfigBase(BaseModel):
    api_key: str
    phone_number: Optional[str] = None
    is_active: bool = True

class WhatsAppConfigCreate(WhatsAppConfigBase):
    pass

class WhatsAppConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

class WhatsAppConfigResponse(WhatsAppConfigBase):
    id: int
    user_id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True 