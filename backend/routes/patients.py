from fastapi import APIRouter, Depends, HTTPException, status, Path, Request
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient, Payment, ScanType
from schemas import PatientCreate, PatientOut
from typing import List
from schemas import PatientResponse
from auth import get_current_user, get_current_clinic, require_patients_view, require_patients_edit, require_patients_delete
from datetime import datetime


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
def get_patients(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view)
):
    """Get all patients for current clinic"""
    patients = db.query(Patient).filter(
        Patient.clinic_id == current_user.clinic_id
    ).offset(skip).limit(limit).all()
    
    return [
        PatientResponse(
            id=patient.id,
            clinic_id=patient.clinic_id,
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
def create_patient(
    patient: PatientCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit)
):
    """Create a new patient for current clinic and automatically create payment record"""
    try:
        print(f"Creating patient with data: {patient.dict()}")
        
        # Set clinic_id from current user
        patient_data = patient.dict()
        patient_data['clinic_id'] = current_user.clinic_id
        
        print(f"Final patient data: {patient_data}")
        

        
        # Create patient first
        db_patient = Patient(**patient_data)
        db.add(db_patient)
        db.flush()  # Flush to get the patient ID without committing
        
        # Find scan type to get price
        scan_type = db.query(ScanType).filter(
            ScanType.clinic_id == current_user.clinic_id,
            ScanType.name == patient.scan_type
        ).first()
        
        # Calculate amount (use scan type price if found, otherwise default)
        amount = scan_type.price if scan_type else 1000.0  # Default amount if scan type not found
        
        # Create payment record automatically
        payment_record = Payment(
            clinic_id=current_user.clinic_id,
            patient_id=db_patient.id,
            scan_type_id=scan_type.id if scan_type else None,
            amount=amount,
            payment_method=patient.payment_type,  # Use the payment_type from patient form
            status="pending",  # Start as pending, staff can update when payment received
            paid_by=patient.name,
            received_by=current_user.id,
            notes=f"Payment for {patient.scan_type}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(payment_record)
        db.commit()
        db.refresh(db_patient)
        
        print(f"✅ Created patient {db_patient.name} with automatic payment record (Amount: ${amount})")
        
        return PatientOut(
            id=db_patient.id,
            clinic_id=db_patient.clinic_id,
            name=db_patient.name,
            age=db_patient.age,
            gender=db_patient.gender,
            village=db_patient.village,
            phone=db_patient.phone,
            referred_by=db_patient.referred_by,
            scan_type=db_patient.scan_type,
            notes=db_patient.notes,
            payment_type=db_patient.payment_type,
            created_at=db_patient.created_at
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating patient and payment: {e}")
        
        # Check if it's a unique constraint violation
        if "duplicate key value violates unique constraint" in str(e):
            raise HTTPException(
                status_code=409, 
                detail="A patient with this information already exists. Please check the details and try again."
            )
        
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}")

@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int, 
    patient: PatientCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit)
):
    """Update patient (only if belongs to current clinic)"""
    db_patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    for field, value in patient.dict().items():
        if field != 'clinic_id':  # Don't allow changing clinic_id
            setattr(db_patient, field, value)
    
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_delete)
):
    """Delete patient (only if belongs to current clinic)"""
    db_patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    db.delete(db_patient)
    db.commit()
    return {"message": "Patient deleted successfully"} 

@router.get("/villages/")
def get_unique_villages(
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view)
):
    """Get unique villages from existing patients for autocomplete"""
    villages = db.query(Patient.village).filter(
        Patient.clinic_id == current_user.clinic_id,
        Patient.village.isnot(None),
        Patient.village != ""
    ).distinct().all()
    
    # Extract village names from the query result
    village_list = [village[0] for village in villages if village[0]]
    
    return {"villages": village_list} 