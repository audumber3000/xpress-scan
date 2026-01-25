from fastapi import APIRouter, Depends, HTTPException, status, Path, Request
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient, Payment, TreatmentType, Invoice, InvoiceLineItem, InvoiceAuditLog
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

@router.get("/", response_model=List[PatientOut])
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
    
    return patients

@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient: PatientCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit)
):
    """Create a new patient for current clinic and automatically create draft invoice"""
    try:
        # Set clinic_id from current user
        patient_data = patient.dict()
        patient_data['clinic_id'] = current_user.clinic_id
        
        # Create patient first
        db_patient = Patient(**patient_data)
        db.add(db_patient)
        db.flush()  # Flush to get the patient ID without committing
        
        # Find treatment type to get price
        treatment_type = db.query(TreatmentType).filter(
            TreatmentType.clinic_id == current_user.clinic_id,
            TreatmentType.name == patient.treatment_type
        ).first()
        
        amount = treatment_type.price if treatment_type else 2000.0
        
        # Generate invoice number
        year = datetime.utcnow().year
        last_invoice = db.query(Invoice).filter(
            Invoice.clinic_id == current_user.clinic_id,
            Invoice.invoice_number.like(f"INV-{year}-%")
        ).order_by(Invoice.invoice_number.desc()).first()
        
        if last_invoice:
            try:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except:
                new_num = 1
        else:
            new_num = 1
        
        invoice_number = f"INV-{year}-{new_num:04d}"
        
        # Create invoice with draft status
        invoice = Invoice(
            clinic_id=current_user.clinic_id,
            patient_id=db_patient.id,
            invoice_number=invoice_number,
            status='draft',
            subtotal=amount,
            tax=0.0,
            total=amount,
            created_by=current_user.id
        )
        db.add(invoice)
        db.flush()
        
        # Create initial line item
        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            description=f"{patient.treatment_type}",
            quantity=1.0,
            unit_price=amount,
            amount=amount
        )
        db.add(line_item)
        
        # Create audit log
        audit_log = InvoiceAuditLog(
            invoice_id=invoice.id,
            action='created',
            user_id=current_user.id,
            notes=f"Invoice created automatically with patient registration"
        )
        db.add(audit_log)
        
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
                
                WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")
                requests.post(
                    f"{WHATSAPP_SERVICE_URL}/api/send/{current_user.id}",
                    json={"phone": clean_phone, "message": rendered_message},
                    timeout=30
                )
            except Exception as e:
                print(f"⚠️ Welcome message error: {e}")
        
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