from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import ConsentTemplate, PatientConsent, Patient, User
from core.dtos import (
    ConsentTemplateCreateDTO, 
    ConsentTemplateUpdateDTO, 
    ConsentTemplateResponseDTO,
    PatientConsentCreateDTO,
    PatientConsentResponseDTO
)
from core.auth_utils import get_current_user

router = APIRouter()

# Template Routes
@router.get("/templates", response_model=List[ConsentTemplateResponseDTO])
async def list_templates(
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user),
    clinic_id: Optional[int] = None
):
    query = db.query(ConsentTemplate)
    target_clinic_id = clinic_id or current_user.clinic_id
    query = query.filter(ConsentTemplate.clinic_id == target_clinic_id)
    return query.all()

@router.post("/templates", response_model=ConsentTemplateResponseDTO)
async def create_template(
    template_data: ConsentTemplateCreateDTO, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    template = ConsentTemplate(
        clinic_id=current_user.clinic_id,
        **template_data.dict()
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/templates/{template_id}", response_model=ConsentTemplateResponseDTO)
async def update_template(
    template_id: int,
    template_data: ConsentTemplateUpdateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    for key, value in template_data.dict(exclude_unset=True).items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    return template

# Patient Consent Routes (Signing)
@router.post("/patient/{patient_id}/sign", response_model=PatientConsentResponseDTO)
async def sign_consent(
    patient_id: int,
    consent_data: PatientConsentCreateDTO,
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    consent = PatientConsent(
        patient_id=patient_id,
        template_id=consent_data.template_id,
        signed_content=consent_data.signed_content,
        signature_url=consent_data.signature_url,
        signed_at=datetime.utcnow()
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    
    # Enrich with template name for response
    template = db.query(ConsentTemplate).filter(ConsentTemplate.id == consent.template_id).first()
    dto = PatientConsentResponseDTO.from_orm(consent)
    dto.template_name = template.name if template else "Template"
    return dto

@router.get("/patient/{patient_id}", response_model=List[PatientConsentResponseDTO])
async def list_patient_consents(patient_id: int, db: Session = Depends(get_db)):
    consents = db.query(PatientConsent).filter(PatientConsent.patient_id == patient_id).all()
    result = []
    for c in consents:
        template = db.query(ConsentTemplate).filter(ConsentTemplate.id == c.template_id).first()
        result.append(PatientConsentResponseDTO(
            id=c.id,
            patient_id=c.patient_id,
            template_id=c.template_id,
            template_name=template.name if template else "Template",
            signed_content=c.signed_content,
            signature_url=c.signature_url,
            signed_at=c.signed_at,
            created_at=c.created_at
        ))
    return result
