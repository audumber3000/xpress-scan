from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

# Clinic Schemas
class ClinicBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: str = "radiology"
    subscription_plan: str = "free"
    status: str = "active"
    logo_url: Optional[str] = None
    primary_color: str = "#10B981"

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
    referred_by: str
    scan_type: str
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

# Scan Type Schemas
class ScanTypeBase(BaseModel):
    name: str
    price: float
    is_active: bool = True

class ScanTypeCreate(ScanTypeBase):
    clinic_id: Optional[int] = None

class ScanTypeUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None

class ScanTypeOut(ScanTypeBase):
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

# Report Schemas
class ReportResponse(BaseModel):
    id: Optional[int] = None
    clinic_id: int
    patient_name: str
    patient_age: int
    patient_gender: str
    scan_type: str
    referred_by: str
    docx_url: Optional[str] = None
    pdf_url: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True 