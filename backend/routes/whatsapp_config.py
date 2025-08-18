from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import WhatsAppConfiguration, User
from auth import get_current_user
from schemas import WhatsAppConfigCreate, WhatsAppConfigUpdate, WhatsAppConfigResponse

router = APIRouter(tags=["WhatsApp Configuration"])

@router.get("/", response_model=List[WhatsAppConfigResponse])
async def get_whatsapp_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all WhatsApp configurations for the current user's clinic"""
    try:
        configs = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.clinic_id == current_user.clinic_id
        ).all()
        return configs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching WhatsApp configurations: {str(e)}"
        )

@router.get("/my-config", response_model=Optional[WhatsAppConfigResponse])
async def get_my_whatsapp_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's WhatsApp configuration"""
    try:
        config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.user_id == current_user.id
        ).first()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching WhatsApp configuration: {str(e)}"
        )

@router.post("/", response_model=WhatsAppConfigResponse)
async def create_whatsapp_config(
    config_data: WhatsAppConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new WhatsApp configuration for the current user"""
    try:
        # Check if user already has a config
        existing_config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.user_id == current_user.id
        ).first()
        
        if existing_config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has a WhatsApp configuration"
            )
        
        # Create new config
        new_config = WhatsAppConfiguration(
            user_id=current_user.id,
            clinic_id=current_user.clinic_id,
            api_key=config_data.api_key,
            phone_number=config_data.phone_number
        )
        
        db.add(new_config)
        db.commit()
        db.refresh(new_config)
        
        return new_config
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating WhatsApp configuration: {str(e)}"
        )

@router.get("/credit")
async def get_whatsapp_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get WhatsApp API credit balance for the current user"""
    try:
        from services.whatsapp_service import WhatsAppService
        
        # Get user's config
        config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.user_id == current_user.id,
            WhatsAppConfiguration.is_active == True
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active WhatsApp configuration found for this user"
            )
        
        # Get credit using user's API key
        whatsapp_service = WhatsAppService()
        whatsapp_service.api_key = config.api_key  # Override with user's key
        
        result = whatsapp_service.get_credit()
        
        return {
            "success": result["success"],
            "credit": result.get("credit", 0),
            "message": result.get("message", "Credit retrieved successfully")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting WhatsApp credit: {str(e)}"
        )

@router.put("/{config_id}", response_model=WhatsAppConfigResponse)
async def update_whatsapp_config(
    config_id: int,
    config_data: WhatsAppConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing WhatsApp configuration"""
    try:
        config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.id == config_id,
            WhatsAppConfiguration.clinic_id == current_user.clinic_id
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp configuration not found"
            )
        
        # Update fields
        if config_data.api_key is not None:
            config.api_key = config_data.api_key
        if config_data.phone_number is not None:
            config.phone_number = config_data.phone_number
        if config_data.is_active is not None:
            config.is_active = config_data.is_active
        
        db.commit()
        db.refresh(config)
        
        return config
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating WhatsApp configuration: {str(e)}"
        )

@router.delete("/{config_id}")
async def delete_whatsapp_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a WhatsApp configuration"""
    try:
        config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.id == config_id,
            WhatsAppConfiguration.clinic_id == current_user.clinic_id
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp configuration not found"
            )
        
        db.delete(config)
        db.commit()
        
        return {"message": "WhatsApp configuration deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting WhatsApp configuration: {str(e)}"
        )

@router.post("/test-connection")
async def test_whatsapp_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test the current user's WhatsApp API connection"""
    try:
        from services.whatsapp_service import WhatsAppService
        
        # Get user's config
        config = db.query(WhatsAppConfiguration).filter(
            WhatsAppConfiguration.user_id == current_user.id,
            WhatsAppConfiguration.is_active == True
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active WhatsApp configuration found for this user"
            )
        
        # Test with user's API key
        whatsapp_service = WhatsAppService()
        whatsapp_service.api_key = config.api_key  # Override with user's key
        
        result = whatsapp_service.test_connection()
        
        return {
            "success": result["success"],
            "message": result.get("message", "Connection test completed"),
            "details": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing WhatsApp connection: {str(e)}"
        )
