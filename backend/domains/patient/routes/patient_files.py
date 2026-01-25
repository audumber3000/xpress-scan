"""
Patient Files routes for managing documents, images, X-rays, and DICOM files
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from pathlib import Path
from database import get_db
from core.auth_utils import get_current_user, require_patients_view, require_patients_edit
from models import User, Patient, XrayImage

router = APIRouter()


class PatientFileResponse(BaseModel):
    id: int
    patient_id: int
    file_name: str
    file_path: str
    file_type: str  # 'pdf', 'image', 'dicom', 'xray'
    file_size: int
    uploaded_at: datetime
    notes: str = None

    class Config:
        from_attributes = True


class XrayImageResponse(BaseModel):
    id: int
    patient_id: int
    file_name: str
    file_path: str
    file_size: int
    image_type: str
    capture_date: datetime
    brightness: float = None
    contrast: float = None
    notes: str = None
    created_at: datetime

    class Config:
        from_attributes = True


# Configure upload directory
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads/patient_files"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_file_type(filename: str) -> str:
    """Determine file type from extension"""
    ext = filename.lower().split('.')[-1]
    
    if ext == 'pdf':
        return 'pdf'
    elif ext in ['dcm', 'dicom']:
        return 'dicom'
    elif ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp']:
        return 'image'
    else:
        return 'other'


@router.post("/{patient_id}/files/upload", status_code=status.HTTP_201_CREATED)
async def upload_patient_file(
    patient_id: int,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Upload a file (PDF, image, etc.) for a patient"""
    try:
        # Verify patient exists and belongs to clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Create patient-specific directory
        patient_dir = UPLOAD_DIR / str(current_user.clinic_id) / str(patient_id)
        patient_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{timestamp}_{file.filename}"
        file_path = patient_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        file_type = get_file_type(file.filename)
        
        return {
            "message": "File uploaded successfully",
            "file_name": unique_filename,
            "file_path": str(file_path),
            "file_type": file_type,
            "file_size": file_size,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/{patient_id}/files", response_model=List[dict])
async def get_patient_files(
    patient_id: int,
    current_user: User = Depends(require_patients_view),
    db: Session = Depends(get_db)
):
    """Get all files for a patient"""
    try:
        # Verify patient exists and belongs to clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Get patient directory
        patient_dir = UPLOAD_DIR / str(current_user.clinic_id) / str(patient_id)
        
        if not patient_dir.exists():
            return []
        
        # List all files
        files = []
        for file_path in patient_dir.iterdir():
            if file_path.is_file():
                stat = file_path.stat()
                files.append({
                    "file_name": file_path.name,
                    "file_path": str(file_path),
                    "file_type": get_file_type(file_path.name),
                    "file_size": stat.st_size,
                    "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        
        # Sort by upload date (newest first)
        files.sort(key=lambda x: x["uploaded_at"], reverse=True)
        
        return files
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve files: {str(e)}"
        )


@router.delete("/{patient_id}/files/{file_name}")
async def delete_patient_file(
    patient_id: int,
    file_name: str,
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Delete a patient file"""
    try:
        # Verify patient exists and belongs to clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Get file path
        file_path = UPLOAD_DIR / str(current_user.clinic_id) / str(patient_id) / file_name
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Delete file
        os.remove(file_path)
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}"
        )


# X-ray specific endpoints (using the XrayImage model)
@router.post("/{patient_id}/xrays", response_model=XrayImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_xray_image(
    patient_id: int,
    file: UploadFile = File(...),
    image_type: str = Form(...),
    capture_date: str = Form(...),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Upload an X-ray image with metadata"""
    try:
        # Verify patient exists and belongs to clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Create xray directory
        xray_dir = UPLOAD_DIR / str(current_user.clinic_id) / str(patient_id) / "xrays"
        xray_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"xray_{timestamp}_{file.filename}"
        file_path = xray_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        
        # Parse capture date
        capture_datetime = datetime.strptime(capture_date, "%Y-%m-%d")
        
        # Create XrayImage record
        xray_image = XrayImage(
            clinic_id=current_user.clinic_id,
            patient_id=patient_id,
            file_path=str(file_path),
            file_name=unique_filename,
            file_size=file_size,
            image_type=image_type,
            capture_date=capture_datetime,
            notes=notes,
            created_by=current_user.id
        )
        
        db.add(xray_image)
        db.commit()
        db.refresh(xray_image)
        
        return xray_image
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload X-ray: {str(e)}"
        )


@router.get("/{patient_id}/xrays", response_model=List[XrayImageResponse])
async def get_patient_xrays(
    patient_id: int,
    current_user: User = Depends(require_patients_view),
    db: Session = Depends(get_db)
):
    """Get all X-ray images for a patient"""
    try:
        # Verify patient exists and belongs to clinic
        patient = db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id
        ).first()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Get X-ray images
        xrays = db.query(XrayImage).filter(
            XrayImage.patient_id == patient_id,
            XrayImage.clinic_id == current_user.clinic_id
        ).order_by(XrayImage.capture_date.desc()).all()
        
        return xrays
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve X-rays: {str(e)}"
        )


@router.delete("/{patient_id}/xrays/{xray_id}")
async def delete_xray_image(
    patient_id: int,
    xray_id: int,
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Delete an X-ray image"""
    try:
        # Get X-ray record
        xray = db.query(XrayImage).filter(
            XrayImage.id == xray_id,
            XrayImage.patient_id == patient_id,
            XrayImage.clinic_id == current_user.clinic_id
        ).first()
        
        if not xray:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="X-ray not found"
            )
        
        # Delete file
        if os.path.exists(xray.file_path):
            os.remove(xray.file_path)
        
        # Delete database record
        db.delete(xray)
        db.commit()
        
        return {"message": "X-ray deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete X-ray: {str(e)}"
        )
