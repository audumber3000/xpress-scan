from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import TemplateConfiguration, Clinic
from core.auth_utils import get_current_user
from core.dtos import TemplateConfigResponse, TemplateConfigCreate, TemplateConfigUpdate
from typing import List

router = APIRouter()

@router.get("", response_model=List[TemplateConfigResponse])
def get_template_configs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id
    ).all()

@router.post("", response_model=TemplateConfigResponse)
def upsert_template_config(
    config_in: TemplateConfigCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check if exists for this category and clinic
    existing = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == config_in.category
    ).first()
    
    if existing:
        existing.template_id = config_in.template_id
        existing.logo_url = config_in.logo_url
        existing.primary_color = config_in.primary_color
        existing.footer_text = config_in.footer_text
        db.commit()
        db.refresh(existing)
        return existing
    
    new_config = TemplateConfiguration(
        clinic_id=current_user.clinic_id,
        **config_in.dict()
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return new_config

@router.get("/{category}", response_model=TemplateConfigResponse)
def get_category_config(
    category: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == category
    ).first()
    
    if not config:
        # Return a default-like response or raise 404
        # For now, let's return a basic one if not found
        return TemplateConfigResponse(
            category=category,
            template_id="default",
            clinic_id=current_user.clinic_id
        )
    return config
