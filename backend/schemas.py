from pydantic import BaseModel
from typing import Optional, Dict, Any, List
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
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

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
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
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
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True

class PatientResponse(PatientBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
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
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

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
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
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
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
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

# Invoice Schemas
class InvoiceLineItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    amount: Optional[float] = None  # Will be calculated as quantity * unit_price

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemOut(InvoiceLineItemBase):
    id: int
    invoice_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    patient_id: int
    visit_id: Optional[int] = None
    payment_mode: Optional[str] = None
    utr: Optional[str] = None
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    payment_mode: Optional[str] = None
    utr: Optional[str] = None
    notes: Optional[str] = None

class InvoiceOut(InvoiceBase):
    id: int
    clinic_id: int
    invoice_number: str
    status: str  # draft, paid_unverified, paid_verified, cancelled
    subtotal: float
    tax: float
    total: float
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    paid_at: Optional[datetime] = None
    
    # Nested patient info
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    
    # Line items
    line_items: List[InvoiceLineItemOut] = []
    
    class Config:
        from_attributes = True

class MarkAsPaidRequest(BaseModel):
    payment_mode: str  # UPI, Cash, Card, etc.
    utr: Optional[str] = None

# X-ray Image Schemas
class XrayImageCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    image_type: str  # 'bitewing', 'panoramic', 'periapical', 'occlusal', 'ceph', etc.
    notes: Optional[str] = None
    brightness: Optional[float] = None
    contrast: Optional[float] = None

class XrayImageOut(BaseModel):
    id: int
    patient_id: int
    appointment_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    image_type: str
    capture_date: datetime
    brightness: Optional[float] = None
    contrast: Optional[float] = None
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    # Nested patient info
    patient_name: Optional[str] = None
    
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
    updated_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

# Subscription Schemas
class SubscriptionBase(BaseModel):
    plan_name: str
    status: str = "active"

class SubscriptionOut(SubscriptionBase):
    id: int
    clinic_id: int
    razorpay_subscription_id: Optional[str] = None
    razorpay_customer_id: Optional[str] = None
    razorpay_plan_id: Optional[str] = None
    current_start: Optional[datetime] = None
    current_end: Optional[datetime] = None
    quantity: int = 1
    notes: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

class SubscriptionCreate(BaseModel):
    plan_name: str  # professional, enterprise
    razorpay_plan_id: str

class SubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[Dict[str, Any]] = None

# Attendance Schemas
class AttendanceBase(BaseModel):
    user_id: int
    date: datetime
    status: str  # on_time, late, absent, holiday
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AttendanceOut(AttendanceBase):
    id: int
    clinic_id: int
    marked_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    
    class Config:
        from_attributes = True

# Message Template Schemas
class MessageTemplateBase(BaseModel):
    name: str  # e.g., "welcome", "invoice"
    title: str  # Display name
    content: str  # Template content
    variables: Optional[List[str]] = []  # Available variables
    is_active: bool = True

class MessageTemplateCreate(MessageTemplateBase):
    clinic_id: Optional[int] = None

class MessageTemplateUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None

class MessageTemplateOut(MessageTemplateBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True 
