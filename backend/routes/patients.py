from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient
from schemas import PatientCreate, PatientOut
from typing import List
from schemas import PatientResponse

router = APIRouter()

@router.options("/")
def options_patients():
    """Handle OPTIONS requests for CORS preflight"""
    return {"message": "OK"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=List[PatientResponse])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all patients for dropdown selection"""
    patients = db.query(Patient).offset(skip).limit(limit).all()
    return [
        PatientResponse(
            id=patient.id,
            name=patient.name,
            age=patient.age,
            gender=patient.gender,
            village=patient.village,
            phone=patient.phone,
            referred_by=patient.referred_by,
            scan_type=patient.scan_type,
            notes=patient.notes,
            created_at=patient.created_at
        ) for patient in patients
    ]

@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient (only save to database, no Google Doc generation)"""
    try:
        db_patient = Patient(**patient.dict())
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        
        return PatientOut(
            id=db_patient.id,
            name=db_patient.name,
            age=db_patient.age,
            gender=db_patient.gender,
            village=db_patient.village,
            phone=db_patient.phone,
            referred_by=db_patient.referred_by,
            scan_type=db_patient.scan_type,
            notes=db_patient.notes,
            created_at=db_patient.created_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 

@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, patient: PatientCreate, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for field, value in patient.dict().items():
        setattr(db_patient, field, value)
    db.commit()
    db.refresh(db_patient)
    return db_patient 