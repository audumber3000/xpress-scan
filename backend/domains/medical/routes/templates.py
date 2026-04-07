from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from models import TemplateConfiguration, Clinic, User
from core.dtos import (
    TemplateConfigCreate, 
    TemplateConfigUpdate, 
    TemplateConfigResponse
)
from core.auth_utils import get_current_user
from typing import List, Optional

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("", response_model=List[TemplateConfigResponse])
def get_all_template_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all template configurations for the current clinic."""
    return db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id
    ).all()

@router.get("/{category}", response_model=TemplateConfigResponse)
def get_template_config(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get template configuration for a specific category."""
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == category
    ).first()
    
    if not config:
        # Return a transient object with defaults if not found in DB
        return TemplateConfigResponse(
            id=0,
            clinic_id=current_user.clinic_id,
            category=category,
            template_id="default",
            logo_url=None,
            footer_text=None,
            primary_color=None,
            secondary_color=None,
            config_json=None,
            created_at=None,
            updated_at=None
        )
    return config

@router.post("", response_model=TemplateConfigResponse)
def save_template_config(
    config_in: TemplateConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save or update template configuration."""
    existing = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == config_in.category
    ).first()
    
    if existing:
        update_data = config_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    new_config = TemplateConfiguration(
        **config_in.model_dump(),
        clinic_id=current_user.clinic_id
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return new_config

@router.put("/{config_id}", response_model=TemplateConfigResponse)
def update_template_config(
    config_id: int,
    config_update: TemplateConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a specific template configuration by ID."""
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.id == config_id,
        TemplateConfiguration.clinic_id == current_user.clinic_id
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    update_data = config_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    return config
