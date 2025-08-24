from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import Clinic, User
from schemas import ClinicCreate, ClinicOut
from typing import List
import datetime
from auth import get_current_user

router = APIRouter()

@router.post("/", response_model=ClinicOut, status_code=status.HTTP_201_CREATED)
def create_clinic(clinic: ClinicCreate, db: Session = Depends(get_db)):
    """Create a new clinic"""
    try:
        db_clinic = Clinic(**clinic.dict())
        db.add(db_clinic)
        db.commit()
        db.refresh(db_clinic)
        return db_clinic
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{clinic_id}", response_model=ClinicOut)
def get_clinic(clinic_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get clinic by ID - scoped by user's clinic"""
    # Only allow access to user's own clinic
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic

@router.put("/{clinic_id}", response_model=ClinicOut)
def update_clinic(clinic_id: int, clinic: ClinicCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update clinic information - scoped by user's clinic"""
    # Only allow access to user's own clinic
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not db_clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    for field, value in clinic.dict().items():
        setattr(db_clinic, field, value)
    
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.delete("/{clinic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic(clinic_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete clinic (soft delete by setting status to cancelled) - scoped by user's clinic"""
    # Only allow access to user's own clinic
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not db_clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    db_clinic.status = "cancelled"
    db.commit()
    return {"message": "Clinic deleted successfully"}

@router.get("/{clinic_id}/users", response_model=List[dict])
def get_clinic_users(clinic_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all users for a clinic - scoped by user's clinic"""
    # Only allow access to user's own clinic
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    users = db.query(User).filter(User.clinic_id == clinic_id).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "permissions": user.permissions,
            "is_active": user.is_active,
            "created_at": user.created_at
        } for user in users
    ]

@router.get("/me", response_model=ClinicOut)
def get_my_clinic(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get current user's clinic information"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=404, detail="User not associated with any clinic")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    return clinic

@router.delete("/{clinic_id}/delete-all", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_and_all_data(clinic_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Permanently delete clinic and all associated data - only clinic owners can do this"""
    # Only allow clinic owners to delete the clinic
    if current_user.role != "clinic_owner":
        raise HTTPException(status_code=403, detail="Only clinic owners can delete the clinic")
    
    # Only allow access to user's own clinic
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    try:
        # Import all models needed for deletion
        from models import Patient, Report, ScanType, ReferringDoctor, User
        
        # Delete all patients
        patients_deleted = db.query(Patient).filter(Patient.clinic_id == clinic_id).delete()
        
        # Delete all reports
        reports_deleted = db.query(Report).filter(Report.clinic_id == clinic_id).delete()
        
        # Delete all scan types
        scan_types_deleted = db.query(ScanType).filter(ScanType.clinic_id == clinic_id).delete()
        
        # Delete all referring doctors
        referring_doctors_deleted = db.query(ReferringDoctor).filter(ReferringDoctor.clinic_id == clinic_id).delete()
        
        # Delete all users associated with this clinic
        users_deleted = db.query(User).filter(User.clinic_id == clinic_id).delete()
        
        # Finally, delete the clinic itself
        db.delete(clinic)
        
        db.commit()
        
        return {
            "message": "Clinic and all associated data deleted successfully",
            "deleted_items": {
                "patients": patients_deleted,
                "reports": reports_deleted,
                "scan_types": scan_types_deleted,
                "referring_doctors": referring_doctors_deleted,
                "users": users_deleted
            }
        }
        
    except Exception as e:
        db.rollback()

        raise HTTPException(status_code=500, detail=f"Failed to delete clinic: {str(e)}") 