from fastapi import APIRouter, Depends, HTTPException, status, Path, Request
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient, Payment, TreatmentType, PatientDocument
from schemas import PatientCreate, PatientOut
from typing import List
from schemas import PatientResponse
from core.auth_utils import get_current_user, get_current_clinic, require_patients_view, require_patients_edit, require_patients_delete
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

@router.get("", response_model=List[PatientOut])
def get_patients(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view)
):
    """Get all patients for current clinic"""
    if not current_user.clinic_id:
        return []
    
    patients = db.query(Patient).filter(
        Patient.clinic_id == current_user.clinic_id
    ).offset(skip).limit(limit).all()
    
    # Enrich patients with last_visit
    for p in patients:
        last_report = db.query(Invoice).filter(Invoice.patient_id == p.id).order_by(Invoice.created_at.desc()).first()
        p.last_visit = last_report.created_at if last_report else p.created_at
        
    return patients

@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient: PatientCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit)
):
    """Create a new patient for current clinic and automatically create draft invoice"""
    try:
        # Set clinic_id and display_id
        patient_data = patient.dict()
        patient_data['clinic_id'] = current_user.clinic_id
        
        # Generate 6-digit display ID
        count = db.query(Patient).filter(Patient.clinic_id == current_user.clinic_id).count()
        patient_data['display_id'] = str(100000 + count + 1)

        # Create patient first
        db_patient = Patient(**patient_data)
        db.add(db_patient)
        db.flush()
        
        db.commit()
        db.refresh(db_patient)
        
        # Welcome message flow... (keep it as is)
        if db_patient.phone:
            try:
                from routes.message_templates import get_template_for_scenario, render_template
                import requests
                import re
                import os
                
                from models import Clinic
                clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
                
                default_welcome = f"Welcome to {clinic.name if clinic else 'our clinic'}, {db_patient.name}! We're glad to have you as our patient. If you have any questions, please don't hesitate to reach out."
                welcome_message = get_template_for_scenario(db, current_user.clinic_id, "welcome", default_welcome)
                
                template_vars = {
                    "patient_name": db_patient.name,
                    "clinic_name": clinic.name if clinic else "our clinic",
                    "treatment_type": db_patient.treatment_type,
                    "phone": db_patient.phone
                }
                rendered_message = render_template(welcome_message, template_vars)
                
                clean_phone = re.sub(r'\D', '', str(db_patient.phone))
                if len(clean_phone) == 10:
                    clean_phone = "91" + clean_phone
                
                # WhatsApp Service URL (MolarPlus Nexus)
                NEXUS_SERVICES_URL = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
                requests.post(
                    f"{NEXUS_SERVICES_URL}/api/send/{current_user.id}",
                    json={"phone": clean_phone, "message": rendered_message},
                    timeout=30
                )
            except Exception as e:
                print(f"⚠️ Welcome message error: {e}")
        
        # Enrich for response
        db_patient.last_visit = db_patient.created_at
        
        return db_patient
    except Exception as e:
        db.rollback()
        if "duplicate key value violates unique constraint" in str(e):
            raise HTTPException(status_code=409, detail="A patient with this information already exists.")
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}")

@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view)
):
    """Get a single patient by ID (only if belongs to current clinic)"""
    db_patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return db_patient

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

@router.post("/import")
async def import_patients(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit)
):
    """Import patients from a CSV file"""
    import csv
    import io
    
    try:
        form = await request.form()
        file = form.get("file")
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
            
        content = await file.read()
        decoded = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        imported_count = 0
        errors = []
        
        for row in csv_reader:
            try:
                # Map CSV columns to Patient model
                # Expected: name, age, gender, phone, village, treatment_type, referred_by, blood_group, patient_history, notes, display_id
                patient_data = {
                    "clinic_id": current_user.clinic_id,
                    "name": (row.get("name") or "").strip(),
                    "age": int(row.get("age")) if row.get("age") and str(row.get("age")).isdigit() else 0,
                    "gender": (row.get("gender") or "Other").strip(),
                    "phone": (row.get("phone") or "").strip(),
                    "village": (row.get("village") or "").strip(),
                    "treatment_type": (row.get("treatment_type") or "General").strip(),
                    "referred_by": (row.get("referred_by") or "").strip(),
                    "blood_group": (row.get("blood_group") or "").strip(),
                    "patient_history": (row.get("patient_history") or "").strip(),
                    "notes": (row.get("notes") or "").strip(),
                    "display_id": str(100000 + imported_count + 1 + db.query(Patient).filter(Patient.clinic_id == current_user.clinic_id).count())
                }
                
                if not patient_data["name"] or not patient_data["phone"]:
                    errors.append(f"Row {imported_count + 1}: Name and phone are required")
                    continue
                    
                db_patient = Patient(**patient_data)
                db.add(db_patient)
                imported_count += 1
            except Exception as row_err:
                errors.append(f"Row {imported_count + 1}: {str(row_err)}")
                
        db.commit()
        return {
            "status": "success",
            "message": f"Successfully imported {imported_count} patients",
            "imported_count": imported_count,
            "errors": errors
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.post("/{patient_id}/documents/external")
def add_external_document(
    patient_id: int,
    doc_data: dict,
    db: Session = Depends(get_db)
):
    """Add a document reference from an external service (e.g. Consent PDF)"""
    new_doc = PatientDocument(
        patient_id=patient_id,
        clinic_id=doc_data.get('clinic_id'),
        file_name=doc_data.get('file_name'),
        file_path=doc_data.get('file_path'),
        file_type='pdf',
        created_at=datetime.utcnow()
    )
    db.add(new_doc)
    db.commit()
    return {"status": "success", "id": new_doc.id}