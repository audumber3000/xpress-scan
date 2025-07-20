from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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
    pass

class PatientOut(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PatientResponse(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True 

class ScanTypeBase(BaseModel):
    name: str
    price: float

class ScanTypeCreate(ScanTypeBase):
    pass

class ScanTypeUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None

class ScanTypeOut(ScanTypeBase):
    id: int

    class Config:
        from_attributes = True 

class ReferringDoctorBase(BaseModel):
    name: str
    hospital: Optional[str] = None

class ReferringDoctorCreate(ReferringDoctorBase):
    pass

class ReferringDoctorUpdate(BaseModel):
    name: Optional[str] = None
    hospital: Optional[str] = None

class ReferringDoctorOut(ReferringDoctorBase):
    id: int
    class Config:
        from_attributes = True 

class ReportResponse(BaseModel):
    id: Optional[int] = None
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