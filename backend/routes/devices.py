from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import UserDevice, User
from schemas import UserOut
from auth import get_current_user
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_user_devices(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all devices for a user or all users in clinic"""
    # Check permissions
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("view", False):
            raise HTTPException(status_code=403, detail="You don't have permission to view devices")
    
    # If user_id is provided, get devices for that user
    # Otherwise, get devices for all users in the clinic
    if user_id:
        # Verify user belongs to same clinic
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        if target_user.clinic_id != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="You can only view devices for users in your clinic")
        
        devices = db.query(UserDevice).filter(UserDevice.user_id == user_id).all()
    else:
        # Get all users in clinic
        clinic_users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
        user_ids = [u.id for u in clinic_users]
        devices = db.query(UserDevice).filter(UserDevice.user_id.in_(user_ids)).all()
    
    # Enrich with user information
    result = []
    for device in devices:
        user = db.query(User).filter(User.id == device.user_id).first()
        result.append({
            "id": device.id,
            "user_id": device.user_id,
            "user_name": user.name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "user_role": user.role if user else "Unknown",
            "device_name": device.device_name,
            "device_type": device.device_type,
            "device_platform": device.device_platform,
            "device_os": device.device_os,
            "device_serial": device.device_serial,
            "ip_address": device.ip_address,
            "location": device.location,
            "is_active": device.is_active,
            "is_online": device.is_online,
            "last_seen": device.last_seen.isoformat() if device.last_seen else None,
            "allowed_access": device.allowed_access or {"desktop": True, "mobile": True, "web": True},
            "enrolled_at": device.enrolled_at.isoformat() if device.enrolled_at else None,
            "assigned_at": device.assigned_at.isoformat() if device.assigned_at else None,
            "created_at": device.created_at.isoformat() if device.created_at else None
        })
    
    return result

@router.get("/{device_id}", response_model=dict)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific device"""
    device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Verify device belongs to user in same clinic
    user = db.query(User).filter(User.id == device.user_id).first()
    if not user or user.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="You don't have permission to view this device")
    
    return {
        "id": device.id,
        "user_id": device.user_id,
        "user_name": user.name if user else "Unknown",
        "user_email": user.email if user else "Unknown",
        "user_role": user.role if user else "Unknown",
        "device_name": device.device_name,
        "device_type": device.device_type,
        "device_platform": device.device_platform,
        "device_os": device.device_os,
        "device_serial": device.device_serial,
        "user_agent": device.user_agent,
        "ip_address": device.ip_address,
        "location": device.location,
        "is_active": device.is_active,
        "is_online": device.is_online,
        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
        "allowed_access": device.allowed_access or {"desktop": True, "mobile": True, "web": True},
        "enrolled_at": device.enrolled_at.isoformat() if device.enrolled_at else None,
        "assigned_at": device.assigned_at.isoformat() if device.assigned_at else None,
        "created_at": device.created_at.isoformat() if device.created_at else None
    }

@router.put("/{device_id}", response_model=dict)
def update_device(
    device_id: int,
    device_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update device settings (access restrictions, name, etc.)"""
    # Check permissions
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to edit devices")
    
    device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Verify device belongs to user in same clinic
    user = db.query(User).filter(User.id == device.user_id).first()
    if not user or user.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this device")
    
    # Update allowed fields
    if "device_name" in device_update:
        device.device_name = device_update["device_name"]
    if "allowed_access" in device_update:
        device.allowed_access = device_update["allowed_access"]
    if "is_active" in device_update:
        device.is_active = device_update["is_active"]
    if "location" in device_update:
        device.location = device_update["location"]
    
    device.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(device)
    
    return {
        "id": device.id,
        "device_name": device.device_name,
        "allowed_access": device.allowed_access,
        "is_active": device.is_active
    }

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete/unenroll a device"""
    # Check permissions
    if current_user.role != "clinic_owner":
        permissions = current_user.permissions or {}
        users_permissions = permissions.get("users", {})
        if not users_permissions.get("edit", False):
            raise HTTPException(status_code=403, detail="You don't have permission to delete devices")
    
    device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Verify device belongs to user in same clinic
    user = db.query(User).filter(User.id == device.user_id).first()
    if not user or user.clinic_id != current_user.clinic_id:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this device")
    
    db.delete(device)
    db.commit()
    return None





