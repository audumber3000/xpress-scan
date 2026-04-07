from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import Medication, User
from core.dtos import MedicationCreateDTO, MedicationUpdateDTO, MedicationResponseDTO
from core.auth_utils import get_current_user
from typing import List, Optional
from sqlalchemy import or_

router = APIRouter(prefix="/medications", tags=["medications"])

@router.get("", response_model=List[MedicationResponseDTO])
def get_medications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all medications available to the clinic.
    This includes system-wide medications (clinic_id is NULL)
    and medications specific to the user's clinic.
    """
    clinic_id = current_user.clinic_id
    medications = db.query(Medication).filter(
        or_(
            Medication.clinic_id == clinic_id,
            Medication.clinic_id == None
        ),
        Medication.is_active == True
    ).all()
    return medications

@router.post("", response_model=MedicationResponseDTO, status_code=status.HTTP_201_CREATED)
def create_medication(
    medication: MedicationCreateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new medication for the clinic."""
    db_medication = Medication(
        **medication.model_dump(),
        clinic_id=current_user.clinic_id
    )
    db.add(db_medication)
    db.commit()
    db.refresh(db_medication)
    return db_medication

@router.put("/{medication_id}", response_model=MedicationResponseDTO)
def update_medication(
    medication_id: int,
    medication_update: MedicationUpdateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a medication."""
    db_medication = db.query(Medication).filter(
        Medication.id == medication_id,
        Medication.clinic_id == current_user.clinic_id
    ).first()

    if not db_medication:
        # Check if they are trying to update a system medication
        system_med = db.query(Medication).filter(
            Medication.id == medication_id,
            Medication.clinic_id == None
        ).first()
        
        if system_med:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System medications cannot be modified. Please create a clinic-specific medication instead."
            )
        
        raise HTTPException(status_code=404, detail="Medication not found")

    update_data = medication_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_medication, key, value)

    db.commit()
    db.refresh(db_medication)
    return db_medication

@router.delete("/{medication_id}")
def delete_medication(
    medication_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete a medication."""
    db_medication = db.query(Medication).filter(
        Medication.id == medication_id,
        Medication.clinic_id == current_user.clinic_id
    ).first()

    if not db_medication:
         # Check if they are trying to delete a system medication
        system_med = db.query(Medication).filter(
            Medication.id == medication_id,
            Medication.clinic_id == None
        ).first()
        
        if system_med:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System medications cannot be deleted."
            )
        raise HTTPException(status_code=404, detail="Medication not found")

    db_medication.is_active = False
    db.commit()
    return {"message": "Medication deleted successfully"}
