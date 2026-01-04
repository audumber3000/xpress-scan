from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import MessageTemplate, Clinic
from schemas import MessageTemplateCreate, MessageTemplateUpdate, MessageTemplateOut
from auth import get_current_user
from models import User

router = APIRouter()

@router.get("/", response_model=List[MessageTemplateOut])
def get_message_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all message templates for current clinic"""
    if not current_user.clinic_id:
        return []
    
    templates = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == current_user.clinic_id
    ).order_by(MessageTemplate.name).all()
    
    return templates

@router.get("/{template_name}", response_model=MessageTemplateOut)
def get_message_template(
    template_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific message template by name"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == current_user.clinic_id,
        MessageTemplate.name == template_name
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

@router.post("/", response_model=MessageTemplateOut, status_code=status.HTTP_201_CREATED)
def create_message_template(
    template: MessageTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new message template"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User must be associated with a clinic")
    
    # Check if template with same name already exists
    existing = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == current_user.clinic_id,
        MessageTemplate.name == template.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Template with name '{template.name}' already exists")
    
    template_data = template.dict()
    template_data['clinic_id'] = current_user.clinic_id
    
    db_template = MessageTemplate(**template_data)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    
    return db_template

@router.put("/{template_id}", response_model=MessageTemplateOut)
def update_message_template(
    template_id: int,
    template_update: MessageTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a message template"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User must be associated with a clinic")
    
    db_template = db.query(MessageTemplate).filter(
        MessageTemplate.id == template_id,
        MessageTemplate.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Update fields
    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_template, field, value)
    
    db.commit()
    db.refresh(db_template)
    
    return db_template

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a message template"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User must be associated with a clinic")
    
    db_template = db.query(MessageTemplate).filter(
        MessageTemplate.id == template_id,
        MessageTemplate.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(db_template)
    db.commit()
    return None

def render_template(template_content: str, variables: dict) -> str:
    """Render a template with variables"""
    result = template_content
    for key, value in variables.items():
        # Support both {variable} and {{variable}} formats
        result = result.replace(f"{{{key}}}", str(value))
        result = result.replace(f"{{{{{key}}}}}", str(value))
    return result

def get_template_for_scenario(
    db: Session,
    clinic_id: int,
    scenario_name: str,
    default_template: str
) -> str:
    """Get template for a scenario, or return default if not found"""
    template = db.query(MessageTemplate).filter(
        MessageTemplate.clinic_id == clinic_id,
        MessageTemplate.name == scenario_name,
        MessageTemplate.is_active == True
    ).first()
    
    if template:
        return template.content
    return default_template

