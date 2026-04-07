from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from database import get_db
from models import ClinicalSetting, User
from schemas import ClinicalSettingCreate, ClinicalSettingUpdate, ClinicalSettingOut
from core.auth_utils import get_current_user, require_doctor_or_owner
from typing import List, Optional
from sqlalchemy import or_

router = APIRouter(prefix="/settings", tags=["clinical-settings"])

@router.get("", response_model=List[ClinicalSettingOut])
def get_settings(
    category: Optional[str] = Query(None, description="Filter by category (complaint, finding, diagnosis, medical-condition)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get clinical settings/defaults for a clinic.
    Returns both clinic-specific and global (system-wide) defaults.
    """
    query = db.query(ClinicalSetting).filter(
        or_(
            ClinicalSetting.clinic_id == current_user.clinic_id,
            ClinicalSetting.clinic_id == None
        ),
        ClinicalSetting.is_active == True
    )
    if category:
        query = query.filter(ClinicalSetting.category == category)
    
    return query.order_by(ClinicalSetting.name.asc()).all()

@router.post("", response_model=ClinicalSettingOut)
def create_setting(
    setting: ClinicalSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """
    Save a new clinical setting/default. 
    Mainly used for 'self-learning' when a doctor types a new term.
    """
    # Check if this exact setting already exists for this clinic
    existing = db.query(ClinicalSetting).filter(
        ClinicalSetting.clinic_id == current_user.clinic_id,
        ClinicalSetting.category == setting.category,
        ClinicalSetting.name == setting.name
    ).first()
    
    if existing:
        return existing
        
    db_setting = ClinicalSetting(
        **setting.model_dump(exclude={"clinic_id"}),
        clinic_id=current_user.clinic_id
    )
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.put("/{setting_id}", response_model=ClinicalSettingOut)
def update_setting(
    setting_id: int,
    setting_update: ClinicalSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    db_setting = db.query(ClinicalSetting).filter(
        ClinicalSetting.id == setting_id,
        ClinicalSetting.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found or system default")
        
    update_data = setting_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_setting, key, value)
        
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.delete("/{setting_id}")
def delete_setting(
    setting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    db_setting = db.query(ClinicalSetting).filter(
        ClinicalSetting.id == setting_id,
        ClinicalSetting.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found")
        
    db.delete(db_setting)
    db.commit()
    return {"message": "Setting deleted successfully"}
