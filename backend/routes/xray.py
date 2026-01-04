from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from models import XrayImage, Patient, Appointment, User
from schemas import XrayImageCreate, XrayImageOut
from auth import get_current_user
from typing import List, Optional
import os
import shutil
import datetime
from pathlib import Path

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/xray")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload", response_model=XrayImageOut, status_code=status.HTTP_201_CREATED)
async def upload_xray_image(
    file: UploadFile = File(...),
    patient_id: int = Form(...),
    appointment_id: Optional[int] = Form(None),
    image_type: str = Form(...),
    notes: Optional[str] = Form(None),
    brightness: Optional[float] = Form(None),
    contrast: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload a DICOM X-ray image"""
    
    # Verify patient belongs to current clinic
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Verify appointment if provided
    if appointment_id:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.patient_id == patient_id
        ).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Validate file extension (should be .dcm for DICOM)
    if not file.filename.endswith('.dcm'):
        raise HTTPException(status_code=400, detail="Only DICOM (.dcm) files are supported")
    
    try:
        # Create patient-specific directory
        patient_dir = UPLOAD_DIR / str(patient_id)
        patient_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        if appointment_id:
            filename = f"{appointment_id}_{timestamp}.dcm"
        else:
            filename = f"{timestamp}.dcm"
        
        file_path = patient_dir / filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        
        # Create database record
        xray_image = XrayImage(
            clinic_id=current_user.clinic_id,
            patient_id=patient_id,
            appointment_id=appointment_id,
            file_path=str(file_path),
            file_name=filename,  # Use generated filename
            file_size=file_size,
            image_type=image_type,
            capture_date=datetime.datetime.utcnow(),
            brightness=brightness,
            contrast=contrast,
            notes=notes,
            created_by=current_user.id
        )
        
        db.add(xray_image)
        db.commit()
        db.refresh(xray_image)
        
        # Enrich with patient name
        result = XrayImageOut(
            id=xray_image.id,
            patient_id=xray_image.patient_id,
            appointment_id=xray_image.appointment_id,
            file_name=xray_image.file_name,
            file_path=xray_image.file_path,
            file_size=xray_image.file_size,
            image_type=xray_image.image_type,
            capture_date=xray_image.capture_date,
            brightness=xray_image.brightness,
            contrast=xray_image.contrast,
            notes=xray_image.notes,
            created_by=xray_image.created_by,
            created_at=xray_image.created_at,
            patient_name=patient.name
        )
        
        return result
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error uploading X-ray image: {str(e)}")

@router.get("/patient/{patient_id}", response_model=List[XrayImageOut])
def get_patient_xrays(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all X-ray images for a patient"""
    # Verify patient belongs to current clinic
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    xray_images = db.query(XrayImage).filter(
        XrayImage.patient_id == patient_id,
        XrayImage.clinic_id == current_user.clinic_id
    ).order_by(XrayImage.capture_date.desc()).all()
    
    result = []
    for xray in xray_images:
        result.append(XrayImageOut(
            id=xray.id,
            patient_id=xray.patient_id,
            appointment_id=xray.appointment_id,
            file_name=xray.file_name,
            file_path=xray.file_path,
            file_size=xray.file_size,
            image_type=xray.image_type,
            capture_date=xray.capture_date,
            brightness=xray.brightness,
            contrast=xray.contrast,
            notes=xray.notes,
            created_by=xray.created_by,
            created_at=xray.created_at,
            updated_at=getattr(xray, 'updated_at', xray.created_at),
            synced_at=getattr(xray, 'synced_at', None),
            sync_status=getattr(xray, 'sync_status', 'local'),
            patient_name=patient.name
        ))
    
    return result

@router.get("/appointment/{appointment_id}", response_model=List[XrayImageOut])
def get_appointment_xrays(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all X-ray images for an appointment"""
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify appointment belongs to current clinic
    patient = db.query(Patient).filter(
        Patient.id == appointment.patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=403, detail="Access denied")
    
    xray_images = db.query(XrayImage).filter(
        XrayImage.appointment_id == appointment_id,
        XrayImage.clinic_id == current_user.clinic_id
    ).order_by(XrayImage.capture_date.desc()).all()
    
    result = []
    for xray in xray_images:
        result.append(XrayImageOut(
            id=xray.id,
            patient_id=xray.patient_id,
            appointment_id=xray.appointment_id,
            file_name=xray.file_name,
            file_path=xray.file_path,
            file_size=xray.file_size,
            image_type=xray.image_type,
            capture_date=xray.capture_date,
            brightness=xray.brightness,
            contrast=xray.contrast,
            notes=xray.notes,
            created_by=xray.created_by,
            created_at=xray.created_at,
            updated_at=getattr(xray, 'updated_at', xray.created_at),
            synced_at=getattr(xray, 'synced_at', None),
            sync_status=getattr(xray, 'sync_status', 'local'),
            patient_name=patient.name
        ))
    
    return result

@router.delete("/{xray_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_xray_image(
    xray_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete an X-ray image"""
    xray_image = db.query(XrayImage).filter(
        XrayImage.id == xray_id,
        XrayImage.clinic_id == current_user.clinic_id
    ).first()
    
    if not xray_image:
        raise HTTPException(status_code=404, detail="X-ray image not found")
    
    try:
        # Delete file from filesystem
        if os.path.exists(xray_image.file_path):
            os.remove(xray_image.file_path)
        
        # Delete database record
        db.delete(xray_image)
        db.commit()
        
        return None
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting X-ray image: {str(e)}")

@router.get("/{xray_id}/download")
def download_xray_image(
    xray_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Download an X-ray image file"""
    from fastapi.responses import FileResponse
    
    xray_image = db.query(XrayImage).filter(
        XrayImage.id == xray_id,
        XrayImage.clinic_id == current_user.clinic_id
    ).first()
    
    if not xray_image:
        raise HTTPException(status_code=404, detail="X-ray image not found")
    
    if not os.path.exists(xray_image.file_path):
        raise HTTPException(status_code=404, detail="X-ray file not found on server")
    
    return FileResponse(
        path=xray_image.file_path,
        filename=xray_image.file_name,
        media_type='application/dicom'
    )

@router.get("/{xray_id}", response_model=XrayImageOut)
def get_xray_image(
    xray_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a single X-ray image by ID"""
    xray_image = db.query(XrayImage).filter(
        XrayImage.id == xray_id,
        XrayImage.clinic_id == current_user.clinic_id
    ).first()
    
    if not xray_image:
        raise HTTPException(status_code=404, detail="X-ray image not found")
    
    patient = db.query(Patient).filter(Patient.id == xray_image.patient_id).first()
    
    return XrayImageOut(
        id=xray_image.id,
        patient_id=xray_image.patient_id,
        appointment_id=xray_image.appointment_id,
        file_name=xray_image.file_name,
        file_path=xray_image.file_path,
        file_size=xray_image.file_size,
        image_type=xray_image.image_type,
        capture_date=xray_image.capture_date,
        brightness=xray_image.brightness,
        contrast=xray_image.contrast,
        notes=xray_image.notes,
        created_by=xray_image.created_by,
        created_at=xray_image.created_at,
        patient_name=patient.name if patient else None
    )
