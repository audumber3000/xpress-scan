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